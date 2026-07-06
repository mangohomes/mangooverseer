import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Server-side fetch bypasses browser CORS restrictions
    const response = await fetch("https://dynamic-taffy-7cc7d4.netlify.app/api/new-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      return NextResponse.json({ error: `CRM returned status ${response.status}. Make sure Mango CRM is deployed!` }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('CRM Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
