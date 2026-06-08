import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY não está definida no ambiente!' });
  }

  const keyPreview = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;

  // Testa chamada real à Places API (New)
  const testResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName',
    },
    body: JSON.stringify({
      textQuery: 'farmácia em São Paulo',
      pageSize: 1,
    }),
  });

  const rawText = await testResponse.text();
  let parsedBody: any;
  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    parsedBody = rawText;
  }

  return NextResponse.json({
    key_preview: keyPreview,
    key_length: apiKey.length,
    http_status: testResponse.status,
    http_status_text: testResponse.statusText,
    google_response: parsedBody,
  });
}
