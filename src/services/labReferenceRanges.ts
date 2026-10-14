// Typical adult reference ranges, used only when neither the lab report nor Epic gives one.
// Labs differ, so the range printed on the report always wins. Every range is labelled "typical"
// in the app.
//
// Ranges are chosen from the patient's profile on the health snapshot:
// - No range is shown for anyone under 18, or when the birthday isn't set.
// - Sex-based ranges are shown only for Male or Female. "Other" or unset gets no sex-based range.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Rule {
  match: RegExp;
  any?: string; // same range for everyone
  male?: string;
  female?: string;
}

const RULES: Rule[] = [
  // Hemoglobin A1C: below 5.7% is normal; 5.7–6.4% is the prediabetes range
  { match: /a1c|hba1c|glycated hemoglobin|glycohemoglobin/i, any: 'Below 5.7% (typical adult)' },
  // Fasting glucose
  { match: /^(fasting )?glucose$/i, any: '70–99 mg/dL (typical adult, fasting)' },
  // Total cholesterol
  { match: /^(total )?cholesterol$/i, any: 'Below 200 mg/dL (typical adult)' },
  // LDL cholesterol
  { match: /^ldl/i, any: 'Below 100 mg/dL (typical adult, optimal)' },
  // HDL cholesterol
  { match: /^hdl/i, male: 'Above 40 mg/dL (typical adult man)', female: 'Above 50 mg/dL (typical adult woman)' },
  // Triglycerides
  { match: /triglyceride/i, any: 'Below 150 mg/dL (typical adult, fasting)' },
  // Sodium
  { match: /^sodium$/i, any: '135–145 mmol/L (typical adult)' },
  // TSH
  { match: /^tsh\b|thyroid stimulating/i, any: '0.4–4.0 mIU/L (typical adult)' },
  // Hemoglobin (men only; the female adult range is not yet verified against a source)
  { match: /^(hemoglobin|hgb)$/i, male: '13.2–16.6 g/dL (typical adult man)' },
  // Hematocrit (men only; the female adult range is not yet verified against a source)
  { match: /^(hematocrit|hct)$/i, male: '38.3–48.6% (typical adult man)' },
  // Creatinine
  { match: /^creatinine/i, male: '0.74–1.35 mg/dL (typical adult man)', female: '0.59–1.04 mg/dL (typical adult woman)' },
];

// "January 15, 1980" -> age in whole years
export function patientAge(birthday?: string, today: Date = new Date()): number | undefined {
  if (!birthday) return undefined;
  const parts = birthday.replace(',', '').trim().split(/\s+/);
  const month = MONTHS.indexOf(parts[0]);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (month < 0 || isNaN(day) || isNaN(year)) return undefined;

  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() < month || (today.getMonth() === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

// Checks "female" and "woman" first, because "female" also contains "male"
export function patientSex(gender?: string): 'male' | 'female' | undefined {
  const g = (gender || '').toLowerCase();
  if (g.includes('female') || g.includes('woman')) return 'female';
  if (g.includes('male') || g.includes('man')) return 'male';
  return undefined;
}

export function typicalRangeFor(
  testName: string,
  patient: { gender?: string; birthday?: string },
  today: Date = new Date()
): string | undefined {
  const age = patientAge(patient.birthday, today);
  if (age === undefined || age < 18) return undefined;

  const rule = RULES.find((r) => r.match.test(testName.trim()));
  if (!rule) return undefined;
  if (rule.any) return rule.any;

  const sex = patientSex(patient.gender);
  if (sex === 'male') return rule.male;
  if (sex === 'female') return rule.female;
  return undefined;
}
