/**
 * The walk of a `next_pass` chain, as both draw adapters step it: a React draw and a draw beside a
 * cloned object. Each adapter loads a pass its own way and asks here what the pass does
 * (`render_forward_clustered.cpp:4183-4226`).
 */

import type { StandardMaterial } from '../../resources/materials/material/types';
import { referenceKey, type ScopedReference } from '../../resources/reading';

/**
 * The visited seed every chain's walk starts from: nothing has drawn yet, so no key is
 * held. The walkers never mutate their visited set, since `visitedWith` returns a new one,
 * so one instance serves every group, every owner and every overlay link per render.
 *
 * @canonical The visited seed of a next_pass chain walk
 */
export const NOTHING_DRAWN: ReadonlySet<string> = new Set();

/**
 * The visited set the next pass walks with: every key so far, plus this pass's own. The
 * walk over a cloned object shares it, so a hand-written cycle draws each material once on
 * both.
 */
function visitedWith(visited: ReadonlySet<string>, source: ScopedReference | undefined): ReadonlySet<string> {
  if (!source) return visited;
  const own = referenceKey(source);
  if (visited.has(own)) return visited;
  return new Set([...visited, own]);
}

/** One pass as the walk reaches it. */
export interface WalkedPass {
  /** Undefined for a surface that holds no material, which starts no chain. */
  source: ScopedReference | undefined;
  /** The draw position: the surface's own draw is 0, each link its index. */
  ordinal: number;
  /** Every source key from the starting material up to this pass, without its own. */
  visited: ReadonlySet<string>;
}

/** A pass that holds a material: every pass after the starting one. */
export type LinkPass = WalkedPass & { source: ScopedReference };

/** What the load of a pass gave its adapter. */
export interface LoadedPass {
  readsStencil: boolean;
  /** The pass after it, resolved in the tables of the file that wrote it. Undefined for none. */
  nextSource: ScopedReference | undefined;
}

/**
 * What a pass does: `ends` the chain, as no material or one that already drew does, `waits` for
 * its load, is `skipped` or is `drawn`.
 */
type PassFate = 'ends' | 'waits' | 'skipped' | 'drawn';

interface PassStep {
  fate: PassFate;
  /** The pass the walk continues at, or null where it stops or waits. */
  next: LinkPass | null;
}

/**
 * What the walk reads of a pass whose material is in, or null while it is not. The pass after it
 * resolves in the tables of the file that wrote the material.
 *
 * @canonical What a next_pass chain walk reads of a loaded pass
 */
export function loadedPassOf(material: StandardMaterial | null): LoadedPass | null {
  if (!material) return null;
  return { readsStencil: material.data.readsStencil, nextSource: material.nextPass ?? undefined };
}

const ENDS: PassStep = { fate: 'ends', next: null };
const WAITS: PassStep = { fate: 'waits', next: null };

/**
 * The step of the walk at `pass`, whose load gave `loaded`. A null `loaded` is a pass still
 * loading, which waits.
 *
 * @canonical One step of a next_pass chain walk
 */
export function nextPassStep(pass: WalkedPass, loaded: LoadedPass | null): PassStep {
  const { source, ordinal, visited } = pass;
  if (!source || visited.has(referenceKey(source))) return ENDS;
  if (!loaded) return WAITS;
  const next = loaded.nextSource
    ? { source: loaded.nextSource, ordinal: ordinal + 1, visited: visitedWith(visited, source) }
    : null;
  return { fate: loaded.readsStencil ? 'skipped' : 'drawn', next };
}
