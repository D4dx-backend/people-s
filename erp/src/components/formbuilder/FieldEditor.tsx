import { Trash2, Settings, ChevronDown, ChevronUp, Zap, Target, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { 
  type ScoringRule, 
  SCORING_CONDITIONS_BY_TYPE, 
  isScorableType, 
  isOptionBasedType, 
  NON_SCORABLE_TYPES 
} from "@/types/formBuilder";

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
  scoring?: {
    enabled: boolean;
    maxPoints: number;
    scoringRules: ScoringRule[];
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
  const [showScoring, setShowScoring] = useState(false);

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

                  {/* Editable Table Preview - click headers/row labels to edit */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Click on column headers and row labels to edit</Label>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted">
                            <th className="border-r border-b p-0 text-left font-medium text-muted-foreground w-[100px]"></th>
                            {Array.from({ length: field.columns || 2 }, (_, i) => (
                              <th key={i} className="border-r border-b p-0 text-left font-medium">
                                <input
                                  type="text"
                                  value={field.columnTitles?.[i] || ""}
                                  onChange={(e) => {
                                    const titles = [...(field.columnTitles || Array(field.columns || 2).fill(""))];
                                    titles[i] = e.target.value;
                                    onUpdate({ ...field, columnTitles: titles });
                                  }}
                                  placeholder={`Column ${i + 1}`}
                                  className="w-full h-8 px-1.5 bg-transparent text-xs font-medium outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 rounded-none"
                                />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: field.rows || 3 }, (_, r) => (
                            <tr key={r} className={r % 2 === 0 ? "" : "bg-muted/30"}>
                              <td className="border-r border-b p-0 font-medium text-muted-foreground bg-muted/50 w-[100px]">
                                <input
                                  type="text"
                                  value={field.rowTitles?.[r] || ""}
                                  onChange={(e) => {
                                    const titles = [...(field.rowTitles || Array(field.rows || 3).fill(""))];
                                    titles[r] = e.target.value;
                                    onUpdate({ ...field, rowTitles: titles });
                                  }}
                                  placeholder={`Row ${r + 1}`}
                                  className="w-full h-7 px-1.5 bg-transparent text-xs font-medium outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 text-muted-foreground rounded-none"
                                />
                              </td>
                              {Array.from({ length: field.columns || 2 }, (_, c) => (
                                <td key={c} className="border-r border-b p-1">
                                  <div className="h-5 bg-background rounded border border-dashed border-muted-foreground/20 flex items-center px-1.5">
                                    <span className="text-[10px] text-muted-foreground/40 truncate">
                                      {field.placeholder || `Enter ${field.columnTitles?.[c] || `value`}`}
                                    </span>
                                  </div>
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
                {isScorableType(field.type) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 text-xs ${field.scoring?.enabled ? 'border-green-500 text-green-700 bg-green-50' : ''}`}
                    onClick={() => setShowScoring(!showScoring)}
                  >
                    <Target className="h-3 w-3 mr-1" />
                    Scoring {field.scoring?.enabled ? `(${field.scoring.maxPoints} pts)` : ''}
                  </Button>
                )}
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

              {showScoring && isScorableType(field.type) && (
                <div className="space-y-3 p-3 border rounded-md bg-green-50/50 border-green-200 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-green-800">Scoring Rules</Label>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-green-700">Enable</label>
                      <Switch
                        checked={field.scoring?.enabled || false}
                        onCheckedChange={(enabled) => {
                          const scoring = field.scoring || { enabled: false, maxPoints: 0, scoringRules: [] };
                          onUpdate({ ...field, scoring: { ...scoring, enabled } });
                        }}
                        className="scale-75"
                      />
                    </div>
                  </div>

                  {field.scoring?.enabled && (
                    <div className="space-y-3">
                      {/* Max Points */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Max Points:</Label>
                        <Input
                          type="number"
                          min="0"
                          value={field.scoring?.maxPoints || 0}
                          onChange={(e) => {
                            const scoring = field.scoring || { enabled: true, maxPoints: 0, scoringRules: [] };
                            onUpdate({ ...field, scoring: { ...scoring, maxPoints: Math.max(0, parseInt(e.target.value) || 0) } });
                          }}
                          className="h-7 w-20 text-xs"
                        />
                      </div>

                      {/* Option-based scoring (auto-generated for select/radio/dropdown/multiselect/yesno/checkbox) */}
                      {isOptionBasedType(field.type) && field.type !== 'yesno' && field.type !== 'checkbox' && (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-green-700">Points per Option</Label>
                          {(field.options || []).map((option, idx) => {
                            const optionStr = typeof option === 'object' ? (option as any).label || String(option) : String(option);
                            const existingRule = field.scoring?.scoringRules?.find(
                              r => r.value === optionStr && (r.condition === 'equals' || r.condition === 'includes')
                            );
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs flex-1 truncate">{optionStr}</span>
                                <Input
                                  type="number"
                                  min="0"
                                  value={existingRule?.points || 0}
                                  onChange={(e) => {
                                    const points = Math.max(0, parseInt(e.target.value) || 0);
                                    const scoring = field.scoring || { enabled: true, maxPoints: 0, scoringRules: [] };
                                    const condition = field.type === 'multiselect' ? 'includes' : 'equals';
                                    const rules = [...(scoring.scoringRules || [])];
                                    const existIdx = rules.findIndex(r => r.value === optionStr && (r.condition === 'equals' || r.condition === 'includes'));
                                    if (existIdx >= 0) {
                                      rules[existIdx] = { ...rules[existIdx], points };
                                    } else {
                                      rules.push({ condition, value: optionStr, points });
                                    }
                                    onUpdate({ ...field, scoring: { ...scoring, scoringRules: rules } });
                                  }}
                                  className="h-7 w-16 text-xs"
                                  placeholder="pts"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Yes/No scoring */}
                      {field.type === 'yesno' && (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-green-700">Points per Answer</Label>
                          {['Yes', 'No'].map((answer) => {
                            const existingRule = field.scoring?.scoringRules?.find(r => r.value === answer.toLowerCase());
                            return (
                              <div key={answer} className="flex items-center gap-2">
                                <span className="text-xs flex-1">{answer}</span>
                                <Input
                                  type="number"
                                  min="0"
                                  value={existingRule?.points || 0}
                                  onChange={(e) => {
                                    const points = Math.max(0, parseInt(e.target.value) || 0);
                                    const scoring = field.scoring || { enabled: true, maxPoints: 0, scoringRules: [] };
                                    const rules = [...(scoring.scoringRules || [])];
                                    const existIdx = rules.findIndex(r => r.value === answer.toLowerCase());
                                    if (existIdx >= 0) {
                                      rules[existIdx] = { ...rules[existIdx], points };
                                    } else {
                                      rules.push({ condition: 'equals' as const, value: answer.toLowerCase(), points });
                                    }
                                    onUpdate({ ...field, scoring: { ...scoring, scoringRules: rules } });
                                  }}
                                  className="h-7 w-16 text-xs"
                                  placeholder="pts"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Checkbox scoring */}
                      {field.type === 'checkbox' && (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-green-700">Points</Label>
                          {['Checked', 'Unchecked'].map((state) => {
                            const boolVal = state === 'Checked' ? 'true' : 'false';
                            const existingRule = field.scoring?.scoringRules?.find(r => r.value === boolVal);
                            return (
                              <div key={state} className="flex items-center gap-2">
                                <span className="text-xs flex-1">{state}</span>
                                <Input
                                  type="number"
                                  min="0"
                                  value={existingRule?.points || 0}
                                  onChange={(e) => {
                                    const points = Math.max(0, parseInt(e.target.value) || 0);
                                    const scoring = field.scoring || { enabled: true, maxPoints: 0, scoringRules: [] };
                                    const rules = [...(scoring.scoringRules || [])];
                                    const existIdx = rules.findIndex(r => r.value === boolVal);
                                    if (existIdx >= 0) {
                                      rules[existIdx] = { ...rules[existIdx], points };
                                    } else {
                                      rules.push({ condition: 'equals' as const, value: boolVal, points });
                                    }
                                    onUpdate({ ...field, scoring: { ...scoring, scoringRules: rules } });
                                  }}
                                  className="h-7 w-16 text-xs"
                                  placeholder="pts"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Rule-based scoring for number/text/date/file etc. */}
                      {!isOptionBasedType(field.type) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-green-700">Rules <span className="font-normal text-green-600">({field.type === 'number' ? 'all matches add up' : 'first match wins'})</span></Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-green-700"
                              onClick={() => {
                                const scoring = field.scoring || { enabled: true, maxPoints: 0, scoringRules: [] };
                                const conditions = SCORING_CONDITIONS_BY_TYPE[field.type] || [{ value: 'is_not_empty', label: 'Is filled' }];
                                const newRule: ScoringRule = {
                                  condition: conditions[0].value as ScoringRule['condition'],
                                  value: '',
                                  points: 0
                                };
                                onUpdate({ ...field, scoring: { ...scoring, scoringRules: [...(scoring.scoringRules || []), newRule] } });
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Rule
                            </Button>
                          </div>
                          
                          {/* Column headers */}
                          {field.scoring?.scoringRules && field.scoring.scoringRules.length > 0 && (
                            <div className="grid grid-cols-[1fr_1fr_80px_28px] gap-1 px-2 pb-0.5">
                              <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Condition</span>
                              <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Value</span>
                              <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide text-center">Points</span>
                              <span />
                            </div>
                          )}

                          {(field.scoring?.scoringRules || []).map((rule, ruleIdx) => {
                            const conditions = SCORING_CONDITIONS_BY_TYPE[field.type] || [];
                            const needsValue = rule.condition !== 'is_not_empty' && rule.condition !== 'is_uploaded';
                            const isBetween = rule.condition === 'between';
                            return (
                              <div key={ruleIdx} className="grid grid-cols-[1fr_1fr_80px_28px] gap-1 items-center p-2 border rounded bg-white">
                                {/* Condition */}
                                <Select
                                  value={rule.condition}
                                  onValueChange={(condition) => {
                                    const scoring = { ...field.scoring! };
                                    const rules = [...scoring.scoringRules];
                                    rules[ruleIdx] = { ...rules[ruleIdx], condition: condition as ScoringRule['condition'] };
                                    onUpdate({ ...field, scoring: { ...scoring, scoringRules: rules } });
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {conditions.map(c => (
                                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {/* Value (single or between range) */}
                                <div className="flex items-center gap-1">
                                  {needsValue ? (
                                    <Input
                                      type={['number', 'date', 'datetime'].includes(field.type) && !['contains', 'equals'].includes(rule.condition) ? (field.type === 'number' ? 'number' : 'date') : 'text'}
                                      value={rule.value || ''}
                                      onChange={(e) => {
                                        const scoring = { ...field.scoring! };
                                        const rules = [...scoring.scoringRules];
                                        rules[ruleIdx] = { ...rules[ruleIdx], value: e.target.value };
                                        onUpdate({ ...field, scoring: { ...scoring, scoringRules: rules } });
                                      }}
                                      placeholder={isBetween ? 'From' : 'Value'}
                                      className="h-7 text-xs flex-1 min-w-0"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic px-1">—</span>
                                  )}
                                  {isBetween && (
                                    <Input
                                      type={field.type === 'number' ? 'number' : 'date'}
                                      value={rule.value2 || ''}
                                      onChange={(e) => {
                                        const scoring = { ...field.scoring! };
                                        const rules = [...scoring.scoringRules];
                                        rules[ruleIdx] = { ...rules[ruleIdx], value2: e.target.value };
                                        onUpdate({ ...field, scoring: { ...scoring, scoringRules: rules } });
                                      }}
                                      placeholder="To"
                                      className="h-7 text-xs flex-1 min-w-0"
                                    />
                                  )}
                                </div>

                                {/* Points */}
                                <Input
                                  type="number"
                                  min="0"
                                  value={rule.points}
                                  onChange={(e) => {
                                    const scoring = { ...field.scoring! };
                                    const rules = [...scoring.scoringRules];
                                    rules[ruleIdx] = { ...rules[ruleIdx], points: Math.max(0, parseInt(e.target.value) || 0) };
                                    onUpdate({ ...field, scoring: { ...scoring, scoringRules: rules } });
                                  }}
                                  className="h-7 text-xs text-center"
                                  placeholder="0"
                                />

                                {/* Delete */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => {
                                    const scoring = { ...field.scoring! };
                                    const rules = [...scoring.scoringRules];
                                    rules.splice(ruleIdx, 1);
                                    onUpdate({ ...field, scoring: { ...scoring, scoringRules: rules } });
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}

                          {(!field.scoring?.scoringRules || field.scoring.scoringRules.length === 0) && (
                            <p className="text-xs text-muted-foreground italic px-2">No rules added. Click "+ Add Rule" above.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
