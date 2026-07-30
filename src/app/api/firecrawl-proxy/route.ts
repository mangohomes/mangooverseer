import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'edge'; // Edge functions can wait much longer for fetch!

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;

    const stream = new ReadableStream({
      async start(controller) {
        // Heartbeat to defeat Netlify 10s load balancer inactivity timeout
        const heartbeat = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(' '));
        }, 2000);

        try {
          let responseJson = null;

          try {
            const fetchRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${firecrawlKey}` },
              body: JSON.stringify({ url: url })
            });
            
            if (fetchRes.ok) {
              const json = await fetchRes.json();
              if (json.success && json.data && json.data.markdown) {
                responseJson = { success: true, text: `URL: ${url}\nContent Snippet: ${json.data.markdown.substring(0, 15000)}\n\n` };
              }
            }
          } catch(e) {
            console.warn(`Firecrawl fetch error for ${url}. Using fallback...`);
          }
          
          if (!responseJson) {
            // FALLBACK: Standard fetch + Cheerio
            const fallbackRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            if (fallbackRes.ok) {
              const html = await fallbackRes.text();
              const $ = cheerio.load(html);
              $('script, style, noscript, iframe, img, svg').remove();
              const text = $('body').text().replace(/\s+/g, ' ').substring(0, 15000);
              responseJson = { success: true, text: `URL: ${url}\nContent Snippet: ${text}\n\n` };
            } else {
              responseJson = { success: false, text: `URL: ${url}\nStatus: Firecrawl AND Fallback failed (HTTP ${fallbackRes.status})\n\n` };
            }
          }

          controller.enqueue(new TextEncoder().encode(JSON.stringify(responseJson)));
        } catch (e: any) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ success: false, text: `URL: ${url}\nStatus: ${e.message}\n\n` })));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, text: `Status: ${err.message}\n\n` });
  }
}
