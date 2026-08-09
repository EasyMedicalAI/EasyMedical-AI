import { MedicalRecord, ExtractedData } from '../types/medical';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

// Note: API key is read at module load time, so must be set before import
const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Log to debug if API key is loaded
if (typeof window !== 'undefined') {
  console.log('🔑 Anthropic API Key loaded:', ANTHROPIC_API_KEY ? '✅ YES' : '❌ NO');
}

// Convert HEIC/HEIF images to JPEG for Claude API compatibility
const convertHeicToJpeg = async (imageUri: string): Promise<string> => {
  try {
    console.log('Starting image conversion for:', imageUri);

    // First, try to manipulate the image with a small resize operation to force re-encoding
    // This ensures the image is properly converted to JPEG format
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 2000, height: 2000 } }], // Resize to ensure re-encoding, maintaining aspect ratio
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    console.log('Image conversion successful. New URI:', manipulatedImage.uri);
    return manipulatedImage.uri;
  } catch (error) {
    console.error('Error converting image to JPEG:', error);
    console.warn('Attempting with simple resize fallback...');

    try {
      // Fallback: just resize to trigger re-encoding
      const fallbackImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      console.log('Fallback conversion successful:', fallbackImage.uri);
      return fallbackImage.uri;
    } catch (fallbackError) {
      console.error('Fallback conversion also failed:', fallbackError);
      return imageUri;
    }
  }
};

export { convertHeicToJpeg };

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
    recordId: string,
    mediaType: string = 'image/jpeg'
  ): Promise<Partial<MedicalRecord> & { medicationDetails?: { name: string; dosage: string; frequency: string } }> {
    try {
      if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }

      // Claude supports: image/jpeg, image/png, image/gif, image/webp
      // Default to JPEG for unsupported formats like HEIC, HEIF
      const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const finalMediaType = supportedFormats.includes(mediaType) ? mediaType : 'image/jpeg';

      if (mediaType !== finalMediaType) {
        console.warn(`Image format '${mediaType}' not supported by Claude, using '${finalMediaType}' instead`);
      }

      // Call Claude API with vision to analyze the image
      console.log('📡 Calling Claude API with image analysis...');
      console.log('🔑 Using API key:', ANTHROPIC_API_KEY?.substring(0, 20) + '...');

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: finalMediaType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: `Analyze this medical image and determine if it's a lab result or medication bottle.

If it's a LAB RESULT, extract all test metrics in this JSON format:
{
  "type": "lab",
  "testName": "e.g., Lipid Panel or Complete Blood Count",
  "date": "YYYY-MM-DD or empty string if not visible",
  "metrics": [
    {
      "name": "metric name (e.g., LDL Cholesterol)",
      "value": number or "raw value string",
      "unit": "unit (e.g., mg/dL)",
      "normalRange": { "min": number, "max": number } or null,
      "status": "normal|abnormal|unknown"
    }
  ]
}

If it's a MEDICATION BOTTLE, extract in this format:
{
  "type": "medication",
  "name": "medication name",
  "dosage": "dosage (e.g., 10mg)",
  "frequency": "frequency (e.g., Once daily)"
}

Return ONLY valid JSON, nothing else.`,
                },
              ],
            },
          ],
        }),
      });

      console.log('📡 Claude API response status:', response.status);

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Claude API error response:', error);
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      console.log('✅ Claude API success!');
      const data = await response.json();
      const responseText = data.content[0].text;
      console.log('📝 Claude response:', responseText.substring(0, 200) + '...');

      // Parse the JSON response
      let analysisData: any = { type: 'unknown' };

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Error parsing Claude response:', e);
      }

      // Handle Lab Results
      if (analysisData.type === 'lab') {
        const metrics = (analysisData.metrics || []).map((metric: any, idx: number) => ({
          id: `${recordId}-metric-${idx}`,
          name: metric.name || 'Unknown Test',
          value: metric.value || 'N/A',
          unit: metric.unit || '',
          normalRange: metric.normalRange || undefined,
          status: metric.status || 'unknown',
          date: analysisData.date || new Date().toISOString().split('T')[0],
          recordId: recordId,
        }));

        return {
          id: recordId,
          uploadDate: new Date().toISOString(),
          imageUri: `data:image/jpeg;base64,${base64Image}`,
          specialty: 'Laboratory',
          provider: 'Lab Results',
          summary: `Lab Result: ${analysisData.testName || 'Test Results'}`,
          reasonForVisit: analysisData.testName || 'Lab Work',
          findings: `${analysisData.testName || 'Lab Results'} - ${metrics.length} metrics extracted`,
          nextSteps: 'Review results and follow up with provider if needed',
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults: Object.fromEntries(
              metrics.map((m: any) => [`${m.name} (${m.unit})`, `${m.value}`])
            ),
            dates: { 'Test Date': analysisData.date || new Date().toLocaleDateString() },
            labMetrics: metrics,
          },
          processed: true,
        };
      }

      // Handle Medication Bottles
      const medicationDetails = {
        name: analysisData.name || 'Unknown Medication',
        dosage: analysisData.dosage || 'Unknown dosage',
        frequency: analysisData.frequency || 'Unknown frequency',
      };

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
      console.error('Error analyzing image:', error);
      throw error;
    }
  },
};
