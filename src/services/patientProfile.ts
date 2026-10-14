// Converts Epic's patient demographics into the formats the health snapshot uses.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// FHIR birthDate "1987-09-12" -> health snapshot format "September 12, 1987"
export function birthdayFromFhir(birthDate?: string): string {
  const match = birthDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const month = MONTHS[parseInt(match[2], 10) - 1];
  if (!month) return '';
  return `${month} ${parseInt(match[3], 10)}, ${match[1]}`;
}

// FHIR gender "female" -> "Female". Anything unknown returns '' so it isn't guessed.
export function genderFromFhir(gender?: string): string {
  switch ((gender || '').toLowerCase()) {
    case 'male':
      return 'Male';
    case 'female':
      return 'Female';
    case 'other':
      return 'Other';
    default:
      return '';
  }
}
