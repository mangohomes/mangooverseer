import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { systemInstruction, contents } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });
    
    let response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: { systemInstruction }
    });

    if (!response.text) {
        throw new Error(`Empty response from Gemini. Finish reason: ${response.candidates?.[0]?.finishReason}`);
    }

    return NextResponse.json({ success: true, text: response.text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
