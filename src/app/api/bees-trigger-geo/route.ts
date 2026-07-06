import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';
import * as cheerio from 'cheerio';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { beeId } = await req.json();
    if (!beeId) return NextResponse.json({ error: 'beeId required' }, { status: 400 });

    const beeRef = adminDb.collection('tasks').doc(beeId);
    const beeDoc = await beeRef.get();
    
    if (!beeDoc.exists) return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
    const bee = beeDoc.data();

    const systemInstruction = `You are a Generative Engine Optimization (GEO) Expert.
Your job is to audit a real estate team's digital footprint ("Mango Homes") to ensure high visibility on AI-powered search engines (like Perplexity, ChatGPT, and Google AI Overviews).

Review the provided mock scrape data for Mango Homes' website and social media presence.
Output EXACTLY 5 highly actionable optimization tips formatted clearly. Be concise, direct, and specifically focused on AI search visibility (e.g., semantic density, answering specific buyer questions, formatting data as tables). DO NOT hallucinate tips that aren't based on GEO best practices.`;

    const contents: any[] = [
      { role: 'user', parts: [{ text: "Perform the weekly GEO audit for Mango Homes based on their digital footprint." }] }
    ];

    // Real Web Scraping Logic
    const settingsDoc = await adminDb.collection('settings').doc('warehouse').get();
    let geoFootprintStr = "https://mangohomes.com\nhttps://facebook.com/mangohomes\nhttps://instagram.com/mangohomes.sc";
    if (settingsDoc.exists && settingsDoc.data()?.geoFootprint) {
      geoFootprintStr = settingsDoc.data()?.geoFootprint;
    }
    const targetUrls = geoFootprintStr.split('\\n').map(u => u.trim()).filter(u => u);

    let scrapeData = "[LIVE DIGITAL FOOTPRINT AUDIT RESULTS]\n\n";

    for (const url of targetUrls) {
      try {
        const fetchRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const $ = cheerio.load(html);
          
          // Remove scripts and styles
          $('script, style, noscript').remove();
          
          // Extract text and trim down to a reasonable chunk for the AI
          const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 1500);
          
          const metaTitle = $('title').text();
          const metaDesc = $('meta[name="description"]').attr('content') || 'No meta description';
          
          scrapeData += `URL: ${url}\nTitle: ${metaTitle}\nMeta: ${metaDesc}\nContent Snippet: ${bodyText}\n\n`;
        } else {
          scrapeData += `URL: ${url}\nStatus: Could not fetch (HTTP ${fetchRes.status}). Ensure URL is publicly accessible or has no bot protection.\n\n`;
        }
      } catch (err: any) {
        scrapeData += `URL: ${url}\nStatus: Failed to fetch (${err.message})\n\n`;
      }
    }

    contents.push({ role: 'model', parts: [{ text: "I will scan the URLs provided in the Data Warehouse now." }] });
    contents.push({ role: 'user', parts: [{ text: `Here are the results of the automated web scan:\n\n${scrapeData}` }] });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: { systemInstruction }
    });

    const finalResult = response.text;

    await beeRef.update({
      result: finalResult,
      status: 'completed',
      completedAt: new Date(),
      lastRunAt: new Date()
    });

    return NextResponse.json({ success: true, result: finalResult });

  } catch (error: any) {
    console.error('GEO Bee Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
