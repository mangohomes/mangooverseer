import { NextResponse } from 'next/server';
import { cert } from 'firebase-admin/app';

export async function GET() {
  try {
    let pk = process.env.FIREBASE_PRIVATE_KEY || '';
    if (pk.startsWith('"') && pk.endsWith('"')) {
      pk = pk.substring(1, pk.length - 1);
    }
    pk = pk.replace(/\\n/g, '\n').replace(/\r/g, '');

    if (pk && !pk.includes('\n')) {
      pk = pk.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '');
      const chunks = pk.match(/.{1,64}/g) || [];
      pk = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;
    } else if (pk && !pk.includes('-----BEGIN PRIVATE KEY-----')) {
      pk = `-----BEGIN PRIVATE KEY-----\n${pk}\n-----END PRIVATE KEY-----\n`;
    }

    try {
      cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: pk,
      });
      return NextResponse.json({ success: true, message: "Cert generated successfully" });
    } catch (e: any) {
      return NextResponse.json({ 
        success: false, 
        error: e.message,
        projectIdLength: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.length || 0,
        clientEmailLength: process.env.FIREBASE_CLIENT_EMAIL?.length || 0,
        privateKeyLength: pk.length,
        rawPrivateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0
      });
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, outerError: e.message });
  }
}
