import { MedicalRecord, ExtractedData } from '../types/medical';


export const claudeService = {
  async parseRecordFromText(
    text: string,
    recordId: string
  ): Promise<Partial<MedicalRecord>> {
    // Mock implementation - replace with real Claude API call via backend
    return {
      id: recordId,
      uploadDate: new Date().toISOString(),
      originalText: text,
      specialty: 'Primary Care',
      provider: 'General Practitioner',
      summary: 'Medical record uploaded. Connect to Claude API backend to extract real data.',
      reasonForVisit: 'Routine checkup and medication review',
      findings: 'Blood pressure elevated at 140/90, blood glucose slightly elevated at 145 mg/dL',
      nextSteps: 'Continue current medications, follow-up in 3 months, monitor blood pressure at home',
      extractedData: {
        medications: ['Lisinopril 10mg', 'Metformin 500mg'],
        allergies: ['Penicillin', 'Sulfa drugs'],
        conditions: ['Hypertension', 'Type 2 Diabetes'],
        testResults: { 'Blood Glucose': '145 mg/dL', 'BP': '140/90' },
        dates: { 'Visit Date': new Date().toLocaleDateString() },
      },
      processed: true,
    };
  },

  async parseRecordFromImage(
    base64Image: string,
    recordId: string
  ): Promise<Partial<MedicalRecord>> {
    // Mock implementation - replace with real Claude API call via backend
    return {
      id: recordId,
      uploadDate: new Date().toISOString(),
      imageUri: `data:image/jpeg;base64,${base64Image}`,
      specialty: 'Lab Results',
      provider: 'Quest Diagnostics',
      summary: 'Lab results uploaded. Connect to Claude API backend to extract real data from image.',
      reasonForVisit: 'Routine laboratory work',
      findings: 'Complete blood count shows WBC 7.2, RBC 4.8, Hemoglobin 14.5. All values within normal range.',
      nextSteps: 'Results reviewed. No follow-up testing indicated at this time.',
      extractedData: {
        medications: [],
        allergies: [],
        conditions: [],
        testResults: { 'WBC': '7.2', 'RBC': '4.8', 'Hemoglobin': '14.5' },
        dates: { 'Test Date': new Date().toLocaleDateString() },
      },
      processed: true,
    };
  },
};
