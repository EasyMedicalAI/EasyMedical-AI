import { MedicalRecord, ExtractedData } from '../types/medical';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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
  ): Promise<Partial<MedicalRecord> & { medicationDetails: { name: string; dosage: string; frequency: string } }> {
    try {
      if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }

      // Call Claude API with vision to analyze the medication image
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: `Analyze this medication bottle image and extract the following information in JSON format:
{
  "name": "medication name",
  "dosage": "dosage (e.g., 10mg)",
  "frequency": "frequency (e.g., Once daily, Twice daily, Every 12 hours)"
}

Only return valid JSON. If you cannot identify a medication, return the image content description instead. Be concise and return ONLY the JSON object, nothing else.`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const responseText = data.content[0].text;

      // Parse the JSON response
      let medicationDetails = {
        name: 'Unknown Medication',
        dosage: 'Unknown dosage',
        frequency: 'Unknown frequency',
      };

      try {
        // Extract JSON from response (it might be wrapped in markdown code blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          medicationDetails = {
            name: parsed.name || 'Unknown Medication',
            dosage: parsed.dosage || 'Unknown dosage',
            frequency: parsed.frequency || 'Unknown frequency',
          };
        }
      } catch (e) {
        console.error('Error parsing Claude response:', e);
        // Fall back to using the raw response
        medicationDetails = {
          name: responseText.substring(0, 50),
          dosage: 'See analysis',
          frequency: 'Manual review needed',
        };
      }

      return {
        id: recordId,
        uploadDate: new Date().toISOString(),
        imageUri: `data:image/jpeg;base64,${base64Image}`,
        specialty: 'Pharmacy',
        provider: 'Claude AI Analysis',
        summary: `Medication analyzed: ${medicationDetails.name}`,
        reasonForVisit: medicationDetails.name,
        findings: `Medication bottle analysis - ${medicationDetails.name} ${medicationDetails.dosage}`,
        nextSteps: 'Medication added to prescription list.',
        medicationDetails: medicationDetails,
        extractedData: {
          medications: [`${medicationDetails.name} ${medicationDetails.dosage} - ${medicationDetails.frequency}`],
          allergies: [],
          conditions: [],
          testResults: {},
          dates: { 'Analysis Date': new Date().toLocaleDateString() },
        },
        processed: true,
      };
    } catch (error) {
      console.error('Error analyzing medication image:', error);
      throw error;
    }
  },
};
