import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    version: '2.1.0',
    buildAt: new Date().toISOString(),
    features: ['manual-button', 'clear-queue']
  });
}
