/**
 * Export Utilities
 * 
 * Generic utility functions for exporting data as CSV, PDF (A4), and Print.
 * Used by the useExport hook and ExportButton component.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==================== TYPES ====================

export interface ExportColumn {
  header: string;
  accessor: string;
  width?: number; // Optional width hint for PDF columns
}

// ==================== CSV ====================

/**
 * Trigger a CSV file download in the browser
 */
export function downloadCSV(csvData: string, filename: string): void {
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ==================== PDF ====================

/**
 * Access a nested property using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Format a value for display in PDF/Print
 */
function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return value.toLocaleDateString('en-IN');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('en-IN');
  }
  return String(value);
}

/**
 * Generate a PDF document with table data (A4 format)
 */
export function generatePDF(
  title: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[],
  filename: string
): void {
  // Determine orientation based on column count
  const orientation = columns.length > 8 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 20);

  // Date stamp
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, 20, { align: 'right' });
  doc.text(`Total Records: ${data.length}`, pageWidth - margin, 25, { align: 'right' });

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Prepare table data
  const headers = columns.map(col => col.header);
  const rows = data.map(row =>
    columns.map(col => {
      const value = getNestedValue(row, col.accessor);
      return formatDisplayValue(value);
    })
  );

  // Generate table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 32,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: 'linebreak',
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [59, 130, 246], // Blue-500
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: columns.reduce((acc, col, i) => {
      if (col.width) {
        acc[i] = { cellWidth: col.width };
      }
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    didDrawPage: (hookData) => {
      // Footer with page numbers
      const pageCount = doc.getNumberOfPages();
      const currentPage = hookData.pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${currentPage} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    },
  });

  // Download
  const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(pdfFilename);
}

// ==================== PRINT ====================

/**
 * Open a print-optimized view in a new window
 */
export function printTable(
  title: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[]
): void {
  const dateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const headerRow = columns.map(col => `<th>${escapeHtml(col.header)}</th>`).join('');
  const bodyRows = data.map(row => {
    const cells = columns.map(col => {
      const value = getNestedValue(row, col.accessor);
      return `<td>${escapeHtml(formatDisplayValue(value))}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(title)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          color: #1a1a1a;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 12px;
        }
        .header h1 { font-size: 18px; color: #1e3a5f; }
        .header .meta { font-size: 11px; color: #666; text-align: right; }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        th {
          background: #3b82f6;
          color: white;
          padding: 6px 8px;
          text-align: left;
          font-weight: 600;
          white-space: nowrap;
        }
        td {
          padding: 5px 8px;
          border-bottom: 1px solid #e5e7eb;
          word-break: break-word;
        }
        tr:nth-child(even) { background: #f8fafc; }
        tr:hover { background: #eff6ff; }
        .footer {
          margin-top: 16px;
          font-size: 10px;
          color: #999;
          text-align: center;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          th { background: #3b82f6 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr:nth-child(even) { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { size: ${columns.length > 8 ? 'A4 landscape' : 'A4 portrait'}; margin: 10mm; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">
          <div>${dateStr}</div>
          <div>Total: ${data.length} records</div>
        </div>
      </div>
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="footer">Generated from ERP System</div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, c => map[c] || c);
}
