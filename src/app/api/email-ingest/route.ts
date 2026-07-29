import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { subject, body, sender, date } = data;

    if (!subject || !body) {
      return NextResponse.json({ error: 'Missing subject or body' }, { status: 400 });
    }

    const warehouseRef = adminDb.collection('settings').doc('warehouse');
    
    // Append the new email to the inboxEmails array using Firestore FieldValue arrayUnion
    await warehouseRef.set({
      inboxEmails: FieldValue.arrayUnion({
        subject,
        body,
        sender: sender || 'Unknown',
        date: date || new Date().toISOString(),
        ingestedAt: new Date().toISOString()
      })
    }, { merge: true });

    return NextResponse.json({ success: true, message: 'Email successfully ingested into the Data Warehouse' });

  } catch (error: any) {
    console.error('Email Ingest Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
