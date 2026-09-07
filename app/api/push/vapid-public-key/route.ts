import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/web-push';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({ publicKey: getVapidPublicKey() });
  } catch {
    return NextResponse.json({ error: 'Web Push is not configured yet.' }, { status: 503 });
  }
}
