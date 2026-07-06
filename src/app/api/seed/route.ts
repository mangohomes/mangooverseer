import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    await adminDb.collection('tasks').add({
      title: 'Gemini Bee',
      description: 'Weekly AI Tech Reporter. Scours the web for the latest Google Gemini features and models, formatting them into quick alerts.',
      category: 'bee',
      beeType: 'gemini-updates',
      status: 'idle',
      schedule: 'Every Monday Morning',
      createdAt: new Date().toISOString()
    });
    return NextResponse.json({ success: true, message: 'Seeded Gemini Bee' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
