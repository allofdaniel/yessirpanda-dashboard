import { NextRequest, NextResponse } from 'next/server';
import { getWords, getWrongWords } from '@/lib/db';
import { getServerClient } from '@/lib/supabase';
import { requireAuth, sanitizeDay, sanitizeEmail, verifyEmailOwnership } from '@/lib/auth-middleware';
import type { Word, WrongWord } from '@/lib/types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiError } from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

interface ExportWord {
  day: number;
  word: string;
  meaning: string;
  example?: string;
}

// GET /api/export?type=[all|today|wrong|postponed]&format=[pdf|excel]&email=X&day=N
export async function GET(request: NextRequest) {
  const rate = checkRateLimit('api:export:get', request, {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:export:get');
  }

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const { user } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';
    const format = searchParams.get('format') || 'pdf';
    const requestedEmail = sanitizeEmail(searchParams.get('email')) || user.email;
    const dayParam = sanitizeDay(searchParams.get('day'));

    if (!requestedEmail || !verifyEmailOwnership(user.email, requestedEmail)) {
      return apiError('FORBIDDEN', 'You can only export data for your own account');
    }

    const allowedTypes = new Set(['all', 'today', 'wrong', 'postponed']);
    if (!allowedTypes.has(type)) {
      return apiError('INVALID_INPUT', 'Invalid export type');
    }

    const allowedFormats = new Set(['pdf', 'excel']);
    if (!allowedFormats.has(format)) {
      return apiError('INVALID_INPUT', 'Invalid format. Use pdf or excel');
    }

    let words: ExportWord[] = [];
    let filename = '';

    switch (type) {
      case 'all': {
        const allWords = await getWords();
        words = allWords.map((w: Word) => ({
          day: w.Day,
          word: w.Word,
          meaning: w.Meaning,
        }));
        filename = 'all_words';
        break;
      }

      case 'today': {
        if (!dayParam) {
          return apiError('INVALID_INPUT', 'Day parameter is required for today export');
        }
        const todayWords = await getWords(dayParam);
        words = todayWords.map((w: Word) => ({
          day: w.Day,
          word: w.Word,
          meaning: w.Meaning,
        }));
        filename = `day_${dayParam}_words`;
        break;
      }

      case 'wrong': {
        const wrongWords = await getWrongWords(requestedEmail);
        words = wrongWords.map((w: WrongWord) => ({
          day: 0,
          word: w.Word,
          meaning: w.Meaning,
        }));
        filename = 'wrong_words';
        break;
      }

      case 'postponed': {
        const supabase = getServerClient();
        const { data: subscriber, error: subError } = await supabase
          .from('subscribers')
          .select('postponed_days')
          .eq('email', requestedEmail)
          .single();

        if (subError || !subscriber) {
          return apiError('NOT_FOUND', 'Subscriber not found');
        }

        const postponedDays = subscriber.postponed_days || [];
        if (!Array.isArray(postponedDays) || postponedDays.length === 0) {
          return apiError('NOT_FOUND', 'No postponed words found');
        }

        const allWords = await getWords();
        words = allWords
          .filter((w: Word) => postponedDays.includes(w.Day))
          .map((w: Word) => ({
            day: w.Day,
            word: w.Word,
            meaning: w.Meaning,
          }));
        filename = 'postponed_words';
        break;
      }
    }

    if (words.length === 0) {
      return apiError('NOT_FOUND', 'No words found to export');
    }

    if (format === 'excel') {
      return generateExcelExport(words, filename);
    }

    return generatePDFExport(words, filename);
  } catch (error) {
    console.error('Error exporting words:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to export words',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}

function generateExcelExport(words: ExportWord[], filename: string) {
  try {
    const worksheetData = [
      ['Day', 'Word', 'Meaning'],
      ...words.map((w) => [
        w.day > 0 ? w.day : '-',
        w.word,
        w.meaning,
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    ws['!cols'] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 40 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Words');

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to generate Excel file',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}

function generatePDFExport(words: ExportWord[], filename: string) {
  try {
    const doc = new jsPDF();

    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.text('Word List Export', 14, 20);

    doc.setFontSize(10);
    const now = new Date().toLocaleString('ko-KR');
    doc.text(`Generated: ${now}`, 14, 28);

    const tableData = words.map((w) => [
      w.day > 0 ? w.day.toString() : '-',
      w.word,
      w.meaning,
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Day', 'Word', 'Meaning']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [124, 58, 237],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 50 },
        2: { cellWidth: 110 },
      },
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to generate PDF file',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}
