import { NextRequest, NextResponse } from 'next/server';
import { getWords, getWrongWords } from '@/lib/db';
import { getServerClient } from '@/lib/supabase';
import type { Word, WrongWord } from '@/lib/types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportWord {
  day: number;
  word: string;
  meaning: string;
  example?: string;
}

// GET /api/export?type=[all|today|wrong|postponed]&format=[pdf|excel]&email=X&day=N
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';
    const format = searchParams.get('format') || 'pdf';
    const email = searchParams.get('email');
    const dayParam = searchParams.get('day');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    let words: ExportWord[] = [];
    let filename = '';

    // Get words based on type
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
          return NextResponse.json(
            { error: 'Day parameter is required for today export' },
            { status: 400 }
          );
        }
        const day = parseInt(dayParam);
        if (isNaN(day)) {
          return NextResponse.json(
            { error: 'Invalid day parameter' },
            { status: 400 }
          );
        }
        const todayWords = await getWords(day);
        words = todayWords.map((w: Word) => ({
          day: w.Day,
          word: w.Word,
          meaning: w.Meaning,
        }));
        filename = `day_${day}_words`;
        break;
      }

      case 'wrong': {
        const wrongWords = await getWrongWords(email);
        words = wrongWords.map((w: WrongWord) => ({
          day: 0, // Wrong words don't have a specific day
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
          .eq('email', email)
          .single();

        if (subError || !subscriber) {
          return NextResponse.json(
            { error: 'Subscriber not found' },
            { status: 404 }
          );
        }

        const postponedDays = subscriber.postponed_days || [];
        if (postponedDays.length === 0) {
          return NextResponse.json(
            { error: 'No postponed words found' },
            { status: 404 }
          );
        }

        // Get all words and filter by postponed days
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

      default:
        return NextResponse.json(
          { error: 'Invalid export type' },
          { status: 400 }
        );
    }

    if (words.length === 0) {
      return NextResponse.json(
        { error: 'No words found to export' },
        { status: 404 }
      );
    }

    // Generate export based on format
    if (format === 'excel') {
      return generateExcelExport(words, filename);
    } else if (format === 'pdf') {
      return generatePDFExport(words, filename);
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use pdf or excel' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error exporting words:', error);
    return NextResponse.json(
      { error: 'Failed to export words' },
      { status: 500 }
    );
  }
}

function generateExcelExport(words: ExportWord[], filename: string) {
  try {
    // Create worksheet data
    const worksheetData = [
      ['Day', 'Word', 'Meaning'], // Header
      ...words.map((w) => [
        w.day > 0 ? w.day : '-',
        w.word,
        w.meaning,
      ]),
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    ws['!cols'] = [
      { wch: 8 },  // Day column
      { wch: 20 }, // Word column
      { wch: 40 }, // Meaning column
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Words');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return response with Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel file' },
      { status: 500 }
    );
  }
}

function generatePDFExport(words: ExportWord[], filename: string) {
  try {
    const doc = new jsPDF();

    // Add Korean font support (using default font for now)
    doc.setFont('helvetica');

    // Add title
    doc.setFontSize(18);
    doc.text('Word List Export', 14, 20);

    // Add timestamp
    doc.setFontSize(10);
    const now = new Date().toLocaleString('ko-KR');
    doc.text(`Generated: ${now}`, 14, 28);

    // Prepare table data
    const tableData = words.map((w) => [
      w.day > 0 ? w.day.toString() : '-',
      w.word,
      w.meaning,
    ]);

    // Add table
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
        fillColor: [124, 58, 237], // Violet color
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 50 },
        2: { cellWidth: 110 },
      },
    });

    // Get PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Return response with PDF file
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF file' },
      { status: 500 }
    );
  }
}
