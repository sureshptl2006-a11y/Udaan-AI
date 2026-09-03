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
  seoKeywords: string[];
  tags: string[];
  category: string;
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
    seoKeywords: [],
    tags: [],
    category: '',
  };
}
