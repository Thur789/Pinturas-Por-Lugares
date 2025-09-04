/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import Modality and remove non-existent InlineDataPart import.
import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

// FIX: Initialize GoogleGenAI with API key from environment variable directly
// as per the guidelines, removing the unnecessary variable and check.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a watercolour painting from a satellite image.
 * @param imageDataUrl A data URL string of the source image (e.g., 'data:image/png;base64,...').
 * @param style The artistic style to apply ('Clássico', 'Vibrante', 'Suave', 'Preto e Branco').
 * @returns A promise that resolves to a base64-encoded image data URL of the generated painting.
 */
export async function generateWatercolourPainting(imageDataUrl: string, style: string = 'Clássico'): Promise<string> {
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid image data URL format. Expected 'data:image/...;base64,...'");
  }
  const mimeType = match[1];
  const base64Data = match[2];

  // FIX: Remove InlineDataPart type annotation as it's not a public type.
  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: base64Data,
    },
  };

  let prompt: string;
  switch (style) {
    case 'Vibrante':
      prompt = `Create a vibrant and colorful traditional watercolor painting from the front of this building. Use bright, saturated colors to make the scene pop. Add a tiny signature that says "Thur"`;
      break;
    case 'Suave':
      prompt = `Create a muted and soft traditional watercolor painting from the front of this building. Use a limited, desaturated color palette for a calm and gentle feel. Add a tiny signature that says "Thur"`;
      break;
    case 'Preto e Branco':
        prompt = `Create a traditional black and white watercolor painting from the front of this building. Use shades of gray, black, and white. Add a tiny signature that says "Thur"`;
        break;
    case 'Clássico':
    default:
      prompt = `Create a traditional watercolor painting from the front of this building. Add a tiny signature that says "Thur"`;
      break;
  }
  
  const textPart = {
    text: prompt,
  };

  const maxRetries = 3;
  const initialDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [imagePart, textPart] },
        // FIX: Add required responseModalities config for image editing model.
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });
      
      const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

      if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}), length:`, data.length);
        return `data:${mimeType};base64,${data}`;
      }

      const textResponse = response.text;
      console.error("API did not return an image. Response:", textResponse);
      throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);

    } catch (error) {
      console.error(`Error generating image from Gemini API (Attempt ${attempt}/${maxRetries}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const isInternalError = errorMessage.includes('"code":500') || errorMessage.includes('INTERNAL');

      if (isInternalError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Internal error detected. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Go to the next iteration of the loop
      }

      if (error instanceof Error) {
          throw new Error(`The AI model failed to generate an image after ${attempt} attempts. Details: ${error.message}`);
      }
      throw new Error(`The AI model failed to generate an image after ${attempt} attempts. Please check the console for more details.`);
    }
  }

  // This part should be unreachable if the loop logic is correct, but it's good practice for type safety.
  throw new Error("The AI model failed to generate an image after all retries.");
}