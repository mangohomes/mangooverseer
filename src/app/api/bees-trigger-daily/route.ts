import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';
import * as cheerio from 'cheerio';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { beeId, finalSummary } = await req.json();
    if (!beeId) return NextResponse.json({ error: 'beeId required' }, { status: 400 });
    if (!finalSummary) return NextResponse.json({ error: 'finalSummary required' }, { status: 400 });

    const beeRef = adminDb.collection('tasks').doc(beeId);
    const beeDoc = await beeRef.get();
    
    if (!beeDoc.exists) return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
    const bee = beeDoc.data();

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
