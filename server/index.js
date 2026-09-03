import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { searchWeb, buildSearchQuery } from './services/searchService.js';
import { generateCatalog } from './services/groqService.js';
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

app.listen(PORT, () => {
  console.log(`ArtisanAI server running on http://localhost:${PORT}`);
  console.log(`  Tavily configured:  ${Boolean(process.env.TAVILY_API_KEY)}`);
  console.log(`  Groq configured:    ${Boolean(process.env.GROQ_API_KEY)}`);
  console.log(`  Gemini configured:  ${Boolean(process.env.GEMINI_API_KEY)}`);
});
