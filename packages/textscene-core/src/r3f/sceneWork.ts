import type { ViewWork } from '../resources/viewWork.js';
import { subscribeToNothing } from '../utils/subscribeToNothing.js';

export interface PendingSceneWork {
  resources: number;
  textures: number;
  fonts: number;
}

/** Fills `into` when given, so a per-frame caller allocates nothing. */
export function pendingSceneWork(
  work: ViewWork | null,
  into: PendingSceneWork = { resources: 0, textures: 0, fonts: 0 }
): PendingSceneWork {
  into.resources = work?.resources.pending() ?? 0;
  into.textures = work?.textures.pending() ?? 0;
  into.fonts = work?.fonts.pending() ?? 0;
  return into;
}

/**
 * Reads the counts in place, so a snapshot that runs on every render allocates nothing.
 *
 * @canonical Whether a view has work in flight
 */
export function isViewWorking(work: ViewWork | null): boolean {
  return work !== null && work.resources.pending() + work.textures.pending() + work.fonts.pending() > 0;
}

/**
 * A null view subscribes to nothing.
 *
 * @canonical Subscribing to every work count of a view
 */
export function subscribeSceneWork(work: ViewWork | null, onChange: () => void): () => void {
  if (!work) return subscribeToNothing();
  const stops = [work.resources, work.textures, work.fonts].map((count) => count.subscribe(onChange));
  return () => stops.forEach((stop) => stop());
}

export function totalPendingWork({ resources, textures, fonts }: PendingSceneWork): number {
  return resources + textures + fonts;
}

export function isSamePendingWork(a: PendingSceneWork, b: PendingSceneWork): boolean {
  return a.resources === b.resources && a.textures === b.textures && a.fonts === b.fonts;
}

export function hasPendingWork(work: PendingSceneWork): boolean {
  return totalPendingWork(work) > 0;
}

export function describePendingWork({ resources, textures, fonts }: PendingSceneWork): string {
  const kinds = [countOf(resources, 'resource'), countOf(textures, 'texture'), countOf(fonts, 'font')].filter(
    (kind) => kind !== null
  );
  return kinds.length < 2 ? (kinds[0] ?? '') : `${kinds.slice(0, -1).join(', ')} and ${kinds.at(-1)}`;
}

function countOf(count: number, noun: string): string | null {
  if (count === 0) return null;
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
