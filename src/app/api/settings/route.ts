import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const doc = await adminDb.collection('settings').doc('warehouse').get();
    if (!doc.exists) {
      return NextResponse.json({
        newConstructionUrls: "https://horrycounty.org/planning/approvals\nhttps://drhorton.com/south-carolina/myrtle-beach",
        geoFootprint: "https://mangohomes.com\nhttps://facebook.com/mangohomes\nhttps://instagram.com/mangohomes.sc"
      });
    }
    return NextResponse.json(doc.data());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    await adminDb.collection('settings').doc('warehouse').set(data, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
