import ts from 'typescript';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const nativeRequire = createRequire(import.meta.url);
export function loadProduction(relative, overrides = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = specifier => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return nativeRequire(specifier);
      const candidate = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2)) : resolve(dirname(file), specifier);
      if (extname(candidate) === '.mjs' || extname(candidate) === '.json') return nativeRequire(candidate);
      const resolved = existsSync(candidate) ? candidate : `${candidate}.ts`;
      return load(resolved);
    };
    const run = vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){${source}\n})`, { filename: file });
    run(localRequire, module, module.exports, file, dirname(file));
    return module.exports;
  }
  return load(resolve(root, relative));
}
