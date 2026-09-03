// Reads API keys from Expo environment variables.
//
// IMPORTANT: In Expo, only variables prefixed with EXPO_PUBLIC_ are exposed
// to client-side JavaScript. Because this app calls the AI providers directly
// from the device (not through a backend), these keys are inlined into the
// app bundle. Do NOT use production keys, or be aware they will be visible
// to anyone with access to the app.
export const AI_CONFIG = {
  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
  groqApiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',
};

export const hasGeminiKey = AI_CONFIG.geminiApiKey.length > 0;
export const hasGroqKey = AI_CONFIG.groqApiKey.length > 0;

export const isAIConfigured = hasGeminiKey || hasGroqKey;
