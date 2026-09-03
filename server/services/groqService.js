const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.8-27b';

async function groqChat(messages, temperature = 0.7) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set in server/.env');
  }
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty response');
  return content;
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not parse JSON from model response');
  }
  return JSON.parse(text.slice(start, end + 1));
}

const DESCRIPTION_SYSTEM_PROMPT = `You are a professional e-commerce SEO copywriter who writes confident, persuasive, market-ready product listings.

Your job is to write a professional, accurate, SEO-friendly product listing. You are given:

1. The artisan's short description of their product
2. Number of product photos they uploaded
3. Optional: real search results and competitor page content for similar products found on the web (like Frido, Amazon, Flipkart, Meesho listings)

### HOW TO USE THE INFORMATION

Treat the artisan's short description as the PRIMARY source of factual truth about THEIR product.

Use the competitor / search-reference content to understand the PRODUCT CATEGORY, the typical features such products offer, the brand context, and the language real marketplaces use. You may use this knowledge to write a richer, more informed and SEO-friendly description - but you must not claim things are true of THIS specific product unless the artisan said it or it is clearly visible/reasonable for the product type.

### WRITING STYLE - CRITICAL

Write like a top real e-commerce listing, NOT like a cautious disclaimer. Specifically:

- Write in a confident, natural, selling tone. Do not constantly hedge.
- Do NOT write sentences like "please note that specific material composition and exact dimensions were not provided" or "it is recommended to consult with a healthcare professional." That kind of weak, legalistic copy is not marketplace quality.
- If a precise specification (exact dimensions, clinical certification, precise material blend) is truly unknown for THIS product, simply do not state that specific number. Omit it - do not draw attention to its absence.
- Only mention consulting a professional if it is genuinely relevant to safe use of that product type (e.g. medical devices) - keep it as a brief, natural closing touch, NOT a paragraph of caveats.
- Use realistic, descriptive, benefit-oriented language a customer finds useful.
- Avoid emojis. Avoid marketing hype like "best", "guaranteed", "clinically proven" unless the data actually supports it.

### SEO REQUIREMENTS

Identify the most relevant primary keyword. Naturally include it plus relevant secondary keywords, category terms, use-case keywords, and customer search terms. Write for humans first, search engines second. No keyword stuffing, no filler.

### CONTENT TO GENERATE (all inside a single JSON object)

"title": concise SEO-friendly product title, ideally including the brand/product name and key keyword when known.
"shortDescription": 1-2 sentence summary of what the product is and its main purpose.
"description": 2-4 professional, confident paragraphs - what it is, its purpose, key features, how it is used, and why it is useful to the customer.
"keyFeatures": 4-7 concise bullet points (array of strings) - only features that are stated or clearly reasonable for the product type.
"idealFor": appropriate users/use-cases (array of strings) only where reasonably established. Do not invent niche applications.
"seoKeywords": 5-10 relevant search keywords (array of strings).
"metaTitle": SEO meta title approx 50-60 characters.
"metaDescription": SEO meta description approx 140-160 characters.
"tags": a few broad tags (array of strings) e.g. "handmade", "artisan", plus material/type if known.
"category": a single marketplace category label.

### IMAGE RULE

Product photos are supporting evidence, not permission to guess. Only describe clearly visible characteristics with reasonable confidence. If a photo conflicts with the artisan's written description, prefer the written description.

### OUTPUT FORMAT

Return ONLY valid JSON, no markdown fences, with exactly this shape:
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

FINAL CHECK: Make sure the copy is confident, natural, SEO-optimised and honest. Do not include legalistic disclaimers about missing data.`;

/**
 * Generate the product catalog.
 * When referenceContent is provided, it is fed to the model for enrichment.
 */
export async function generateCatalog({ transcript, imageCount, referenceContent, visualNotes }) {
  const artisanText = (transcript || '').trim() ||
    '(The artisan did not provide a description. Use only what is clearly visible in the photos.)';

  let referenceSection = '';
  if (referenceContent && referenceContent.length > 0) {
    const blocks = referenceContent
      .map(
        (r, i) =>
          `--- Reference ${i + 1}: ${r.title} (${r.url}) ---\n${r.content}`
      )
      .join('\n\n');
    referenceSection = `Real web search results for similar products (use these only to understand the category and typical features/language - do not blindly copy them):\n"""${blocks}"""\n\n`;
  }

  let visualSection = '';
  if (visualNotes) {
    visualSection = `Facts about the product clearly visible in the uploaded photo (from automatic image analysis - only state what is actually shown):
"""${visualNotes}"""

`;
  }

  const userPrompt = `${referenceSection}${visualSection}Artisan's short description of their product:
"""${artisanText}"""

Number of product photos: ${imageCount}

Please generate the product catalog as JSON following the instructions.`;

  const content = await groqChat(
    [
      { role: 'system', content: DESCRIPTION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    0.7
  );

  return extractJson(content);
}
