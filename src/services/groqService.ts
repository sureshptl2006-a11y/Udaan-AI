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
  keyFeatures: string[];
  idealFor: string[];
  seoKeywords: string[];
  metaTitle: string;
  metaDescription: string;
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
  const systemPrompt = `You are a professional e-commerce SEO copywriter and product content specialist.

Your task is to create a professional, accurate, SEO-friendly product description using:

1. The provided short product description (the artisan's spoken/typed description)
2. The provided raw product photographs

Analyze both inputs carefully before writing.

### PRIMARY OBJECTIVE

Create a high-quality e-commerce product description that is:

* Professional and trustworthy
* Clear and easy to understand
* SEO-friendly but natural
* Suitable for online marketplaces and e-commerce websites
* Helpful to customers making a purchase decision
* Optimized around the actual product and its intended use
* Written in a way that improves product discoverability without keyword stuffing

### PRODUCT ACCURACY — VERY IMPORTANT

Use the provided description as the primary source of factual information.

Use the product photographs to understand and describe only clearly visible characteristics such as:

* Product type
* General appearance
* Shape
* Visible components
* Color
* Design
* Configuration
* Visible features
* Packaging, only when clearly visible

NEVER invent or assume information that is not provided or clearly visible.

Do NOT fabricate:

* Dimensions
* Weight
* Material composition
* Technical specifications
* Model numbers
* Part numbers
* Brand names
* Certifications
* Warranty information
* Country of origin
* Medical claims
* Safety claims
* Performance claims
* Compatibility
* Quantity
* Ingredients
* Clinical benefits
* Regulatory approvals
* Any other unsupported specification

If information is uncertain or unavailable, simply leave it out.

Never claim that a product is "best", "guaranteed", "premium", "100% safe", "clinically proven", "certified", or similar unless that information is explicitly provided.

### SEO REQUIREMENTS

Identify the most relevant primary product keyword from the provided information.

Naturally incorporate:

* Primary product keyword
* Relevant secondary keywords
* Product category terms
* Important use-case keywords
* Relevant customer search terminology

Use keywords naturally throughout the content.

Avoid:

* Keyword stuffing
* Repeating the same keyword unnaturally
* Generic SEO filler
* Clickbait
* Over-optimization

Write for humans first and search engines second.

### CONTENT TO GENERATE

Generate all of the following inside a single JSON object:

"title": A concise, SEO-friendly product title containing the product name and the most important identifying product keyword when available.

"shortDescription": A compelling 1-2 sentence summary explaining what the product is and its main purpose.

"description": 2-4 professional paragraphs explaining what the product is, its intended purpose/use, important features supported by the provided information, relevant design or visible characteristics, and why it may be useful to the intended customer.

"keyFeatures": 4-7 concise bullet points (as an array of strings) containing only verified or clearly visible features.

"idealFor": Mention appropriate applications or users only when they can reasonably be established from the provided information. Do not invent specialized applications. (as an array of strings)

"seoKeywords": 5-10 relevant search keywords/phrases (as an array of strings) based strictly on the product information.

"metaTitle": An SEO-friendly meta title of approximately 50-60 characters when practical.

"metaDescription": A compelling SEO meta description of approximately 140-160 characters when practical.

"tags": A few broad category/department tags (as an array of strings) such as "handmade", "artisan", plus a material/type tag only if clearly known.

"category": A single marketplace category label for the product type (e.g., "Bags & Accessories").

### WRITING STYLE

Write like a top real e-commerce listing, NOT like a cautious disclaimer.

- Write in a confident, natural, selling tone. Do not constantly hedge.
- Do NOT write sentences like "please note that specific material composition and exact dimensions were not provided" or "it is recommended to consult with a healthcare professional." That kind of weak, legalistic copy is not marketplace quality.
- If a precise specification (exact dimensions, clinical certification, precise material blend) is truly unknown for THIS product, simply do not state that specific number. Omit it - do not draw attention to its absence.
- Only mention consulting a professional if it is genuinely relevant to safe use of that product type (e.g. medical devices) - keep it as a brief, natural closing touch, NOT a paragraph of caveats.
- Use realistic, descriptive, benefit-oriented language a customer finds useful.
- Avoid emojis. Avoid marketing hype like "best", "guaranteed", "clinically proven" unless the data actually supports it.
- Do not mention that AI was used.
- Do not mention the raw photograph or the process of analyzing the photograph.

### IMAGE ANALYSIS RULE

The photographs are supporting visual evidence, not permission to guess.

Only describe visual characteristics that can be identified with reasonable confidence.

If a photograph conflicts with the written product information:

* Prioritize explicit factual information from the provided product description.
* Do not create a specification that is not supported.
* Avoid mentioning the conflicting detail unless necessary.

### OUTPUT FORMAT

Return ONLY valid JSON with this exact shape, no extra text, no markdown code fences:

{
  "title": "...",
  "shortDescription": "...",
  "description": "...",
  "keyFeatures": ["...", "..."],
  "idealFor": ["...", "..."],
  "seoKeywords": ["...", "..."],
  "metaTitle": "...",
  "metaDescription": "...",
  "tags": ["...", "..."],
  "category": "..."
}

FINAL QUALITY CHECK:
Before returning the answer, verify that every factual claim is supported by the provided short description or clearly visible in the product images. Remove anything that requires guessing or speculation.`;

  const artisanText = request.transcript.trim() || '(The artisan did not provide a description. Base the listing only on what is clearly visible in the photos.)';

  const userPrompt = `Provided short product description / artisan's description:
"""${artisanText}"""

Number of product photos: ${request.images.length}

Please generate the product catalog as JSON following the instructions.`;

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
