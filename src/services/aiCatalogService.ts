import { ProductImage, VoiceLanguageCode } from '@/types/product';

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

// In production, replace this with a real backend API call.
// The architecture is: React Native App → Backend API → AI Vision + LLM
// such as OpenAI GPT-4 Vision, Google Gemini, or Anthropic Claude.
// The backend should handle:
// 1. Receiving product images + transcript
// 2. Sending images to a vision model for analysis
// 3. Combining vision analysis with transcript
// 4. Generating SEO-optimized product catalog
let aiCatalogService: AICatalogService = new MockAICatalogService();

export function getAICatalogService(): AICatalogService {
  return aiCatalogService;
}

export function setAICatalogService(service: AICatalogService): void {
  aiCatalogService = service;
}
