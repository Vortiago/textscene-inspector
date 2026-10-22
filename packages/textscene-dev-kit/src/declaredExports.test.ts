import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { declaredExports } from './declaredExports';

const directory = mkdtempSync(join(tmpdir(), 'declared-exports-'));
afterAll(() => rmSync(directory, { recursive: true }));

function declarationFile(text: string): string {
  const path = join(directory, `${Math.random().toString(36).slice(2)}.d.ts`);
  writeFileSync(path, text);
  return path;
}

describe('declaredExports', () => {
  it('lists a declared name and a re-exported name, sorted', () => {
    const path = declarationFile(`
      declare class Parser {}
      export declare function render(): void;
      export { Parser };
    `);

    expect(declaredExports(path)).toEqual(['Parser', 'render']);
  });

  it('lists an exported type and the alias of a renamed export', () => {
    const path = declarationFile(`
      interface Options {}
      declare const inner: number;
      export type Scene = Options;
      export { inner as outer };
    `);

    expect(declaredExports(path)).toEqual(['Scene', 'outer']);
  });

  it('leaves out a name the file declares and keeps to itself', () => {
    const path = declarationFile(`
      interface Hidden {}
      export declare const shown: Hidden;
    `);

    expect(declaredExports(path)).toEqual(['shown']);
  });
});
