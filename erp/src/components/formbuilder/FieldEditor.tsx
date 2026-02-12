import { Trash2, Settings, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

interface Field {
  id: number;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
  columns?: number;
  columnTitles?: string[];
  rows?: number;
  rowTitles?: string[];
  conditionalLogic?: {
    field: number;
    operator: string;
    value: string;
  };
}

interface FieldEditorProps {
  field: Field;
  onUpdate: (field: Field) => void;
  onDelete: (id: number) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  availableFields?: Field[];
}

export function FieldEditor({ field, onUpdate, onDelete, onMoveUp, onMoveDown, availableFields = [] }: FieldEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConditional, setShowConditional] = useState(false);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Compact Header Row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <Input
                value={field.label}
                onChange={(e) => onUpdate({ ...field, label: e.target.value })}
                placeholder="Field Label"
                className="h-8 text-sm"
              />
              <Select value={field.type} onValueChange={(type) => onUpdate({ ...field, type })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="textarea">Long Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="multiselect">Multi-Select</SelectItem>
                  <SelectItem value="radio">Radio</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                  <SelectItem value="title">Title/Heading</SelectItem>
                  {/* <SelectItem value="html">HTML Editor</SelectItem> */}
                  {/* <SelectItem value="group">Field Group</SelectItem> */}
                  <SelectItem value="row">Row/Column</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Req</label>
                <Switch
                  checked={field.required}
                  onCheckedChange={(required) => onUpdate({ ...field, required })}
                  className="scale-75"
                />
              </div>
              <div className="flex gap-1 ml-1">
                {onMoveUp && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                )}
                {onMoveDown && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  title="Advanced"
                >
                  <Settings className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-destructive"
                  onClick={() => onDelete(field.id)}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-2 pt-2 border-t animate-fade-in">
              <Input
                value={field.placeholder || ""}
                onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
                placeholder="Placeholder text"
                className="h-8 text-sm"
              />
              
              {(field.type === "select" || field.type === "multiselect" || field.type === "radio" || field.type === "checkbox") && (
                <Textarea
                  value={field.options?.join("\n") || ""}
                  onChange={(e) => onUpdate({ ...field, options: e.target.value.split("\n") })}
                  placeholder="Options (one per line)"
                  className="text-sm"
                  rows={3}
                />
              )}

              {field.type === "row" && (
                <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                  <Label className="text-xs font-semibold">Table Configuration</Label>

                  {/* Rows & Columns Count */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Columns:</Label>
                      <Input
                        type="number"
                        min="1"
                        value={field.columns || 2}
                        onChange={(e) => {
                          const cols = Math.max(1, parseInt(e.target.value) || 1);
                          const titles = field.columnTitles || [];
                          const newTitles = Array.from({ length: cols }, (_, i) => titles[i] || "");
                          onUpdate({ ...field, columns: cols, columnTitles: newTitles });
                        }}
                        className="h-8 w-20 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Rows:</Label>
                      <Input
                        type="number"
                        min="1"
                        value={field.rows || 3}
                        onChange={(e) => {
                          const rowCount = Math.max(1, parseInt(e.target.value) || 1);
                          const titles = field.rowTitles || [];
                          const newTitles = Array.from({ length: rowCount }, (_, i) => titles[i] || "");
                          onUpdate({ ...field, rows: rowCount, rowTitles: newTitles });
                        }}
                        className="h-8 w-20 text-sm"
                      />
                    </div>
                  </div>

                  {/* Column Headers */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Column Headers</Label>
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({ length: field.columns || 2 }, (_, i) => (
                        <Input
                          key={`col-${i}`}
                          value={field.columnTitles?.[i] || ""}
                          onChange={(e) => {
                            const titles = [...(field.columnTitles || Array(field.columns || 2).fill(""))];
                            titles[i] = e.target.value;
                            onUpdate({ ...field, columnTitles: titles });
                          }}
                          placeholder={`Column ${i + 1}`}
                          className="h-7 text-xs flex-1 min-w-[80px]"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Row Labels */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Row Labels (optional)</Label>
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({ length: field.rows || 3 }, (_, i) => (
                        <Input
                          key={`row-${i}`}
                          value={field.rowTitles?.[i] || ""}
                          onChange={(e) => {
                            const titles = [...(field.rowTitles || Array(field.rows || 3).fill(""))];
                            titles[i] = e.target.value;
                            onUpdate({ ...field, rowTitles: titles });
                          }}
                          placeholder={`Row ${i + 1}`}
                          className="h-7 text-xs flex-1 min-w-[80px]"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Table Preview */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Preview</Label>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted">
                            {(field.rowTitles?.some(t => t) ?? false) && (
                              <th className="border-r border-b p-1.5 text-left font-medium text-muted-foreground"></th>
                            )}
                            {Array.from({ length: field.columns || 2 }, (_, i) => (
                              <th key={i} className="border-r border-b p-1.5 text-left font-medium">
                                {field.columnTitles?.[i] || `Col ${i + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: field.rows || 3 }, (_, r) => (
                            <tr key={r} className={r % 2 === 0 ? "" : "bg-muted/30"}>
                              {(field.rowTitles?.some(t => t) ?? false) && (
                                <td className="border-r border-b p-1.5 font-medium text-muted-foreground bg-muted/50 whitespace-nowrap">
                                  {field.rowTitles?.[r] || `Row ${r + 1}`}
                                </td>
                              )}
                              {Array.from({ length: field.columns || 2 }, (_, c) => (
                                <td key={c} className="border-r border-b p-1">
                                  <div className="h-5 bg-background rounded border border-dashed border-muted-foreground/20"></div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowConditional(!showConditional)}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Conditional Logic
                </Button>
              </div>

              {showConditional && availableFields.length > 0 && (
                <div className="grid grid-cols-3 gap-2 p-2 border rounded-md bg-muted/50 animate-fade-in">
                  <Select
                    value={field.conditionalLogic?.field?.toString() || ""}
                    onValueChange={(value) => onUpdate({
                      ...field,
                      conditionalLogic: { ...field.conditionalLogic, field: parseInt(value), operator: "equals", value: "" }
                    })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()} className="text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={field.conditionalLogic?.operator || "equals"}
                    onValueChange={(operator) => onUpdate({
                      ...field,
                      conditionalLogic: { ...field.conditionalLogic!, operator, field: field.conditionalLogic?.field || 0, value: field.conditionalLogic?.value || "" }
                    })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals" className="text-xs">Equals</SelectItem>
                      <SelectItem value="notEquals" className="text-xs">Not Equals</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={field.conditionalLogic?.value || ""}
                    onChange={(e) => onUpdate({
                      ...field,
                      conditionalLogic: { ...field.conditionalLogic!, value: e.target.value, field: field.conditionalLogic?.field || 0, operator: field.conditionalLogic?.operator || "equals" }
                    })}
                    placeholder="Value"
                    className="h-7 text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
