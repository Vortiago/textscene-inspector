/**
 * The freshness gate every dist-reading ledger sits behind.
 *
 * Built from literal buildinfo JSON rather than by shelling out to `tsc`: the
 * cases that matter are the ones a real run produces rarely or never, and a
 * test that invokes the compiler would take the repo's own stamp with it.
 */

import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stalenessMessage } from './distFreshness.mjs';

/** A core package whose dist is genuinely current, plus whatever the case adds. */
function fakeCore(record) {
  const core = mkdtempSync(join(tmpdir(), 'dist-freshness-'));
  mkdirSync(join(core, 'src'));
  mkdirSync(join(core, 'dist'));
  writeFileSync(join(core, 'src/a.ts'), 'export const a = 1;\n');
  writeFileSync(join(core, 'dist/a.js'), 'export const a = 1;\n');
  writeFileSync(
    join(core, 'tsconfig.tsbuildinfo'),
    JSON.stringify({ fileNames: ['./src/a.ts'], fileInfos: [], ...record })
  );
  // The stamp must postdate the source, which is what a real build guarantees
  // and what a same-second write does not.
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(core, 'src/a.ts'), past, past);
  return core;
}

describe('stalenessMessage', () => {
  it('passes a build that emitted everything it evaluated', () => {
    expect(stalenessMessage(fakeCore({ latestChangedDtsFile: './dist/a.d.ts' }))).toBeNull();
  });

  it('refuses a stamp a --noEmit run wrote, however fresh its mtime', () => {
    // `pnpm type-check` rewrites the same record a build does. Without this the
    // stamp reads as newer than every source and dist reads as current, which
    // is how four ledgers reported a previous revision's registries as fact.
    const message = stalenessMessage(
      fakeCore({ affectedFilesPendingEmit: [[1, 1]], emitSignatures: [1] }),
      'this ledger'
    );
    expect(message).toContain('type-check rather than a build');
    expect(message).toContain('pnpm --filter @textscene/core build');
  });

  it('still refuses an empty dist, which is the older failure', () => {
    const core = mkdtempSync(join(tmpdir(), 'dist-freshness-'));
    mkdirSync(join(core, 'src'));
    writeFileSync(join(core, 'src/a.ts'), 'export const a = 1;\n');
    expect(stalenessMessage(core)).toContain('is not built');
  });

  it('reports a build that ended in type errors before anything else', () => {
    const message = stalenessMessage(
      fakeCore({ semanticDiagnosticsPerFile: [[1, []]], fileNames: ['./src/a.ts'] })
    );
    expect(message).toContain('last built with type errors');
  });
});
