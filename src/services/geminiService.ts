import { AI_CONFIG, hasGeminiKey } from './aiConfig';
import * as FileSystem from 'expo-file-system/legacy';
import type { ProductImage } from '@/types/product';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

export interface GeminiImageRequest {
  images: ProductImage[];
  productTitle: string;
  productDescription: string;
}

export interface GeminiImageResponse {
  // base64-encoded PNG (or JPEG) of the generated image
  base64Image: string;
  mimeType: string;
}

function apiUrl(model: string, key: string, action = 'generateContent'): string {
  return `${GEMINI_API_URL}/${model}:${action}?key=${encodeURIComponent(key)}`;
}

async function imageUriToBase64(uri: string): Promise<{
  data: string;
  mimeType: string;
}> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // Default to jpeg; adjust based on file extension if known
  let mimeType = 'image/jpeg';
  if (/\.png$/i.test(uri)) mimeType = 'image/png';
  else if (/\.webp$/i.test(uri)) mimeType = 'image/webp';
  else if (/\.heic$/i.test(uri)) mimeType = 'image/heic';
  return { data: base64, mimeType };
}

export async function generateProductImageWithGemini(
  request: GeminiImageRequest
): Promise<GeminiImageResponse> {
  if (!hasGeminiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Build multi-part request: use the provided photos as reference and ask
  // Gemini to produce a professional e-commerce product image.
  const parts: any[] = [];

  // Include up to a few reference photos so the model has visual context
  const refImages = request.images.slice(0, 3);
  for (const img of refImages) {
    try {
      const { data, mimeType } = await imageUriToBase64(img.uri);
      parts.push({
        inlineData: {
          mimeType,
          data,
        },
      });
    } catch {
      // skip images that cannot be read
    }
  }

  parts.push({
    text: `Create a professional e-commerce product photo for the following product.

Product title: ${request.productTitle}
Product description: ${request.productDescription}

Requirements:
- Clean, bright background suitable for an online marketplace listing.
- Realistic, high quality product photograph.
- If reference photos are provided, keep the same product look and improve the presentation/lighting/background.
- Do not add text, logos, or watermarks to the image.
- Output just the image.`,
  });

  const res = await fetch(apiUrl(IMAGE_MODEL, AI_CONFIG.geminiApiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '1:1' },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini image API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  // Find inline image data in candidates
  const candidates = data.candidates ?? [];
  for (const candidate of candidates) {
    const content = candidate.content;
    const partsArr = content?.parts ?? [];
    for (const part of partsArr) {
      if (part.inlineData?.data && part.inlineData?.mimeType) {
        return {
          base64Image: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }
  }

  throw new Error('Gemini did not return an image');
}

export function writeBase64Image(base64: string, mimeType: string): string {
  // In React Native we cannot write to arbitrary fs paths easily from a pure
  // function. This helper is a placeholder for saving; the caller persists it.
  return base64;
}
