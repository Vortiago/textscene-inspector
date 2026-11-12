import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import type { DirectoryListing } from '../../../resources/directoryListing';
import { settleDirectories } from './directoryResolution';
import type { DirectoryResolver } from './solverRegistry';

const node = { name: 'N', type: 'T', children: [], properties: {}, rawProperties: {} } as TscnNode;

/** Asks for `a`, then for `b` once `a` is answered with a missing folder. */
const chained: DirectoryResolver = {
  folders: (_node, listings) => (listings.a?.kind === 'missing' ? ['a', 'b'] : ['a']),
  resolve: (n, listings) => ({ ...n, properties: { seen: Object.keys(listings) } }) as TscnNode,
};

describe('settleDirectories', () => {
  it('reads the folders a resolver asks for, following an answer to the next folder', () => {
    const answers: Record<string, DirectoryListing> = {
      a: { kind: 'missing' },
      b: { kind: 'listed', entries: [] },
    };
    const settled = settleDirectories(node, chained, (folder) => answers[folder], new Set());
    expect((settled.properties as { seen: string[] }).seen).toEqual(['a', 'b']);
  });

  it('hands back each folder the cache has not seen, and reads it as unanswered', () => {
    const pending = new Set<string>();
    const settled = settleDirectories(node, chained, () => undefined, pending);
    expect([...pending]).toEqual(['a']);
    expect((settled.properties as { seen: string[] }).seen).toEqual(['a']);
  });

  it('does not hand back a folder whose listing failed', () => {
    const pending = new Set<string>();
    settleDirectories(node, chained, () => null, pending);
    expect(pending.size).toBe(0);
  });
});
