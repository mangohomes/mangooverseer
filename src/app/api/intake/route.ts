import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export async function POST(req: Request) {
  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    const inlineDataParts = images.map((img: any) => ({
      inlineData: {
        data: img.base64Image.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: img.mimeType,
      }
    }));

const systemInstruction = `You are a Data Entry Kitten. 
You will be provided with an image of a handwritten real estate intake form.
Extract the following fields into a precise JSON format:
- clientNames (string or array of strings)
- phone (string)
- email (string)
- budget (string, e.g., "425K MAX")
- location (string)
- timeframe (string, e.g., "June 25-27")
- hasUpcomingVisit (boolean, true if there is an upcoming visit date mentioned, false otherwise)
- intakeDate (string in YYYY-MM-DD format if present on the form, otherwise null)
- wants (array of strings, e.g., ["One level", "Quieter", "Extended garage"])
- doNotWants (array of strings, e.g., ["No flood zone", "Carpet in bedrooms"])

If a field is completely unreadable or missing, use null or an empty array. Do not make up information. Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...inlineDataParts,
        'Extract the data from this intake sheet (which may span multiple images).'
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text;
    
    let extractedData = {};
    try {
      extractedData = JSON.parse(resultText || "{}");
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", e);
      return NextResponse.json({ error: 'Failed to parse image data' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: extractedData });

  } catch (error: any) {
    console.error('Intake Kitten Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
