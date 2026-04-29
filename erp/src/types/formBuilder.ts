// Scoring rule for a single condition on a field
export interface ScoringRule {
  condition: 
    | 'equals' | 'not_equals' 
    | 'greater_than' | 'less_than' | 'between' 
    | 'contains' | 'is_not_empty' | 'is_uploaded' 
    | 'before' | 'after' | 'includes';
  value: string;
  value2?: string; // For 'between' condition
  points: number;
}

// Scoring configuration for a single field
export interface FieldScoring {
  enabled: boolean;
  maxPoints: number;
  scoringRules: ScoringRule[];
}

// Form field definition
export interface FormField {
  id: number;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    customMessage?: string;
  } | string;
  columns?: number;
  columnTitles?: string[];
  rows?: number;
  rowTitles?: string[];
  conditionalLogic?: {
    field: number;
    operator: string;
    value: string;
    action?: string;
  };
  scoring?: FieldScoring;
}

// Row metadata for dynamic row duplication in table fields
export interface RowMeta {
  sourceRow: number;       // Index into field.rowTitles (which original row this is based on)
  duplicateIndex: number;  // 0 = original row, 1+ = duplicate number
}

// Form page definition
export interface FormPage {
  id: number;
  title: string;
  description?: string;
  fields: FormField[];
  order?: number;
}

// Form-level scoring configuration
export interface FormScoringConfig {
  enabled: boolean;
  minimumThreshold: number;
  autoRejectBelowThreshold: boolean;
  showScoreToAdmin: boolean;
}

// Per-field score result (stored on application)
export interface FieldScoreResult {
  fieldId: number;
  fieldLabel: string;
  earnedPoints: number;
  maxPoints: number;
  appliedRule: string;
  answerValue: any;
}

// Complete eligibility score (stored on application)
export interface EligibilityScore {
  totalPoints: number;
  maxPoints: number;
  percentage: number;
  meetsThreshold: boolean;
  threshold: number;
  fieldScores: FieldScoreResult[];
  autoRejected: boolean;
  calculatedAt: string;
}

// Conditions available per field type for scoring
export const SCORING_CONDITIONS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  number: [
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' },
    { value: 'equals', label: 'Equals' },
  ],
  text: [
    { value: 'is_not_empty', label: 'Is filled' },
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
  ],
  textarea: [
    { value: 'is_not_empty', label: 'Is filled' },
    { value: 'contains', label: 'Contains' },
  ],
  email: [
    { value: 'is_not_empty', label: 'Is filled' },
  ],
  phone: [
    { value: 'is_not_empty', label: 'Is filled' },
  ],
  url: [
    { value: 'is_not_empty', label: 'Is filled' },
  ],
  select: [
    { value: 'equals', label: 'Option is' },
  ],
  dropdown: [
    { value: 'equals', label: 'Option is' },
  ],
  radio: [
    { value: 'equals', label: 'Option is' },
  ],
  yesno: [
    { value: 'equals', label: 'Answer is' },
  ],
  multiselect: [
    { value: 'includes', label: 'Includes option' },
  ],
  checkbox: [
    { value: 'equals', label: 'Is' },
  ],
  date: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
  ],
  datetime: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
  ],
  file: [
    { value: 'is_uploaded', label: 'Is uploaded' },
  ],
  time: [
    { value: 'is_not_empty', label: 'Is filled' },
  ],
};

// Field types that cannot have scoring
export const NON_SCORABLE_TYPES = ['title', 'html', 'page', 'group', 'row', 'column'];

// Check if a field type supports scoring
export function isScorableType(type: string): boolean {
  return !NON_SCORABLE_TYPES.includes(type);
}

// Check if field type uses per-option scoring (auto-generate rules from options)
export function isOptionBasedType(type: string): boolean {
  return ['select', 'dropdown', 'radio', 'multiselect', 'checkbox', 'yesno'].includes(type);
}

// Get the score percentage color class
export function getScoreColor(percentage: number): string {
  if (percentage >= 70) return 'text-green-600';
  if (percentage >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export function getScoreBgColor(percentage: number): string {
  if (percentage >= 70) return 'bg-green-100 text-green-700 border-green-200';
  if (percentage >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-red-100 text-red-700 border-red-200';
}
