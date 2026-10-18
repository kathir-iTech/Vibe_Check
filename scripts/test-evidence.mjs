import assert from 'node:assert/strict';
import { findLineNumber, isImplementationLineAt, hasNegationMismatch } from '../src/lib/verification-guards.mjs';

assert.equal(findLineNumber('const method = "GET";', 'const method = "get";'), -1);
assert.equal(findLineNumber('const method = "GET";', 'const Method = "GET";'), -1);
assert.equal(findLineNumber('const value = "a  b";', 'const value = "a b";'), -1);
assert.equal(findLineNumber('const value = "a  b";', '1: const value = "a  b";'), 1);
assert.equal(findLineNumber('if (false) { authenticate(); }', 'authenticate();'), -1);
assert.equal(isImplementationLineAt('/*\nAuthentication implemented\n*/', 2, 'auth.ts'), false);
assert.equal(isImplementationLineAt('export function auth() {}', 1, 'auth.ts'), true);
assert.equal(hasNegationMismatch('OAuth is enabled', 'const enabled = false;'), true);
console.log('PASS: exact source semantics, partial-code rejection, block comments and disabled settings');
