import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const doc = await adminDb.collection('tasks').doc('MJJH2ugxgaEOLBMcHom5').get();
    return NextResponse.json({ exists: doc.exists, data: doc.data() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
