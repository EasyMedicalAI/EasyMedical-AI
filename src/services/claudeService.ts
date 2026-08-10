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
                  text: `Analyze this medical image carefully. Determine if it's a LABORATORY TEST RESULT or a MEDICATION BOTTLE.

LABORATORY RESULTS include:
- LabCorp, Quest Diagnostics, Mayo Clinic, or other lab reports
- Blood test results, metabolic panels, lipid panels
- Test names and numerical values with units
- "Reference Range" or "Normal Range" sections
- Patient info and test dates

MEDICATION BOTTLES include:
- Prescription bottles with drug labels
- OTC medication packages
- Drug name, dosage, directions

If this is a LABORATORY TEST RESULT, extract metrics in this format:
{
  "type": "lab",
  "testName": "name of the test panel (e.g., Lipid Panel, Comprehensive Metabolic Panel)",
  "date": "YYYY-MM-DD if visible, otherwise empty string",
  "metrics": [
    {
      "name": "exact metric name as shown (e.g., LDL Cholesterol, Total Cholesterol, Glucose)",
      "value": numerical value only (no units),
      "unit": "unit as shown (e.g., mg/dL, mmol/L, %)",
      "normalRange": { "min": number, "max": number } or null,
      "status": "normal if value is within range, abnormal if outside range, unknown if can't determine"
    }
  ]
}

If this is a MEDICATION BOTTLE, extract:
{
  "type": "medication",
  "name": "medication name",
  "dosage": "dosage (e.g., 10mg)",
  "frequency": "frequency (e.g., Once daily)"
}

Return ONLY valid JSON. If you cannot clearly identify the image content, return {"type": "unknown", "message": "Could not identify image content"}.`,
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

      // Check if response has the expected structure
      if (!data.content || !Array.isArray(data.content)) {
        console.error('❌ Unexpected response structure:', data);
        throw new Error(`Unexpected Claude API response: ${JSON.stringify(data)}`);
      }

      // Find the text block (Claude may return thinking blocks first)
      const textBlock = data.content.find((block: any) => block.type === 'text');
      if (!textBlock || !textBlock.text) {
        console.error('❌ No text block found in response:', data);
        throw new Error('Claude response missing text block');
      }

      const responseText = textBlock.text;
      console.log('📝 Claude response:', responseText.substring(0, 200) + '...');

      // Parse the JSON response
      let analysisData: any = { type: 'unknown' };

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
          console.log('✅ Successfully parsed JSON:', analysisData.type);
        } else {
          console.warn('⚠️ No JSON found in Claude response');
          console.log('Raw response:', responseText);
          throw new Error('Claude did not return valid JSON');
        }
      } catch (e) {
        console.error('❌ Error parsing Claude response:', e);
        console.error('Response text was:', responseText);
        throw new Error(`Failed to parse Claude response: ${e instanceof Error ? e.message : String(e)}`);
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
