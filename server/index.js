import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { searchWeb, buildSearchQuery } from './services/searchService.js';
import { generateCatalog } from './services/groqService.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
  });
});

/**
 * POST /api/generate-description
 * Body: { transcript: string, images: Array<{uri}>, language?: string }
 *
 * 1. Searches the web for similar products (Tavily)
 * 2. Feeds the artisan's description + real competitor content into Groq
 * 3. Returns the enriched, structured product listing
 */
app.post('/api/generate-description', async (req, res) => {
  try {
    const { transcript = '', images = [], language = 'en-US' } = req.body || {};

    if (!transcript?.trim()) {
      return res.status(400).json({ error: 'A short product description is required.' });
    }

    // Step 1: search the web for similar products
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

    // Step 2: generate the listing with Groq, enriched by competitor content
    const catalog = await generateCatalog({
      transcript,
      imageCount: Array.isArray(images) ? images.length : 0,
      referenceContent,
    });

    res.json({
      catalog,
      search: searchInfo,
    });
  } catch (err) {
    console.error('generate-description error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`ArtisanAI server running on http://localhost:${PORT}`);
  console.log(`  Tavily configured: ${Boolean(process.env.TAVILY_API_KEY)}`);
  console.log(`  Groq configured:   ${Boolean(process.env.GROQ_API_KEY)}`);
});
