import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const settingsDoc = await adminDb.collection('settings').doc('warehouse').get();
    
    let scrapeData = "";

    const inboxEmails = settingsDoc.exists && settingsDoc.data()?.inboxEmails ? settingsDoc.data()?.inboxEmails : [];
    if (inboxEmails.length > 0) {
      scrapeData += `[FORWARDED INBOX EMAILS]\n`;
      inboxEmails.forEach((email: any) => {
        const bodyText = typeof email.body === 'string' ? email.body : '';
        scrapeData += `From: ${email.sender}\nSubject: ${email.subject}\nDate: ${email.date}\nBody Snippet: ${bodyText.substring(0, 3000)}\n\n`;
      });
      scrapeData += `[END OF EMAILS]\n\n`;
      
      // Clear the emails from the database so they aren't processed again tomorrow
      await adminDb.collection('settings').doc('warehouse').set({ inboxEmails: [] }, { merge: true });
    }

    return NextResponse.json({ success: true, text: scrapeData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
