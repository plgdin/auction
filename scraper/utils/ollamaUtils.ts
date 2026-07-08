import fetch from "node-fetch";
import { OLLAMA_API_URL, OLLAMA_MODEL_NAME } from "../config.js";
import { SubItem } from "../parsers/mstcParser.js";


const OLLAMA_URL = OLLAMA_API_URL;
const MODEL_NAME = OLLAMA_MODEL_NAME;


// The JSON schema to enforce structured lot data from the vision model
const subItemsSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "List of all lot items/sub-items extracted from the document image",
      items: {
        type: "object",
        properties: {
          sr: { 
            type: "string", 
            description: "Serial number or lot item number (e.g. '1', '2', '2a')" 
          },
          description: { 
            type: "string", 
            description: "Full description of the item, including material, grade, dimensions if any" 
          },
          qty: { 
            type: "string", 
            description: "Numeric quantity (e.g. '10', '150.5')" 
          },
          unit: { 
            type: "string", 
            description: "Unit of measurement (e.g. 'Nos', 'MT', 'Kgs', 'Sets')" 
          }
        },
        required: ["sr", "description", "qty", "unit"]
      }
    }
  },
  required: ["items"]
};

/**
 * Extracts structured lot details from a base64-encoded page image using local Ollama.
 *
 * @param imageBase64 - The raw base64 string of the page image (without data:image prefix).
 * @returns Array of parsed SubItem objects.
 */
export async function extractTableWithOllama(imageBase64: string): Promise<SubItem[]> {
  const payload = {
    model: MODEL_NAME,
    messages: [
      {
        role: "user",
        content: "Identify the table in this page. Extract each item row, finding the Serial Number (sr), Description (description), Quantity (qty), and Unit of Measurement (unit). Ignore header rows, page numbers, and unrelated text.",
        images: [imageBase64]
      }
    ],
    stream: false,
    format: subItemsSchema
  };

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`Ollama HTTP Error: ${response.status} - ${await response.text()}`);
      return [];
    }

    const result = await response.json();
    const content = result.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.items || [];
  } catch (error) {
    console.error("Ollama vision query failed:", error);
    return [];
  }
}
