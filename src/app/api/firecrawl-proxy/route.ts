import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'edge'; // Edge functions can wait much longer for fetch!

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    
    try {
      const fetchRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${firecrawlKey}` },
        body: JSON.stringify({ url: url })
      });
      
      if (fetchRes.ok) {
        const json = await fetchRes.json();
        if (json.success && json.data && json.data.markdown) {
          return NextResponse.json({ success: true, text: `URL: ${url}\nContent Snippet: ${json.data.markdown.substring(0, 15000)}\n\n` });
        }
      }
      
      console.warn(`Firecrawl failed for ${url} (HTTP ${fetchRes.status}). Using fallback...`);
    } catch(e) {
      console.warn(`Firecrawl fetch error for ${url}. Using fallback...`);
    }
    
    // FALLBACK: Standard fetch + Cheerio
    const fallbackRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (fallbackRes.ok) {
      const html = await fallbackRes.text();
      const $ = cheerio.load(html);
      $('script, style, noscript, iframe, img, svg').remove();
      const text = $('body').text().replace(/\s+/g, ' ').substring(0, 15000);
      return NextResponse.json({ success: true, text: `URL: ${url}\nContent Snippet: ${text}\n\n` });
    }
    
    return NextResponse.json({ success: false, text: `URL: ${url}\nStatus: Firecrawl AND Fallback failed (HTTP ${fallbackRes.status})\n\n` });
    
  } catch (err: any) {
    return NextResponse.json({ success: false, text: `URL: ${url}\nStatus: ${err.message}\n\n` });
  }
}
