import { VoiceLanguageCode } from '@/types/product';
import { AI_CONFIG, hasGroqKey } from './aiConfig';
import * as FileSystem from 'expo-file-system/legacy';

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
        'This is a demo transcript. In production, this would be the real speech-to-text result from your backend API or Groq Whisper. The artisan described their handmade cotton bag with traditional embroidery work.',
      language: params.language,
      confidence: 0.92,
    };
  }
}

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

class GroqSpeechToTextService implements SpeechToTextService {
  async transcribeAudio(params: {
    audioUri: string;
    language: VoiceLanguageCode;
  }): Promise<TranscriptionResult> {
    const fileInfo = await FileSystem.getInfoAsync(params.audioUri);
    if (!fileInfo.exists) {
      throw new Error('Recording file not found');
    }

    const form = new FormData();
    const name = `recording${fileInfo.uri.split('.').pop() ?? 'm4a'}`;

    // @ts-expect-error - react-native FormData accepts file objects
    form.append('file', {
      uri: params.audioUri,
      name,
      type: 'audio/m4a',
    });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', params.language.split('-')[0]);

    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AI_CONFIG.groqApiKey}`,
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Groq transcription error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { text?: string };
    const transcript = data.text ?? '';
    if (!transcript.trim()) {
      throw new Error('Empty transcription result');
    }

    return {
      transcript,
      language: params.language,
      confidence: 1,
    };
  }
}

// Default: mock. When a Groq key is configured, use real whisper transcription.
let speechToTextService: SpeechToTextService = hasGroqKey
  ? new GroqSpeechToTextService()
  : new MockSpeechToTextService();

export function getSpeechToTextService(): SpeechToTextService {
  return speechToTextService;
}

export function setSpeechToTextService(
  service: SpeechToTextService
): void {
  speechToTextService = service;
}
