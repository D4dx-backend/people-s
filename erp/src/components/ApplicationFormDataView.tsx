import React from 'react';
import { Download, FileText } from 'lucide-react';

interface ApplicationFormDataViewProps {
  formData: any;
  formConfig: any; // { pages: [...] }
}

// --- helpers ---

const formatFieldValue = (value: any): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.join(', ');
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const isFlatTableObject = (val: any): boolean => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const keys = Object.keys(val);
  return keys.length > 0 && keys.every((k: string) => /^\d+_\d+$/.test(k));
};

const flatTableTo2D = (obj: Record<string, string>): string[][] => {
  let maxRow = 0, maxCol = 0;
  for (const k of Object.keys(obj)) {
    const [r, c] = k.split('_').map(Number);
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }
  const result: string[][] = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(''));
  for (const [k, v] of Object.entries(obj)) {
    const [r, c] = k.split('_').map(Number);
    result[r][c] = v || '';
  }
  return result;
};

// --- sub-components ---

const TableValueView: React.FC<{ value: any; fieldConfig: any; fieldKey: string; formData: any }> = ({
  value, fieldConfig, fieldKey, formData,
}) => {
  const colCount = fieldConfig?.columns || 2;
  const baseRowCount = fieldConfig?.rows || 2;
  const columnTitles: string[] = fieldConfig?.columnTitles || [];
  const rowTitles: string[] = fieldConfig?.rowTitles || [];
  const hasRowLabels = rowTitles.some((t: string) => t);
  const firstColumnHeader: string = fieldConfig?.firstColumnHeader || '';

  const metaKey = `${fieldKey}__rowMeta`;
  const rowMeta: { sourceRow: number; duplicateIndex: number }[] | null =
    formData?.[metaKey] && Array.isArray(formData[metaKey]) ? formData[metaKey] : null;

  const actualRowCount = rowMeta ? rowMeta.length : baseRowCount;

  const normalizedValue: string[][] = Array.isArray(value)
    ? value
    : isFlatTableObject(value)
      ? flatTableTo2D(value as Record<string, string>)
      : [];

  const derivedRowCount = normalizedValue.length > 0 ? normalizedValue.length : actualRowCount;
  const derivedColCount = normalizedValue.length > 0
    ? Math.max(colCount, ...normalizedValue.map(r => r.length))
    : colCount;

  const tableData = normalizedValue.length > 0
    ? normalizedValue
    : Array.from({ length: derivedRowCount }, () => Array(derivedColCount).fill(''));

  const getRowLabel = (rowIndex: number) => {
    if (rowMeta && rowMeta[rowIndex]) {
      const meta = rowMeta[rowIndex];
      const baseLabel = rowTitles[meta.sourceRow] || `Row ${meta.sourceRow + 1}`;
      return meta.duplicateIndex > 0 ? `${baseLabel} (${meta.duplicateIndex})` : baseLabel;
    }
    return rowTitles[rowIndex] || `Row ${rowIndex + 1}`;
  };

  return (
    <div className="overflow-auto rounded border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted">
            {hasRowLabels && (
              <th className="border p-2 text-xs font-medium text-left text-muted-foreground">
                {firstColumnHeader}
              </th>
            )}
            {Array.from({ length: derivedColCount }, (_, i) => (
              <th key={i} className="border p-2 text-xs font-semibold text-left">
                {columnTitles[i] || `Column ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: derivedRowCount }, (_, r) => (
            <tr key={r} className={r % 2 === 0 ? '' : 'bg-muted/30'}>
              {hasRowLabels && (
                <td className="border p-2 text-xs font-medium text-muted-foreground bg-muted/50 whitespace-nowrap">
                  {getRowLabel(r)}
                </td>
              )}
              {Array.from({ length: derivedColCount }, (_, c) => (
                <td key={c} className="border p-2 text-xs">
                  {tableData[r]?.[c] || <span className="text-muted-foreground italic">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const FieldValueView: React.FC<{ value: any; fieldConfig: any }> = ({ value, fieldConfig }) => {
  // CDN / server URL
  if (typeof value === 'string' && value.startsWith('http')) {
    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(value);
    const isPdf = /\.pdf(\?.*)?$/i.test(value);
    const fileName = decodeURIComponent(value.split('/').pop()?.split('?')[0] || 'file');
    return (
      <div className="space-y-1">
        {isImage && (
          <img src={value} alt={fileName} className="max-h-48 max-w-full rounded border object-contain" />
        )}
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
        >
          <Download className="h-3 w-3" />
          {isPdf ? `${fileName} (PDF)` : fileName}
        </a>
      </div>
    );
  }

  // Base64 / dataUrl file object
  if (value && typeof value === 'object' && value.dataUrl) {
    const isImage = value.mimeType?.startsWith('image/');
    const isPdf = value.mimeType === 'application/pdf';
    const name: string = value.fileName || value.originalName || 'file';
    return (
      <div className="space-y-1">
        {isImage && (
          <img src={value.dataUrl} alt={name} className="max-h-48 max-w-full rounded border object-contain" />
        )}
        <a
          href={value.dataUrl}
          download={name}
          className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
        >
          <Download className="h-3 w-3" />
          {isPdf ? `${name} (PDF)` : name}
        </a>
      </div>
    );
  }

  // File field with no value
  if (fieldConfig?.type === 'file') {
    return <span className="text-muted-foreground italic text-xs">No file uploaded</span>;
  }

  return <span className="text-sm">{formatFieldValue(value)}</span>;
};

// --- main component ---

const ApplicationFormDataView: React.FC<ApplicationFormDataViewProps> = ({ formData, formConfig }) => {
  if (!formData || typeof formData !== 'object') {
    return (
      <div className="text-center py-8">
        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">No form data found for this application.</p>
      </div>
    );
  }

  const getFieldConfig = (fieldKey: string): any | null => {
    if (!formConfig?.pages) return null;
    for (const page of formConfig.pages) {
      const fieldsToCheck = [...(page.fields || [])];
      if (page.sections) {
        for (const section of page.sections) {
          if (section.fields) fieldsToCheck.push(...section.fields);
        }
      }
      const fieldKeyNumber = fieldKey.match(/field_(\d+)/)?.[1];
      const field = fieldsToCheck.find((f: any) => {
        const fieldIdStr = String(f.id);
        return (
          fieldIdStr === fieldKeyNumber ||
          f.id === parseInt(fieldKeyNumber || '0', 10)
        );
      });
      if (field) return field;
    }
    return null;
  };

  const getFieldLabel = (fieldKey: string): string => {
    const config = getFieldConfig(fieldKey);
    if (config?.label) return config.label;
    // Fallback: clean up key
    if (/^field_\d+$/i.test(fieldKey)) {
      const num = fieldKey.match(/\d+/)?.[0];
      return num ? `Field ${num}` : fieldKey;
    }
    return fieldKey
      .replace(/field_/gi, '')
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ') || fieldKey;
  };

  const entries = Object.entries(formData).filter(
    ([key]) => !['_id', '__v', 'id'].includes(key) && !key.endsWith('__rowMeta'),
  );

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">No form fields were filled.</p>
      </div>
    );
  }

  const regularEntries: [string, any][] = [];
  const tableEntries: [string, any][] = [];

  for (const entry of entries) {
    const config = getFieldConfig(entry[0]);
    if (
      config?.type === 'row' ||
      config?.type === 'column' ||
      Array.isArray(entry[1]) ||
      isFlatTableObject(entry[1])
    ) {
      tableEntries.push(entry);
    } else {
      regularEntries.push(entry);
    }
  }

  // Group by page if formConfig has multiple pages
  const pages: { title: string; regularEntries: [string, any][]; tableEntries: [string, any][] }[] = [];

  if (formConfig?.pages && formConfig.pages.length > 1) {
    for (const page of formConfig.pages) {
      const pageFields = new Set<string>();
      const fieldsToCheck = [...(page.fields || [])];
      if (page.sections) {
        for (const section of page.sections) {
          if (section.fields) fieldsToCheck.push(...section.fields);
        }
      }
      for (const f of fieldsToCheck) {
        pageFields.add(`field_${f.id}`);
      }

      const pageRegular = regularEntries.filter(([k]) => pageFields.has(k));
      const pageTable = tableEntries.filter(([k]) => pageFields.has(k));
      if (pageRegular.length > 0 || pageTable.length > 0) {
        pages.push({ title: page.title || `Page ${page.order || pages.length + 1}`, regularEntries: pageRegular, tableEntries: pageTable });
      }
    }
    // Unmapped entries go to a catch-all section
    const mappedKeys = new Set(pages.flatMap(p => [...p.regularEntries, ...p.tableEntries].map(([k]) => k)));
    const unmappedRegular = regularEntries.filter(([k]) => !mappedKeys.has(k));
    const unmappedTable = tableEntries.filter(([k]) => !mappedKeys.has(k));
    if (unmappedRegular.length > 0 || unmappedTable.length > 0) {
      pages.push({ title: 'Other Details', regularEntries: unmappedRegular, tableEntries: unmappedTable });
    }
  } else {
    pages.push({ title: '', regularEntries, tableEntries });
  }

  return (
    <div className="space-y-6">
      {pages.map((page, pi) => (
        <div key={pi} className="space-y-4">
          {page.title && (
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">
              {page.title}
            </h3>
          )}

          {/* Regular fields in 2-col grid */}
          {page.regularEntries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {page.regularEntries.map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{getFieldLabel(key)}</p>
                  <div className="text-sm bg-muted/50 border rounded-md p-2 break-words min-h-[2rem]">
                    <FieldValueView value={value} fieldConfig={getFieldConfig(key)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table fields full width */}
          {page.tableEntries.map(([key, value]) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{getFieldLabel(key)}</p>
              <TableValueView value={value} fieldConfig={getFieldConfig(key)} fieldKey={key} formData={formData} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ApplicationFormDataView;
