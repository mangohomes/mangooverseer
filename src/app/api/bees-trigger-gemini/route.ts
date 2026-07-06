import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { beeId } = await req.json();
    if (!beeId) return NextResponse.json({ error: 'beeId required' }, { status: 400 });

    const beeRef = adminDb.collection('tasks').doc(beeId);
    const beeDoc = await beeRef.get();
    
    if (!beeDoc.exists) return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
    const bee = beeDoc.data();

    const systemInstruction = `You are a Weekly AI Tech Reporter for a busy real estate team.
Your job is to read the latest tech news regarding Google Gemini and summarize any new features, models, or capabilities into quick, highly digestible alerts.

Output a clean, bulleted list alerting the user to the feature and briefly explaining what it does.
Example format:
- Gemini released Gemini with Canvas. It does [X]...

Be concise and direct. DO NOT hallucinate features that aren't in the provided news data.`;

    const contents: any[] = [
      { role: 'user', parts: [{ text: "Perform the weekly AI tech scan for Google Gemini updates." }] }
    ];

    // Fetch real news using Tavily
    let searchData = "";
    if (process.env.TAVILY_API_KEY) {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: "latest Google Gemini AI features models updates news",
          search_depth: "advanced",
          include_answer: true,
          days: 7 // Only look for news in the last 7 days
        })
      });
      
      if (tavilyRes.ok) {
        const tavilyJson = await tavilyRes.json();
        searchData = `[LIVE WEB SEARCH RESULTS (via Tavily)]\n\nAI Summary: ${tavilyJson.answer}\n\nTop Results:\n`;
        tavilyJson.results.forEach((r: any) => {
          searchData += `- ${r.title}: ${r.content}\n`;
        });
      } else {
        searchData = "[ERROR: Failed to fetch live data from Tavily API]";
      }
    } else {
      searchData = "[ERROR: Tavily API key missing. Cannot perform live search.]";
    }

    contents.push({ role: 'model', parts: [{ text: "I will scan the web for the latest Google Gemini news now." }] });
    contents.push({ role: 'user', parts: [{ text: `Here are the results of the automated web scan:\n\n${searchData}` }] });

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
    console.error('Gemini Bee Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
