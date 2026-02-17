/**
 * useExport - Universal Export Hook
 *
 * Generic reusable hook for exporting data from any list/table page.
 * Supports CSV (server-side), PDF (client-side via jsPDF), and Print.
 *
 * Usage:
 *   const { exportCSV, exportPDF, printData, exporting } = useExport({
 *     apiCall: (params) => donors.export(params),
 *     filenamePrefix: 'donors',
 *     pdfTitle: 'Donors Report',
 *     pdfColumns: [{ header: 'Name', accessor: 'name' }, ...],
 *   });
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { downloadCSV, generatePDF, printTable, type ExportColumn } from '@/utils/export';

export interface UseExportOptions {
  /** API call function that accepts params and returns response */
  apiCall: (params: Record<string, unknown>) => Promise<any>;
  /** Filename prefix for downloads (e.g. 'donors', 'payments') */
  filenamePrefix: string;
  /** Title displayed on the PDF header */
  pdfTitle: string;
  /** Column definitions for PDF and Print tables */
  pdfColumns: ExportColumn[];
  /** Optional function to build filter params from page state */
  getFilterParams?: () => Record<string, unknown>;
}

export interface UseExportReturn {
  exportCSV: (extraParams?: Record<string, unknown>) => Promise<void>;
  exportPDF: (extraParams?: Record<string, unknown>) => Promise<void>;
  printData: (extraParams?: Record<string, unknown>) => Promise<void>;
  exporting: boolean;
}

export function useExport(options: UseExportOptions): UseExportReturn {
  const { apiCall, filenamePrefix, pdfTitle, pdfColumns, getFilterParams } = options;
  const [exporting, setExporting] = useState(false);

  /**
   * Build merged params from getFilterParams + any extraParams
   */
  const buildParams = (extraParams?: Record<string, unknown>): Record<string, unknown> => {
    const filterParams = getFilterParams ? getFilterParams() : {};
    return { ...filterParams, ...extraParams };
  };

  /**
   * Export as CSV - calls the server with format=csv
   * Server returns raw CSV text, triggers download via blob
   */
  const exportCSV = async (extraParams?: Record<string, unknown>) => {
    try {
      setExporting(true);
      const params = buildParams(extraParams);

      // Try server-side CSV first
      const response = await apiCall({ ...params, format: 'csv' });

      let csvData: string;

      if (typeof response === 'string') {
        // Raw CSV string returned
        csvData = response;
      } else if (response?.success && typeof response.data === 'string') {
        csvData = response.data;
      } else if (response?.success && response?.data?.records) {
        // Server returned JSON — convert to CSV on client
        const records = response.data.records;
        if (records.length === 0) {
          toast.warning('No data to export');
          return;
        }
        // Build CSV from pdfColumns definitions
        const headers = pdfColumns.map(c => c.header);
        const rows = records.map((row: Record<string, unknown>) =>
          pdfColumns.map(col => {
            const val = getNestedValue(row, col.accessor);
            return `"${String(val ?? '').replace(/"/g, '""')}"`;
          })
        );
        csvData = [headers.map(h => `"${h}"`).join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
      } else {
        throw new Error('Unexpected response format');
      }

      const dateStr = new Date().toISOString().split('T')[0];
      downloadCSV(csvData, `${filenamePrefix}_${dateStr}.csv`);
      toast.success('CSV exported successfully');
    } catch (error: any) {
      console.error('CSV export error:', error);
      toast.error(error.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Export as PDF - fetches JSON data from server, generates PDF on client
   */
  const exportPDF = async (extraParams?: Record<string, unknown>) => {
    try {
      setExporting(true);
      const params = buildParams(extraParams);

      const response = await apiCall({ ...params, format: 'json' });

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to fetch data for PDF');
      }

      const records = response.data?.records || [];
      if (records.length === 0) {
        toast.warning('No data to export');
        return;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      generatePDF(pdfTitle, pdfColumns, records, `${filenamePrefix}_${dateStr}.pdf`);
      toast.success('PDF generated successfully');
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(error.message || 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Print data - fetches JSON data, opens print-friendly window
   */
  const printData = async (extraParams?: Record<string, unknown>) => {
    try {
      setExporting(true);
      const params = buildParams(extraParams);

      const response = await apiCall({ ...params, format: 'json' });

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to fetch data for printing');
      }

      const records = response.data?.records || [];
      if (records.length === 0) {
        toast.warning('No data to print');
        return;
      }

      printTable(pdfTitle, pdfColumns, records);
      toast.success('Print window opened');
    } catch (error: any) {
      console.error('Print error:', error);
      toast.error(error.message || 'Failed to prepare print');
    } finally {
      setExporting(false);
    }
  };

  return { exportCSV, exportPDF, printData, exporting };
}

// --- Helper ---
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((cur: unknown, key: string) => {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export default useExport;
