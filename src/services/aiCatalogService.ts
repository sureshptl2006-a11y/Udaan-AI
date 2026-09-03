import { ProductImage, VoiceLanguageCode } from '@/types/product';
import { hasGroqKey } from './aiConfig';
import { generateCatalogWithGroq } from './groqService';

export interface AICatalogRequest {
  images: ProductImage[];
  transcript: string;
  language: VoiceLanguageCode;
}

export interface AICatalogResult {
  title: string;
  shortDescription: string;
  description: string;
  seoKeywords: string[];
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
      seoKeywords: [
        'handcrafted cotton bag',
        'handmade embroidered bag',
        'artisan tote bag',
        'traditional Indian handicraft',
        'cotton shoulder bag',
      ],
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

// Default: mock. When a Groq key is configured, use the real service.
let aiCatalogService: AICatalogService = hasGroqKey
  ? new GroqAICatalogService()
  : new MockAICatalogService();

export function getAICatalogService(): AICatalogService {
  return aiCatalogService;
}

export function setAICatalogService(service: AICatalogService): void {
  aiCatalogService = service;
}
