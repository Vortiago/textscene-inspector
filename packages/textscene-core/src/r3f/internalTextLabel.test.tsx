/**
 * drei's `<Text>` pulls in troika-three-text, bidi-js and an sdf-generator worker (~312KB raw),
 * which a static import puts in `webview.js` itself. Only a dynamic `import()` inside `lazy()`
 * gets its own chunk, so this reads the module source to tell the two apart.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { InternalTextLabel } from './internalTextLabel';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, 'internalTextLabel.tsx'), 'utf8');

/** A static ESM import statement: `import ... from '<spec>'`. */
const STATIC_IMPORT_RE = /(?:^|\n)\s*import\s+(?:type\s+)?[^;'"]*?\sfrom\s*['"]([^'"]+)['"]/g;

function staticImportSpecifiers(src: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(STATIC_IMPORT_RE.source, 'g');
  while ((m = re.exec(src)) !== null) out.push(m[1]!);
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
