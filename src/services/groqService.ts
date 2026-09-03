import { AI_CONFIG, hasGroqKey } from './aiConfig';
import type {
  ProductImage,
  ProductPricing,
  VoiceLanguageCode,
} from '@/types/product';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.8-27b';

export interface GroqCatalogRequest {
  images: ProductImage[];
  transcript: string;
  language: VoiceLanguageCode;
  rawMaterialCost?: number;
  makingCost?: number;
}

export interface GroqCatalogResponse {
  title: string;
  shortDescription: string;
  description: string;
  seoKeywords: string[];
  tags: string[];
  category: string;
}

interface GroqMessage {
  role: 'system' | 'user';
  content: string;
}

interface GroqChoice {
  message: { content: string };
}

interface GroqResponse {
  choices: GroqChoice[];
}

async function groqChat(messages: GroqMessage[], temperature = 0.7): Promise<string> {
  if (!hasGroqKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_CONFIG.groqApiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as GroqResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned empty response');
  return content;
}

function extractJson<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not parse JSON from model response');
  }
  const json = text.slice(start, end + 1);
  return JSON.parse(json) as T;
}

export async function generateCatalogWithGroq(
  request: GroqCatalogRequest
): Promise<GroqCatalogResponse> {
  const systemPrompt = `You are a professional e-commerce product catalog writer for handcrafted artisan goods sold on Indian marketplaces like Amazon, Flipkart, and Meesho.

Write a complete, natural, professional product listing in English.

RULES:
- Write a clear, human, SEO-friendly description. Do NOT stuff keywords or repeat phrases.
- Only include facts that can be reasonably inferred from the product photos and the artisan's spoken description.
- If a specific detail (exact material, dimensions, weight, origin, certifications, handmade claims, sustainability) is NOT provided by the artisan or clearly visible, do NOT invent it. Avoid unsupported claims.
- Title should be concise and descriptive, not keyword-stuffed.
- Return valid JSON only, with this exact shape:
{
  "title": "...",
  "shortDescription": "...",
  "description": "...",
  "seoKeywords": ["...", "..."],
  "tags": ["...", "..."],
  "category": "..."
}
- "description" should be 2-4 well-written paragraphs.`;

  const artisanText = request.transcript.trim() || '(Artisan did not provide a spoken description. Base the listing only on what is visible in the photos.)';

  const userPrompt = `Artisan's spoken description (may mention name, material, size, design, and things to tell buyers):
"""${artisanText}"""

Number of product photos: ${request.images.length}

Please generate the product catalog as JSON.`;

  const content = await groqChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return extractJson<GroqCatalogResponse>(content);
}

export async function generatePricingWithGroq(
  request: GroqCatalogRequest
): Promise<ProductPricing> {
  const systemPrompt = `You are an expert e-commerce pricing analyst for handmade artisan products sold on Indian platforms (Amazon, Flipkart, Meesho, Etsy, and local marketplaces).

You will be given the artisan's production costs (raw material + making cost) and a description of the product. Your job is to research/reference typical competitor and marketplace prices for SIMILAR products and suggest the best selling prices.

Return valid JSON only with this exact shape:
{
  "suggestedRetailPrice": number,
  "suggestedWholesalePrice": number,
  "minRetailPrice": number,
  "maxRetailPrice": number,
  "currency": "INR",
  "competitors": [
    { "platform": "Amazon", "productName": "...", "price": number, "currency": "INR" }
  ],
  "reasoning": "Brief explanation of how the prices were derived from competitor references and costs."
}

RULES:
- If production costs are provided, use them as a floor. Suggested retail price should typically be 2-3x total cost for handmade goods to account for labor, platform fees, and profit margin.
- minRetailPrice should not be below total cost (or modestly at cost if none given).
- Reference plausible competitor price ranges for similar handmade products on major platforms.
- Do not invent numbers out of thin air; base them on realistic market ranges for similar artisan goods.
- Return ONLY the JSON, no extra text.`;

  const costText =
    request.rawMaterialCost != null && request.makingCost != null
      ? `Raw material cost: INR ${request.rawMaterialCost}\nMaking cost: INR ${request.makingCost}\nTotal cost: INR ${request.rawMaterialCost + request.makingCost}`
      : 'Production costs not provided. Estimate competitive prices based only on similar products.';

  const artisanText =
    request.transcript.trim() ||
    '(No spoken description provided. Base pricing on the product photos.)';

  const userPrompt = `Product description / artisan notes:
"""${artisanText}"""

${costText}

Number of product photos: ${request.images.length}

Please suggest the best e-commerce selling prices as JSON.`;

  const content = await groqChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    0.4
  );

  return extractJson<ProductPricing>(content);
}
