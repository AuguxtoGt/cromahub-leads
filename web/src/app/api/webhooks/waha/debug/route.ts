import { NextResponse } from 'next/server';

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://api.cromahub.cloud';
const WAHA_API_KEY = process.env.WAHA_API_KEY || 'CromaHubWahaKey2026';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'sessions';
    const session = url.searchParams.get('session') || '';

    let targetUrl = `${WAHA_API_URL}/api/sessions`;
    if (action === 'session' && session) {
      targetUrl = `${WAHA_API_URL}/api/sessions/${session}`;
    } else if (action === 'qr' && session) {
      targetUrl = `${WAHA_API_URL}/api/${session}/auth/qr`;
    }

    console.log(`[WAHA DEBUG] Fetching ${targetUrl}`);
    const res = await fetch(targetUrl, {
      headers: { 'X-Api-Key': WAHA_API_KEY, 'Accept': 'application/json' }
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json({
      status: res.status,
      data
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
