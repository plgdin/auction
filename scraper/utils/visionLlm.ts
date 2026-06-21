import { GoogleGenAI } from '@google/genai';
import { logger } from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

const log = logger.child({ module: 'visionLlm' });

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'mock-key'
});

export interface ParsedItem {
  sr: string;
  description: string;
  qty: string;
  unit: string;
}

export async function parseImageWithVisionLLM(imageBuffer: Buffer): Promise<ParsedItem[]> {
  try {
    const base64Image = imageBuffer.toString('base64');

    const prompt = `You are an expert data extraction engine for auction catalogs. Look at the provided image.
Extract all physical inventory items. If the text is in Hindi or another language, translate the item description to English.
Ignore all Terms, Conditions, Payment Guidelines, and Non-Inventory text.
Correct obvious spelling errors (e.g. "cupper" to "copper").

Return the data STRICTLY as a JSON array with exactly these keys: "sr" (string/number), "description" (string), "qty" (string/number), "unit" (string).
If no inventory items are found, return an empty array [].
Do not output markdown code blocks or any other text, just raw JSON.`;

    // Only call if API key is real, otherwise mock for local testing
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg'
            }
          }
        ]
      });

      const rawContent = response.text || '[]';
      // Clean up potential markdown formatting
      const cleanContent = rawContent.replace(/```json\n?|\n?```/gi, '').trim();
      
      const parsed = JSON.parse(cleanContent);
      return Array.isArray(parsed) ? parsed : [];
    } else {
      log.warn({}, "GEMINI_API_KEY missing or invalid. Returning mock vision parsing results.");
      return [
        { sr: '1', description: 'Commander Jeep (Mock Translated)', qty: '1', unit: 'Unit' },
        { sr: '2', description: 'Spacio Vehicle (Mock Translated)', qty: '1', unit: 'Unit' }
      ];
    }
  } catch (error: any) {
    log.error({ error: error.message }, 'Failed to parse image with Gemini Vision LLM');
    return [];
  }
}
