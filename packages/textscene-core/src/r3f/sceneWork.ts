import type { ResourceLoader } from '../resources/ResourceLoader.js';
import { textureWork } from '../resources/textures/textureWork.js';
import { fontWork } from './controls/native/text/settledChannel.js';

export interface PendingSceneWork {
  resources: number;
  textures: number;
  fonts: number;
}

/** Fills `into` when given, so a per-frame caller allocates nothing. */
export function pendingSceneWork(
  loader: ResourceLoader | null,
  into: PendingSceneWork = { resources: 0, textures: 0, fonts: 0 }
): PendingSceneWork {
  into.resources = loader?.pendingResourceCount ?? 0;
  into.textures = textureWork.pending();
  into.fonts = fontWork.pending();
  return into;
}

export function totalPendingWork({ resources, textures, fonts }: PendingSceneWork): number {
  return resources + textures + fonts;
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
