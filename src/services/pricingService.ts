import { ProductPricing } from '@/types/product';
import { hasGroqKey } from './aiConfig';
import { generatePricingWithGroq } from './groqService';
import type { ProductImage, VoiceLanguageCode } from '@/types/product';

export interface PricingRequest {
  images: ProductImage[];
  transcript: string;
  language: VoiceLanguageCode;
  rawMaterialCost?: number;
  makingCost?: number;
}

export interface PricingService {
  generatePricing(params: PricingRequest): Promise<ProductPricing>;
}

class MockPricingService implements PricingService {
  async generatePricing(params: PricingRequest): Promise<ProductPricing> {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const totalCost =
      (params.rawMaterialCost ?? 0) + (params.makingCost ?? 0);

    return {
      rawMaterialCost: params.rawMaterialCost ?? 0,
      makingCost: params.makingCost ?? 0,
      totalCost,
      suggestedRetailPrice: totalCost > 0 ? Math.round(totalCost * 2.5) : 499,
      suggestedWholesalePrice: totalCost > 0 ? Math.round(totalCost * 1.8) : 350,
      minRetailPrice: totalCost > 0 ? totalCost : 299,
      maxRetailPrice: totalCost > 0 ? Math.round(totalCost * 4) : 999,
      currency: 'INR',
      confidence: 'low',
      competitors: [
        {
          platform: 'Amazon',
          productName: 'Similar handcrafted tote',
          price: 599,
          currency: 'INR',
        },
        {
          platform: 'Flipkart',
          productName: 'Comparable artisan bag',
          price: 549,
          currency: 'INR',
        },
      ],
      reasoning:
        'Mock pricing based on typical handmade tote ranges (INR 300-1000). Connect a real pricing backend for accurate competitor data.',
    };
  }
}

class GroqPricingService implements PricingService {
  async generatePricing(params: PricingRequest): Promise<ProductPricing> {
    const result = await generatePricingWithGroq(params);
    const totalCost =
      (params.rawMaterialCost ?? 0) + (params.makingCost ?? 0);
    return {
      ...result,
      rawMaterialCost: params.rawMaterialCost ?? 0,
      makingCost: params.makingCost ?? 0,
      totalCost,
    };
  }
}

let pricingService: PricingService = hasGroqKey
  ? new GroqPricingService()
  : new MockPricingService();

export function getPricingService(): PricingService {
  return pricingService;
}

export function setPricingService(service: PricingService): void {
  pricingService = service;
}
