'use client';

import { useState } from 'react';

interface ExportButtonsProps {
  email: string;
  currentDay?: number;
  type: 'all' | 'today' | 'wrong' | 'postponed';
  label?: string;
  className?: string;
}

export default function ExportButtons({
  email,
  currentDay,
  type,
  label,
  className = ''
}: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!email) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsExporting(true);
    try {
      // Build URL with query parameters
      const params = new URLSearchParams({
        type,
        format,
        email,
      });

      if (currentDay && type === 'today') {
        params.append('day', currentDay.toString());
      }

      const response = await fetch(`/api/export?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `export.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert(error instanceof Error ? error.message : '내보내기 실패');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        onClick={() => handleExport('pdf')}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
        title={`${label || '단어'} PDF 다운로드`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        PDF
      </button>
      <button
        onClick={() => handleExport('excel')}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
        title={`${label || '단어'} Excel 다운로드`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Excel
      </button>
    </div>
  );
}
