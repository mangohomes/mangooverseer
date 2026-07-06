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

    const systemInstruction = `You are a Daily New Construction Residential Expert.
Your job is to scour provided websites and extract ANY new information regarding builder incentives or new neighborhood approvals specifically in Horry and Brunswick counties.
Use the scrape_urls tool to gather today's data.

Summarize your findings in a few concise bullet points. Be extremely precise. DO NOT hallucinate.`;

    // Real Web Scraping Logic
    const settingsDoc = await adminDb.collection('settings').doc('warehouse').get();
    let constructionUrlsStr = "https://horrycounty.org/planning/approvals\nhttps://drhorton.com/south-carolina/myrtle-beach";
    if (settingsDoc.exists && settingsDoc.data()?.newConstructionUrls) {
      constructionUrlsStr = settingsDoc.data()?.newConstructionUrls;
    }
    const targetUrls = constructionUrlsStr.split('\\n').map(u => u.trim()).filter(u => u);

    let scrapeData = "[LIVE SCRAPE RESULTS]\n\n";

    for (const url of targetUrls) {
      try {
        const fetchRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const $ = cheerio.load(html);
          
          $('script, style, noscript, nav, footer').remove();
          const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 2000);
          
          scrapeData += `URL: ${url}\nContent Snippet: ${bodyText}\n\n`;
        } else {
          scrapeData += `URL: ${url}\nStatus: Could not fetch (HTTP ${fetchRes.status})\n\n`;
        }
      } catch (err: any) {
        scrapeData += `URL: ${url}\nStatus: Failed to fetch (${err.message})\n\n`;
      }
    }

    const contents: any[] = [
      { role: 'user', parts: [{ text: "Run today's daily scrape for Horry and Brunswick county new construction data. Use your tools to check the mock URLs." }] }
    ];

    contents.push({ role: 'model', parts: [{ text: "I will now scrape the target new construction websites." }] });
    contents.push({ role: 'user', parts: [{ text: `Here are the results of the automated web scan:\n\n${scrapeData}` }] });

    let response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: { systemInstruction }
    });

    let finalSummary = response.text;

    // Append to weeklyFindings
    const currentFindings = bee?.weeklyFindings || [];
    currentFindings.push({
      date: new Date().toISOString(),
      summary: finalSummary
    });

    await beeRef.update({
      weeklyFindings: currentFindings,
      status: 'idle', // Ready for next run
      lastDailyRunAt: new Date()
    });

    return NextResponse.json({ success: true, summary: finalSummary });

  } catch (error: any) {
    console.error('Daily Bee Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
