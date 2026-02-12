import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { FileUploadField } from "./FileUploadField";

interface Field {
  id: number;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  options?: string[];
  columns?: number;
  columnTitles?: string[];
  rows?: number;
  rowTitles?: string[];
}

interface Page {
  id: number;
  title: string;
  fields: Field[];
}

interface FormPreviewProps {
  formTitle: string;
  formDescription: string;
  pages: Page[];
  schemeId?: string;
  isLiveForm?: boolean;
}

export function FormPreview({ formTitle, formDescription, pages, schemeId, isLiveForm = false }: FormPreviewProps) {
  const renderField = (field: Field) => {
    if (!field.enabled) return null;

    const label = (
      <Label className="text-sm">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
    );

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "number":
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <Input
              type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              disabled
            />
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <Textarea
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              disabled
              rows={3}
            />
          </div>
        );

      case "date":
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <Input type="date" disabled />
          </div>
        );

      case "yesno":
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <RadioGroup disabled>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`${field.id}-yes`} />
                <Label htmlFor={`${field.id}-yes`}>Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`${field.id}-no`} />
                <Label htmlFor={`${field.id}-no`}>No</Label>
              </div>
            </RadioGroup>
          </div>
        );

      case "dropdown":
      case "multiselect":
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {(field.options || ["Option 1", "Option 2", "Option 3"]).map((opt, i) => (
                  <SelectItem key={i} value={opt.toLowerCase().replace(/\s+/g, "-")}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <RadioGroup disabled>
              {(field.options || ["Option 1", "Option 2"]).map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.toLowerCase()} id={`${field.id}-${i}`} />
                  <Label htmlFor={`${field.id}-${i}`}>{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "checkbox":
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <div className="space-y-2">
              {(field.options || ["Option 1", "Option 2"]).map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox id={`${field.id}-${i}`} disabled />
                  <Label htmlFor={`${field.id}-${i}`}>{opt}</Label>
                </div>
              ))}
            </div>
          </div>
        );

      case "file":
        if (isLiveForm && schemeId) {
          return (
            <FileUploadField
              key={field.id}
              label={field.label}
              required={field.required}
              placeholder={field.placeholder}
              formId={schemeId}
              fieldName={`field_${field.id}`}
              multiple={true}
              maxFiles={10}
            />
          );
        }
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <Input type="file" disabled />
            <p className="text-xs text-muted-foreground">
              File upload will be functional in the live form
            </p>
          </div>
        );

      case "title":
        return (
          <div key={field.id} className="pt-2">
            <h3 className="text-lg font-semibold">{field.label}</h3>
            <Separator className="mt-2" />
          </div>
        );

      case "html":
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <div className="border rounded-md p-3 bg-muted/50 text-sm text-muted-foreground">
              Rich text editor content will appear here
            </div>
          </div>
        );

      case "group":
        return (
          <div key={field.id} className="border-l-2 border-primary pl-4 space-y-3">
            <h4 className="font-medium">{field.label}</h4>
          </div>
        );

      case "page":
        return (
          <div key={field.id} className="py-4">
            <Separator />
            <p className="text-sm text-center text-muted-foreground mt-2">Page Break</p>
          </div>
        );

      case "row":
      case "column": {
        const colCount = field.columns || 2;
        const rowCount = field.rows || 3;
        const hasRowLabels = field.rowTitles?.some(t => t) ?? false;
        return (
          <div key={field.id} className="space-y-2">
            {field.label && field.label !== "New row Field" && (
              <Label className="text-sm font-medium">{field.label}</Label>
            )}
            <div className="border rounded-md overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    {hasRowLabels && <th className="border-r border-b p-2 text-left font-medium text-xs"></th>}
                    {Array.from({ length: colCount }, (_, i) => (
                      <th key={i} className="border-r border-b p-2 text-left font-medium text-xs">
                        {field.columnTitles?.[i] || `Column ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }, (_, r) => (
                    <tr key={r} className={r % 2 === 0 ? "" : "bg-muted/30"}>
                      {hasRowLabels && (
                        <td className="border-r border-b p-2 font-medium text-xs text-muted-foreground bg-muted/50 whitespace-nowrap">
                          {field.rowTitles?.[r] || `Row ${r + 1}`}
                        </td>
                      )}
                      {Array.from({ length: colCount }, (_, c) => (
                        <td key={c} className="border-r border-b p-1.5">
                          <Input disabled placeholder="..." className="h-7 text-xs" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      default:
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <Input placeholder={field.placeholder} disabled />
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formTitle}</CardTitle>
        {formDescription && (
          <p className="text-sm text-muted-foreground">{formDescription}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {pages.map((page, pageIdx) => (
          <div key={page.id} className="space-y-4">
            {pages.length > 1 && (
              <div className="pb-2">
                <h3 className="font-semibold text-primary">
                  {page.title || `Page ${pageIdx + 1}`}
                </h3>
                <Separator className="mt-2" />
              </div>
            )}
            {page.fields.filter(f => f.enabled).map(renderField)}
          </div>
        ))}
        <Button className="w-full bg-gradient-primary" disabled>
          Submit Application
        </Button>
      </CardContent>
    </Card>
  );
}
