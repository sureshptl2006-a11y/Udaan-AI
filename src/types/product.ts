export interface ProductImage {
  uri: string;
  width: number;
  height: number;
}

export type VoiceLanguageCode =
  | 'hi-IN'
  | 'gu-IN'
  | 'mr-IN'
  | 'bn-IN'
  | 'ta-IN'
  | 'te-IN'
  | 'kn-IN'
  | 'ml-IN'
  | 'pa-IN'
  | 'en-US';

export interface VoiceLanguage {
  code: VoiceLanguageCode;
  label: string;
  nativeLabel: string;
}

export interface ProductDraft {
  id: string;
  images: ProductImage[];
  voiceLanguage: VoiceLanguageCode;
  audioUri: string | null;
  transcript: string;
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
  rawMaterialCost?: number;
  makingCost?: number;
  totalCost?: number;
  pricing?: ProductPricing;
  generatedImage?: string | null;
}

export interface CompetitorPrice {
  platform: string;
  productName: string;
  price: number;
  currency: string;
}

export interface ProductPricing {
  rawMaterialCost: number;
  makingCost: number;
  totalCost: number;
  suggestedWholesalePrice: number;
  suggestedRetailPrice: number;
  minRetailPrice: number;
  maxRetailPrice: number;
  currency: string;
  confidence: 'low' | 'medium' | 'high';
  competitors: CompetitorPrice[];
  reasoning: string;
}

export const AVAILABLE_LANGUAGES: VoiceLanguage[] = [
  { code: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'gu-IN', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'mr-IN', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'bn-IN', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'ta-IN', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'kn-IN', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'pa-IN', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'en-US', label: 'English', nativeLabel: 'English' },
];

export function createEmptyDraft(): ProductDraft {
  return {
    id: Date.now().toString(),
    images: [],
    voiceLanguage: 'hi-IN',
    audioUri: null,
    transcript: '',
    title: '',
    shortDescription: '',
    description: '',
    keyFeatures: [],
    idealFor: [],
    seoKeywords: [],
    metaTitle: '',
    metaDescription: '',
    tags: [],
    category: '',
    generatedImage: null,
  };
}
