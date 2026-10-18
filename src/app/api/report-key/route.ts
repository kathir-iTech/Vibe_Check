import { NextResponse } from 'next/server';
import { reportVerificationKey } from '@/lib/report-crypto.mjs';
export async function GET() {
  try { return NextResponse.json(reportVerificationKey(),{headers:{'Cache-Control':'no-store'}}); }
  catch { return NextResponse.json({error:'Report signing is unavailable; ordinary unsigned exports remain available.'},{status:503}); }
}
