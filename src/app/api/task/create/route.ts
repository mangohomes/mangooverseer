import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { title, description, category, status } = await req.json();

    const docRef = adminDb.collection('tasks').doc();
    await docRef.set({
      title,
      description,
      category,
      status,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('Task Create Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
