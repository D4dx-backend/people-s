/**
 * ExportButton - Universal Export Dropdown Component
 *
 * A reusable button with dropdown menu for CSV, PDF, and Print export options.
 * Works with the useExport hook for any list/table page.
 *
 * Usage:
 *   <ExportButton
 *     onExportCSV={() => exportCSV()}
 *     onExportPDF={() => exportPDF()}
 *     onPrint={() => printData()}
 *     exporting={exporting}
 *   />
 */

import React from 'react';
import { Download, FileText, Printer, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export interface ExportButtonProps {
  onExportCSV: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
  exporting?: boolean;
  /** Optional custom label */
  label?: string;
  /** Button size variant */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional className */
  className?: string;
  /** Disable specific options */
  disableCSV?: boolean;
  disablePDF?: boolean;
  disablePrint?: boolean;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  onExportCSV,
  onExportPDF,
  onPrint,
  exporting = false,
  label = 'Export',
  size = 'default',
  className = '',
  disableCSV = false,
  disablePDF = false,
  disablePrint = false,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={exporting} className={className}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {exporting ? 'Exporting...' : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {!disableCSV && (
          <DropdownMenuItem onClick={onExportCSV} disabled={exporting}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export as CSV
          </DropdownMenuItem>
        )}
        {!disablePDF && (
          <DropdownMenuItem onClick={onExportPDF} disabled={exporting}>
            <FileText className="mr-2 h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
        )}
        {(!disableCSV || !disablePDF) && !disablePrint && <DropdownMenuSeparator />}
        {!disablePrint && (
          <DropdownMenuItem onClick={onPrint} disabled={exporting}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportButton;
