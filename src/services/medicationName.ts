// Finds a medication's name in a FHIR MedicationRequest.
// Epic can put the name in a few places: a coded concept, its text, or a reference to a
// Medication resource (where the display name is often the only text). Returns '' when none is found.
export function medicationNameFrom(request: any): string {
  return (
    request?.medicationCodeableConcept?.coding?.[0]?.display ||
    request?.medicationCodeableConcept?.text ||
    request?.medicationReference?.display ||
    ''
  );
}
