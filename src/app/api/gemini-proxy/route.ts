import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { systemInstruction, contents } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });
    
    const stream = new ReadableStream({
      async start(controller) {
        // Defeat Netlify's 10s inactivity load balancer timeout by streaming empty spaces 
        // every 2 seconds until Gemini finishes thinking and yields the first real chunk.
        const heartbeat = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(' '));
        }, 2000);

        try {
          const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents,
            config: { systemInstruction }
          });

          for await (const chunk of responseStream) {
            if (chunk.text) {
              controller.enqueue(new TextEncoder().encode(chunk.text));
            }
          }
        } catch (e) {
          controller.error(e);
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
