import { VoiceLanguageCode } from '@/types/product';

export interface TranscriptionResult {
  transcript: string;
  language: VoiceLanguageCode;
  confidence: number;
}

export interface SpeechToTextService {
  transcribeAudio(params: {
    audioUri: string;
    language: VoiceLanguageCode;
  }): Promise<TranscriptionResult>;
}

class MockSpeechToTextService implements SpeechToTextService {
  async transcribeAudio(params: {
    audioUri: string;
    language: VoiceLanguageCode;
  }): Promise<TranscriptionResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      transcript:
        'This is a demo transcript. In production, this would be the real speech-to-text result from your backend API. The artisan described their handmade cotton bag with traditional embroidery work.',
      language: params.language,
      confidence: 0.92,
    };
  }
}

// In production, replace this with a real backend API call.
// The architecture is: React Native App → Backend API → Speech-to-Text Provider
// such as Google Cloud Speech, Azure Cognitive Services, or AWS Transcribe.
let speechToTextService: SpeechToTextService = new MockSpeechToTextService();

export function getSpeechToTextService(): SpeechToTextService {
  return speechToTextService;
}

export function setSpeechToTextService(
  service: SpeechToTextService
): void {
  speechToTextService = service;
}
