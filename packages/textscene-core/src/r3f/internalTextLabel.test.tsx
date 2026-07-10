/**
 * `InternalTextLabel` wraps drei's `<Text>`, which transitively pulls in
 * troika-three-text + bidi-js + its sdf-generator worker (~312KB raw). Those
 * modules must never be part of the initial-paint static-import closure — a
 * top-level `import { Text } from '@react-three/drei/core/Text'` would put
 * them in `webview.js` itself since `InternalTextLabel` is only reachable one
 * way (`TscnCanvas.tsx` -> `EmptySceneIndicator`), so esbuild can't split it
 * into its own chunk. `React.lazy` fixes that: the dynamic `import()` is only
 * resolved the first time the component actually renders.
 *
 * This test reads the module's own source (rather than importing it) so it
 * can distinguish a *static* value import (bad — bundled eagerly) from a
 * *dynamic* `import()` inside a `lazy()` loader (good — its own chunk).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { InternalTextLabel } from './internalTextLabel';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, 'internalTextLabel.tsx'), 'utf8');

/** Matches `import ... from '<spec>'` — a static ESM import statement. */
const STATIC_IMPORT_RE = /(?:^|\n)\s*import\s+(?:type\s+)?[^;'"]*?\sfrom\s*['"]([^'"]+)['"]/g;

function staticImportSpecifiers(src: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(STATIC_IMPORT_RE.source, 'g');
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

describe('InternalTextLabel bundle boundary (troika stays out of the initial chunk)', () => {
  it('does not statically import drei Text (or troika-three-text directly)', () => {
    const specifiers = staticImportSpecifiers(source);
    const eager = specifiers.filter(
      (s) => /@react-three\/drei/.test(s) || /troika-three-text/.test(s)
    );
    expect(eager).toEqual([]);
  });

  it('lazy-loads drei Text via a dynamic import()', () => {
    expect(source).toMatch(/import\(\s*['"]@react-three\/drei\/core\/Text['"]\s*\)/);
  });

  it('still renders null under vitest (no font-fetch, no unhandled rejection)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <InternalTextLabel text="hello" />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
