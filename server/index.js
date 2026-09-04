import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { searchWeb, buildSearchQuery, buildPricingSearchQuery } from './services/searchService.js';
import { generateCatalog, generatePricing } from './services/groqService.js';
import { analyzeProductImage } from './services/visionService.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

/**
 * POST /api/generate-description
 * Body: {
 *   transcript: string,
 *   images?: Array<{ uri: string, base64?: string, mimeType?: string }>,
 *   language?: string
 * }
 *
 * 1. Analyzes the uploaded product photo with Gemini vision (visible features)
 * 2. Searches the web for similar products (Tavily)
 * 3. Feeds visual analysis + artisan description + real competitor content into Groq
 * 4. Returns the enriched, structured product listing
 */
app.post('/api/generate-description', async (req, res) => {
  try {
    const { transcript = '', images = [], language = 'en-US' } = req.body || {};

    if (!transcript?.trim()) {
      return res.status(400).json({ error: 'A short product description is required.' });
    }

    // Step 1: analyze the first uploaded photo with Gemini vision
    let visualNotes = null;
    const firstImage = Array.isArray(images) ? images[0] : null;
    try {
      if (firstImage?.base64) {
        visualNotes = await analyzeProductImage(firstImage.base64, firstImage.mimeType || 'image/jpeg');
      }
    } catch (err) {
      console.warn('Image analysis failed (continuing without visual notes):', err.message);
      visualNotes = null;
    }

    // Step 2: search the web for similar products
    const query = buildSearchQuery(transcript);
    let referenceContent = [];
    let searchInfo = null;
    try {
      const searchResult = await searchWeb(query, 5);
      referenceContent = searchResult.results;
      searchInfo = {
        query,
        answer: searchResult.answer?.slice(0, 400) || '',
        sourceCount: referenceContent.length,
        sources: referenceContent.map((r) => ({ title: r.title, url: r.url })),
      };
    } catch (err) {
      console.warn('Web search failed (continuing without reference data):', err.message);
      searchInfo = { query, error: err.message, sourceCount: 0, sources: [] };
    }

    // Step 3: generate the listing with Groq, enriched by visual + competitor content
    const catalog = await generateCatalog({
      transcript,
      imageCount: Array.isArray(images) ? images.length : 0,
      referenceContent,
      visualNotes,
    });

    res.json({
      catalog,
      search: searchInfo,
      visualAnalysisProvided: Boolean(visualNotes),
    });
  } catch (err) {
    console.error('generate-description error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

/**
 * POST /api/generate-pricing
 * Body: {
 *   transcript: string,
 *   images?: Array<{ uri?: string }>,
 *   language?: string,
 *   rawMaterialCost?: number,
 *   makingCost?: number
 * }
 *
 * 1. Searches the web for the same product's real prices on other sites (Tavily)
 * 2. Feeds those real competitor prices + production costs into Groq
 * 3. Returns a structured ProductPricing suggestion
 * Falls back to a cost-based heuristic if search/LLM fail so the app always gets a useful reply.
 */
function fallbackPricing({ transcript, rawMaterialCost, makingCost }) {
  const raw = Number(rawMaterialCost) || 0;
  const make = Number(makingCost) || 0;
  const totalCost = raw + make;

  return {
    rawMaterialCost: raw,
    makingCost: make,
    totalCost,
    suggestedRetailPrice: totalCost > 0 ? Math.round(totalCost * 2.5) : 499,
    suggestedWholesalePrice: totalCost > 0 ? Math.round(totalCost * 1.8) : 350,
    minRetailPrice: totalCost > 0 ? totalCost : 299,
    maxRetailPrice: totalCost > 0 ? Math.round(totalCost * 4) : 999,
    currency: 'INR',
    confidence: 'low',
    competitors: [],
    reasoning:
      'Real competitor prices were unavailable, so this is a cost-based estimate. Connect pricing source or retry.',
  };
}

app.post('/api/generate-pricing', async (req, res) => {
  try {
    const {
      transcript = '',
      images = [],
      language = 'en-US',
      rawMaterialCost,
      makingCost,
    } = req.body || {};

    const raw = Number(rawMaterialCost) || 0;
    const make = Number(makingCost) || 0;
    const totalCost = raw + make;

    // Step 1: search the web for real prices of the same product
    let competitorRefs = [];
    let searchInfo = { sourceCount: 0 };
    try {
      const query = buildPricingSearchQuery(transcript);
      const searchResult = await searchWeb(query, 5);
      competitorRefs = searchResult.results || [];
      searchInfo = {
        query,
        answer: searchResult.answer?.slice(0, 300) || '',
        sourceCount: competitorRefs.length,
        sources: competitorRefs.map((r) => ({ title: r.title, url: r.url })),
      };
    } catch (err) {
      console.warn('Pricing web search failed (continuing without references):', err.message);
      searchInfo = { error: err.message, sourceCount: 0, sources: [] };
    }

    // Step 2: generate the pricing suggestion with Groq, grounded by real competitor prices
    let pricing;
    let confidence = 'medium';
    try {
      pricing = await generatePricing({
        transcript,
        rawMaterialCost,
        makingCost,
        imageCount: Array.isArray(images) ? images.length : 0,
        competitorRefs,
      });
    } catch (err) {
      console.warn('Groq pricing failed (falling back to heuristic):', err.message);
      pricing = null;
      confidence = 'low';
    }

    const base = pricing || {};

    const result = {
      rawMaterialCost: raw,
      makingCost: make,
      totalCost,
      suggestedRetailPrice: Number(base.suggestedRetailPrice) || (totalCost > 0 ? Math.round(totalCost * 2.5) : 499),
      suggestedWholesalePrice: Number(base.suggestedWholesalePrice) || (totalCost > 0 ? Math.round(totalCost * 1.8) : 350),
      minRetailPrice: Number(base.minRetailPrice) || (totalCost > 0 ? totalCost : 299),
      maxRetailPrice: Number(base.maxRetailPrice) || (totalCost > 0 ? Math.round(totalCost * 4) : 999),
      currency: base.currency || 'INR',
      confidence: base.confidence || confidence,
      competitors: Array.isArray(base.competitors) && base.competitors.length ? base.competitors : competitorRefs.slice(0, 3).map((r) => ({
        platform: hostnameOf(r.url),
        productName: stripDomain(r.title),
        price: 0,
        currency: 'INR',
      })),
      reasoning: base.reasoning || fallbackPricing({ transcript, rawMaterialCost, makingCost }).reasoning,
    };

    res.json({ pricing: result, search: searchInfo });
  } catch (err) {
    console.error('generate-pricing error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

function hostnameOf(url) {
  try {
    const u = new URL(url);
    return (u.hostname || 'Web').replace(/^www\./, '');
  } catch {
    return 'Web';
  }
}

function stripDomain(title) {
  return (title || '').replace(/\s*[-|]\s*(Amazon|Flipkart|Meesho|Etsy|IndiaMART|Snapdeal|MyFrido|Nykaa)(\.in|\.com)?.*$/i, '') || title;
}

app.listen(PORT, () => {
  console.log(`ArtisanAI server running on http://localhost:${PORT}`);
  console.log(`  Tavily configured:  ${Boolean(process.env.TAVILY_API_KEY)}`);
  console.log(`  Groq configured:    ${Boolean(process.env.GROQ_API_KEY)}`);
  console.log(`  Gemini configured:  ${Boolean(process.env.GEMINI_API_KEY)}`);
});
