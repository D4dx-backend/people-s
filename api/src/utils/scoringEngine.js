/**
 * Scoring Engine - Calculates eligibility scores for applications
 * based on form configuration scoring rules.
 * 
 * Evaluates each field's submitted value against its scoring rules
 * and returns a total score with per-field breakdown.
 */

// Field types that are not scorable (layout/display elements)
const NON_SCORABLE_TYPES = ['title', 'html', 'page', 'group', 'row', 'column'];

/**
 * Evaluate a single field's value against its scoring rules.
 * Returns the points earned and which rule was applied.
 * 
 * @param {any} value - The submitted field value
 * @param {Object} field - The field configuration with scoring rules
 * @returns {{ earnedPoints: number, appliedRule: string }}
 */
function evaluateField(value, field) {
  const { type, scoring } = field;
  
  if (!scoring?.enabled || !scoring.scoringRules || scoring.scoringRules.length === 0) {
    return { earnedPoints: 0, appliedRule: 'No scoring rules' };
  }

  const rules = scoring.scoringRules;

  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    // Check if there's a rule for empty values
    const emptyRule = rules.find(r => r.condition === 'equals' && (r.value === '' || r.value === null));
    if (emptyRule) {
      return { earnedPoints: emptyRule.points, appliedRule: `Empty value matched` };
    }
    return { earnedPoints: 0, appliedRule: 'No value provided' };
  }

  switch (type) {
    case 'number': {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return { earnedPoints: 0, appliedRule: 'Invalid number' };

      // Evaluate rules top-to-bottom, first match wins
      for (const rule of rules) {
        const ruleValue = parseFloat(rule.value);
        const ruleValue2 = rule.value2 ? parseFloat(rule.value2) : null;

        switch (rule.condition) {
          case 'greater_than':
            if (numValue > ruleValue) return { earnedPoints: rule.points, appliedRule: `> ${ruleValue}` };
            break;
          case 'less_than':
            if (numValue < ruleValue) return { earnedPoints: rule.points, appliedRule: `< ${ruleValue}` };
            break;
          case 'between':
            if (ruleValue2 !== null && numValue >= ruleValue && numValue <= ruleValue2) {
              return { earnedPoints: rule.points, appliedRule: `${ruleValue} - ${ruleValue2}` };
            }
            break;
          case 'equals':
            if (numValue === ruleValue) return { earnedPoints: rule.points, appliedRule: `= ${ruleValue}` };
            break;
        }
      }
      return { earnedPoints: 0, appliedRule: 'No matching rule' };
    }

    case 'select':
    case 'dropdown':
    case 'radio': {
      const strValue = String(value).trim();
      for (const rule of rules) {
        if (rule.condition === 'equals' && String(rule.value).trim() === strValue) {
          return { earnedPoints: rule.points, appliedRule: `Selected: ${strValue}` };
        }
      }
      return { earnedPoints: 0, appliedRule: 'No matching option' };
    }

    case 'yesno': {
      const yesNoValue = String(value).toLowerCase();
      const isYes = yesNoValue === 'yes' || yesNoValue === 'true' || yesNoValue === '1';
      for (const rule of rules) {
        const ruleIsYes = String(rule.value).toLowerCase() === 'yes' || String(rule.value).toLowerCase() === 'true';
        if (rule.condition === 'equals') {
          if ((ruleIsYes && isYes) || (!ruleIsYes && !isYes)) {
            return { earnedPoints: rule.points, appliedRule: `${isYes ? 'Yes' : 'No'}` };
          }
        }
      }
      return { earnedPoints: 0, appliedRule: 'No matching rule' };
    }

    case 'multiselect': {
      // For multiselect, sum points for all selected options that have rules
      let totalPoints = 0;
      const matchedOptions = [];
      const selectedValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());

      for (const rule of rules) {
        if (rule.condition === 'includes' || rule.condition === 'equals') {
          if (selectedValues.some(sv => String(sv).trim() === String(rule.value).trim())) {
            totalPoints += rule.points;
            matchedOptions.push(rule.value);
          }
        }
      }
      return { 
        earnedPoints: Math.min(totalPoints, scoring.maxPoints || totalPoints), 
        appliedRule: matchedOptions.length > 0 ? `Selected: ${matchedOptions.join(', ')}` : 'No matching options' 
      };
    }

    case 'checkbox': {
      const isChecked = value === true || value === 'true' || value === 'on' || value === '1' || value === 'yes';
      for (const rule of rules) {
        const ruleChecked = String(rule.value).toLowerCase() === 'true' || String(rule.value).toLowerCase() === 'yes' || String(rule.value).toLowerCase() === 'checked';
        if (rule.condition === 'equals') {
          if ((ruleChecked && isChecked) || (!ruleChecked && !isChecked)) {
            return { earnedPoints: rule.points, appliedRule: `${isChecked ? 'Checked' : 'Unchecked'}` };
          }
        }
      }
      return { earnedPoints: 0, appliedRule: 'No matching rule' };
    }

    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url':
    case 'password': {
      const strValue = String(value).trim();
      for (const rule of rules) {
        switch (rule.condition) {
          case 'is_not_empty':
            if (strValue.length > 0) return { earnedPoints: rule.points, appliedRule: 'Field is filled' };
            break;
          case 'equals':
            if (strValue === String(rule.value).trim()) return { earnedPoints: rule.points, appliedRule: `Equals: ${rule.value}` };
            break;
          case 'contains':
            if (strValue.toLowerCase().includes(String(rule.value).toLowerCase())) {
              return { earnedPoints: rule.points, appliedRule: `Contains: ${rule.value}` };
            }
            break;
        }
      }
      return { earnedPoints: 0, appliedRule: 'No matching rule' };
    }

    case 'date':
    case 'datetime': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return { earnedPoints: 0, appliedRule: 'Invalid date' };

      for (const rule of rules) {
        const ruleDate = new Date(rule.value);
        const ruleDate2 = rule.value2 ? new Date(rule.value2) : null;

        switch (rule.condition) {
          case 'before':
            if (dateValue < ruleDate) return { earnedPoints: rule.points, appliedRule: `Before ${rule.value}` };
            break;
          case 'after':
            if (dateValue > ruleDate) return { earnedPoints: rule.points, appliedRule: `After ${rule.value}` };
            break;
          case 'between':
            if (ruleDate2 && dateValue >= ruleDate && dateValue <= ruleDate2) {
              return { earnedPoints: rule.points, appliedRule: `Between ${rule.value} and ${rule.value2}` };
            }
            break;
          case 'equals': {
            // Date equality — compare date portion only
            const d1 = dateValue.toISOString().split('T')[0];
            const d2 = ruleDate.toISOString().split('T')[0];
            if (d1 === d2) return { earnedPoints: rule.points, appliedRule: `Equals ${rule.value}` };
            break;
          }
        }
      }
      return { earnedPoints: 0, appliedRule: 'No matching rule' };
    }

    case 'time': {
      const strValue = String(value).trim();
      for (const rule of rules) {
        if (rule.condition === 'is_not_empty' && strValue.length > 0) {
          return { earnedPoints: rule.points, appliedRule: 'Time provided' };
        }
        if (rule.condition === 'equals' && strValue === String(rule.value).trim()) {
          return { earnedPoints: rule.points, appliedRule: `Time: ${rule.value}` };
        }
      }
      return { earnedPoints: 0, appliedRule: 'No matching rule' };
    }

    case 'file': {
      // Check if file is uploaded (value is truthy — could be URL string or object)
      const isUploaded = !!value && value !== '' && value !== null;
      for (const rule of rules) {
        if (rule.condition === 'is_uploaded' && isUploaded) {
          return { earnedPoints: rule.points, appliedRule: 'File uploaded' };
        }
      }
      return { earnedPoints: 0, appliedRule: isUploaded ? 'No matching rule' : 'No file uploaded' };
    }

    default:
      return { earnedPoints: 0, appliedRule: `Unsupported type: ${type}` };
  }
}

