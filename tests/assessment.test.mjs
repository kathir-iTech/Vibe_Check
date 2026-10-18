import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProduction} from '../scripts/test-support.mjs';
import {evidenceObligation,mapRequirements} from '../src/lib/audit-policy.mjs';
import {tokenize} from '../src/lib/verification-guards.mjs';
const sha='a'.repeat(40);

test('actual drift route never lets source-only support certify a test execution',async()=>{
  const saved=globalThis.fetch;
  globalThis.fetch=async input=>{
    const url=String(input);
    if(url.endsWith('/repos/acme/app'))return Response.json({private:false,default_branch:'main'});
    if(url.endsWith(`/commits/${sha}`))return Response.json({sha});
    if(url.includes('/contents/'))return new Response('{}',{status:404});
    throw new Error(`Unexpected request ${url}`);
  };
  try{
    const {POST}=loadProduction('src/app/api/check-spec-drift/route.ts');
    const response=await POST({json:async()=>({repoUrl:'https://github.com/acme/app',headSha:sha,planningFiles:[],claims:[{id:'c1',text:'All tests passed'}],evidence:{c1:{headSha:sha,files:['tests.ts']}}}),headers:new Headers()});
    const data=await response.json();assert.equal(response.status,200);assert.equal(data.drift[0].verdict,'UNVERIFIED');assert.equal(data.model,null);
  }finally{globalThis.fetch=saved;}
});

test('a mismatched evidence revision is rejected before any model assessment',async()=>{
  const saved=globalThis.fetch;
  globalThis.fetch=async input=>Response.json(String(input).endsWith('/repos/acme/app')?{private:false,default_branch:'main'}:{sha});
  try{
    const {POST}=loadProduction('src/app/api/check-spec-drift/route.ts');
    const response=await POST({json:async()=>({repoUrl:'https://github.com/acme/app',headSha:sha,claims:[{id:'c1',text:'Login function exists'}],evidence:{c1:{headSha:'b'.repeat(40),files:['auth.ts']}}}),headers:new Headers()});
    assert.equal(response.status,502);assert.match((await response.json()).error,/snapshot mismatch/);
  }finally{globalThis.fetch=saved;}
});

test('partial model support is preserved and cannot silently become full support',()=>{
  const {validateAssessments}=loadProduction('src/lib/gemini.ts');
  const claim={id:'c1',text:'A login function exists and password reset is complete'};
  const row={claimId:'c1',contradicts:false,supported:true,coverage:'partial',supportingFile:'auth.ts',supportingQuote:'export const login = () => authorize();'};
  const result=validateAssessments([row],[claim],[],{c1:[{file:'auth.ts',text:row.supportingQuote}]});
  assert.equal(result[0].coverage,'partial');
});

test('requirement conflict mapping requires its exact citation, not only shared words',()=>{
  const rows=[{id:'r1',file:'scope.md',line:1,text:'Must enable user authentication',claimIds:[]}];
  const claims=[{id:'c1',text:'User authentication is enabled'}];
  const verdicts=[{claimId:'c1',verdict:'SPEC-DRIFT',spec:{file:'other.md',line:9}}];
  assert.equal(mapRequirements(rows,claims,verdicts,tokenize)[0].status,'mentioned');
});

test('runtime obligations distinguish a passing result from a source declaration',()=>{
  for(const claim of ['All tests passed','Build succeeded','The application is deployed','WCAG compliance is achieved'])assert.ok(['execution','runtime'].includes(evidenceObligation(claim)));
  assert.equal(evidenceObligation('A test runner dependency is configured'),'configuration');
});
