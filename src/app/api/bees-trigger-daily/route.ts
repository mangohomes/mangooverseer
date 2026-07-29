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
Your job is to scour provided websites and extract ANY new information specifically regarding:
1. Discounted prices or price cuts on homes
2. Builder incentives (e.g., closing costs, rate buydowns, free upgrades)
3. New neighborhood approvals or new phase releases
4. The exact number of move-in ready (quick move-in) homes available per subdivision

Focus specifically on Horry and Brunswick counties.

**Builder:** [Builder Name]
**Incentives:** [List incentives or write "no"]
**Move-In Ready:** [quantity and price range if possible, or "no"]
**New Subdivisions or phases open:** [if so, what?. If no, put "no"]

At the very end of your response, add a single bullet point listing any sites that failed to fetch:
* **Failed to Pull:** [List sites here, or write "None"]

Summarize your findings in a few concise bullet points. Be extremely precise. DO NOT hallucinate.`;

    // Real Web Scraping Logic
    const settingsDoc = await adminDb.collection('settings').doc('warehouse').get();
    let constructionUrlsStr = "https://horrycounty.org/planning/approvals\nhttps://drhorton.com/south-carolina/myrtle-beach";
    if (settingsDoc.exists && settingsDoc.data()?.newConstructionUrls) {
      constructionUrlsStr = settingsDoc.data()?.newConstructionUrls;
    }
    const targetUrls = constructionUrlsStr.split('\n').map(u => {
      let url = u.trim();
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      return url;
    }).filter(u => u);

    let scrapeData = "[LIVE SCRAPE RESULTS]\n\n";

    for (const url of targetUrls) {
      let success = false;
      let lastError = '';
      
      // Try to fetch up to 2 times
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const fetchRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.5" }});
          if (fetchRes.ok) {
            const html = await fetchRes.text();
            const $ = cheerio.load(html);
            
            $('script, style, noscript, nav, footer').remove();
            const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 15000);
            
            scrapeData += `URL: ${url}\nContent Snippet: ${bodyText}\n\n`;
            success = true;
            break; // Exit retry loop on success
          } else {
            lastError = `HTTP ${fetchRes.status}`;
            // Wait 1.5 seconds before retrying
            await new Promise(r => setTimeout(r, 1500));
          }
        } catch (err: any) {
          lastError = err.message;
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      
      if (!success) {
        scrapeData += `URL: ${url}\nStatus: Failed to fetch after 2 attempts (${lastError})\n\n`;
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