/**
 * Calculate the complete eligibility score for an application.
 * 
 * @param {Object} formData - The submitted form data (e.g., { field_1: "value", field_2: 42 })
 * @param {Object} formConfig - The form configuration document with pages, fields, and scoring rules
 * @returns {Object} Score result with totalPoints, maxPoints, percentage, fieldScores, meetsThreshold
 */
function calculateApplicationScore(formData, formConfig) {
  // Default result when scoring is not enabled
  const defaultResult = {
    totalPoints: 0,
    maxPoints: 0,
    percentage: 0,
    fieldScores: [],
    meetsThreshold: true,
    threshold: 0,
    autoRejected: false,
    calculatedAt: new Date()
  };

  if (!formConfig?.scoringConfig?.enabled) {
    return defaultResult;
  }

  if (!formData || !formConfig?.pages) {
    return defaultResult;
  }

  const fieldScores = [];
  let totalEarnedPoints = 0;
  let totalMaxPoints = 0;

  // Iterate all pages and fields
  for (const page of formConfig.pages) {
    if (!page.fields) continue;

    for (const field of page.fields) {
      // Skip non-scorable types and fields without scoring enabled
      if (NON_SCORABLE_TYPES.includes(field.type)) continue;
      if (!field.scoring?.enabled) continue;
      if (!field.scoring.maxPoints || field.scoring.maxPoints <= 0) continue;

      const fieldKey = `field_${field.id}`;
      const fieldValue = formData[fieldKey];

      const { earnedPoints, appliedRule } = evaluateField(fieldValue, field);

      // Cap earned points at maxPoints for the field
      const cappedPoints = Math.min(earnedPoints, field.scoring.maxPoints);

      fieldScores.push({
        fieldId: field.id,
        fieldLabel: field.label,
        earnedPoints: cappedPoints,
        maxPoints: field.scoring.maxPoints,
        appliedRule,
        answerValue: fieldValue
      });

      totalEarnedPoints += cappedPoints;
      totalMaxPoints += field.scoring.maxPoints;
    }
  }

  const percentage = totalMaxPoints > 0 
    ? Math.round((totalEarnedPoints / totalMaxPoints) * 10000) / 100 // 2 decimal places
    : 0;

  const threshold = formConfig.scoringConfig.minimumThreshold || 0;
  const meetsThreshold = threshold === 0 || percentage >= threshold;
  const autoRejected = formConfig.scoringConfig.autoRejectBelowThreshold && !meetsThreshold;

  return {
    totalPoints: totalEarnedPoints,
    maxPoints: totalMaxPoints,
    percentage,
    fieldScores,
    meetsThreshold,
    threshold,
    autoRejected,
    calculatedAt: new Date()
  };
}

module.exports = {
  calculateApplicationScore,
  evaluateField,
  NON_SCORABLE_TYPES
};
