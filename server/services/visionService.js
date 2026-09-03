const GEMINI_GENERATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

/**
 * Analyze a product photo with Gemini (vision) and return a concise list of
 * VISIBLE characteristics - color, shape, design, material appearance,
 * components, packaging - that can be used to write an accurate description.
 *
 * @param {string} base64Image - base64-encoded image data (no data: prefix)
 * @param {string} mimeType - e.g. "image/jpeg"
 * @returns {Promise<string>} human-readable visual analysis notes
 */
export async function analyzeProductImage(base64Image, mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in server/.env');
  }
  if (!base64Image) {
    return '(No image was provided for visual analysis.)';
  }

  const prompt = `Analyze this product photograph. List ONLY the visible characteristics, each on a new line:
- Product type
- Main colors
- Shape / form
- Visible material or texture (only if clearly visible)
- Design patterns or decorations
- Visible components or parts
- Any visible writing, labels, or packaging (only if readable)

Be factual. If something is not clearly visible, do NOT mention it. Do not guess dimensions, weight, or materials that are not visible. Keep each line short.`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
  };

  let res;
  try {
    res = await fetch(`${GEMINI_GENERATE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Gemini vision request failed: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini vision API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) {
    return '(Gemini could not extract visible characteristics.)';
  }
  return text;
}
