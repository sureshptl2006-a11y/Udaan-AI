const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

/**
 * Search the web for pages about a similar product using Tavily.
 * Tavily returns clean, extracted text from relevant pages - perfect for
 * using real competitor descriptions to enrich our AI-generated listing.
 *
 * @param {string} query - The search query (e.g. "Frido posture corrector benefits")
 * @param {number} maxResults - How many source pages to return
 * @returns {Promise<{ answer: string, results: Array<{title:string,url:string,content:string}> }>}
 */
export async function searchWeb(query, maxResults = 5) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not set in server/.env');
  }

  const body = {
    query,
    max_results: maxResults,
    search_depth: 'advanced',
    include_answer: true,
    include_domains: [
      'myfrido.com',
      'flipkart.com',
      'amazon.in',
      'meesho.com',
      'amazon.com',
      'etsy.com',
      'nykaa.com',
      'indiamart.com',
      'snapdeal.com',
    ],
  };

  let res;
  try {
    res = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Tavily request failed: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tavily API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

  return {
    answer: typeof data.answer === 'string' ? data.answer : '',
    results: results
      .filter((r) => r && r.title && r.content)
      .map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
  };
}

/** Build a concise search query from the artisan's short description. */
export function buildSearchQuery(transcript) {
  const cleaned = (transcript || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ').slice(0, 12).join(' ');
  return `${words} benefits price features reviews`;
}

/** Build a query that tries to surface real prices of the same product. */
export function buildPricingSearchQuery(transcript) {
  const cleaned = (transcript || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'handmade artisan product price';
  const words = cleaned.split(' ').slice(0, 10).join(' ');
  return `${words} price buy online`;
}
