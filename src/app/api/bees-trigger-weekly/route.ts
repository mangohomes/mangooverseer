import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { beeId } = await req.json();
    if (!beeId) return NextResponse.json({ error: 'beeId required' }, { status: 400 });

    const beeRef = adminDb.collection('tasks').doc(beeId);
    const beeDoc = await beeRef.get();
    
    if (!beeDoc.exists) return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
    const bee = beeDoc.data();

    const findings = bee.weeklyFindings || [];
    
    if (findings.length === 0) {
      return NextResponse.json({ success: true, message: "No data to summarize." });
    }

    const systemInstruction = `You are a professional real estate assistant.
Your job is to draft a clean, well-formatted weekly email summarizing new construction data for your team.
Take the raw daily findings provided by the user, group them logically (e.g. by builder, or by county), and write an executive summary email.`;

    const rawDataStr = findings.map((f: any) => `Date: ${f.date}\nSummary: ${f.summary}`).join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Draft the weekly email based on these daily findings:\n\n${rawDataStr}`,
      config: { systemInstruction }
    });

    const finalEmail = response.text;

    // Save email, mark as completed, and RESET weeklyFindings
    await beeRef.update({
      result: finalEmail,
      status: 'completed',
      weeklyFindings: [], // Reset for next week!
      completedAt: new Date(),
      lastWeeklyRunAt: new Date()
    });

    // Actually send the email via Resend
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Overseer <onboarding@resend.dev>',
        to: process.env.RECIPIENT_EMAIL || 'delivered@resend.dev', // Fallback for testing
        subject: 'Weekly New Construction Summary 🐝',
        html: `<div style="font-family: sans-serif; white-space: pre-wrap;">${finalEmail}</div>`,
      });
    }

    return NextResponse.json({ success: true, email: finalEmail });

  } catch (error: any) {
    console.error('Weekly Bee Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
