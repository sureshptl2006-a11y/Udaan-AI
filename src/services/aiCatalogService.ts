import { ProductImage, VoiceLanguageCode } from '@/types/product';
import { AI_CONFIG, hasGroqKey, hasApiUrl } from './aiConfig';
import { generateCatalogWithGroq } from './groqService';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface AICatalogRequest {
  images: ProductImage[];
  transcript: string;
  language: VoiceLanguageCode;
}

export interface AICatalogResult {
  title: string;
  shortDescription: string;
  description: string;
  keyFeatures: string[];
  idealFor: string[];
  seoKeywords: string[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  category: string;
}

export interface AICatalogService {
  generateCatalog(params: AICatalogRequest): Promise<AICatalogResult>;
}

class MockAICatalogService implements AICatalogService {
  async generateCatalog(params: AICatalogRequest): Promise<AICatalogResult> {
    // Simulate processing time for AI generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      title: 'Handcrafted Traditional Embroidered Cotton Tote Bag',
      shortDescription:
        'A beautifully handcrafted cotton tote bag featuring traditional embroidery and a practical everyday design.',
      description:
        'This handcrafted cotton tote bag showcases the rich tradition of Indian artisan craftsmanship. Each stitch reflects generations of skilled handwork, making every piece unique.\n\nThe bag is designed for everyday use with a spacious interior that comfortably holds your daily essentials. The traditional embroidery patterns add a touch of cultural elegance to a practical accessory.\n\nMade with care by skilled artisans, this bag represents sustainable fashion and supports traditional craft communities. The natural cotton material is both durable and eco-friendly.',
      keyFeatures: [
        'Traditional hand-embroidery detailing',
        'Spacious interior for daily essentials',
        'Lightweight and easy to carry',
        'Made from natural cotton',
        'Versatile for everyday or casual outings',
      ],
      idealFor: [
        'Everyday errands and shopping',
        'Work and travel essentials',
        'Gifting to craft and fashion lovers',
      ],
      seoKeywords: [
        'handcrafted cotton bag',
        'handmade embroidered bag',
        'artisan tote bag',
        'traditional Indian handicraft',
        'cotton shoulder bag',
      ],
      metaTitle: 'Handcrafted Embroidered Cotton Tote Bag',
      metaDescription:
        'A handcrafted cotton tote bag with traditional embroidery, a spacious interior, and a practical everyday design for all your daily essentials.',
      tags: [
        'handmade',
        'artisan',
        'embroidery',
        'cotton',
        'traditional craft',
        'India',
        'eco-friendly',
      ],
      category: 'Bags & Accessories',
    };
  }
}

class GroqAICatalogService implements AICatalogService {
  async generateCatalog(params: AICatalogRequest): Promise<AICatalogResult> {
    return generateCatalogWithGroq(params);
  }
}

const MAX_IMAGE_PIXELS = 768;

/** Downscale + compress an image URI to a small base64 JPEG for sending to the backend. */
async function toSmallBase64(uri: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: MAX_IMAGE_PIXELS } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true }
    );
    if (result.base64) {
      return { base64: result.base64, mimeType: 'image/jpeg' };
    }
    return null;
  } catch {
    return null;
  }
}

class BackendAICatalogService implements AICatalogService {
  async generateCatalog(params: AICatalogRequest): Promise<AICatalogResult> {
    const baseUrl = AI_CONFIG.apiUrl.replace(/\/$/, '');

    // Send the first photo (downscaled to base64) so the backend can analyze it.
    let imagePayload: { uri: string; base64?: string; mimeType?: string }[] =
      params.images.map((img) => ({ uri: img.uri }));
    const first = params.images[0];
    if (first) {
      const encoded = await toSmallBase64(first.uri);
      if (encoded) {
        imagePayload[0] = { uri: first.uri, ...encoded };
      }
    }

    const res = await fetch(`${baseUrl}/api/generate-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: params.transcript,
        images: imagePayload,
        language: params.language,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Server error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { catalog?: AICatalogResult };
    if (!data.catalog) {
      throw new Error('Server returned no catalog data');
    }
    return data.catalog;
  }
}

// Priority: backend (web-search enriched) > direct Groq > mock.
let aiCatalogService: AICatalogService = hasApiUrl
  ? new BackendAICatalogService()
  : hasGroqKey
    ? new GroqAICatalogService()
    : new MockAICatalogService();

export function getAICatalogService(): AICatalogService {
  return aiCatalogService;
}

export function setAICatalogService(service: AICatalogService): void {
  aiCatalogService = service;
}
