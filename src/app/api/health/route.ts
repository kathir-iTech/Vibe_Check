import { NextResponse } from 'next/server';
import { VERIFIER_VERSION } from '@/lib/audit-policy.mjs';
export async function GET(){
  return NextResponse.json({status:'configured',verifierVersion:VERIFIER_VERSION,sourceHead:process.env.VERCEL_GIT_COMMIT_SHA||null,gitBranch:process.env.VERCEL_GIT_COMMIT_REF||null,signingConfigured:(process.env.REPORT_SIGNING_SECRET?.length||0)>=32,providerConfigured:Boolean(process.env.GEMINI_API_KEY),scope:'Configuration check only. Provider availability and actual source observations require a completed audit.'},{headers:{'Cache-Control':'no-store'}});
}
