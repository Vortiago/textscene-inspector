/**
 * useSpriteFrames — resolves an AnimatedSprite2D's `sprite_frames` reference
 * into its animations map plus the resource pools its frame textures resolve
 * against, from either home a SpriteFrames can live in:
 *
 *   - `SubResource("…")` — embedded in the scene; resolved synchronously
 *     against the scene's internal/external resources (never `pending`).
 *   - `ExtResource("…")` / `res://…` — an external `.tres` SpriteFrames file;
 *     fetched via useResource('Resource') and resolved against the file's own
 *     ext/sub sections (its frame `ExtResource("id")`s reference the .tres's
 *     ids, NOT the scene's). Missing-file panel rows + late-arrival upload
 *     recovery come from useResource.
 *
 * Mirrors useTileSetModel: hook-call count stays constant by feeding `''` to
 * useResource on the synchronous branch (the documented no-request idiom).
 */

import { useMemo } from 'react';
import type { ParsedTresFile } from '../../../parser/tresParser';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import {
  findSubResource,
  parseResourceReference,
  resolveExtResourcePath,
} from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { parseSpriteFramesAnimations, type SpriteFramesAnimation } from './spriteFrames';

export interface ResolvedSpriteFrames {
  /** animation name → its parsed frames + timing. */
  animations: Map<string, SpriteFramesAnimation>;
  /** SubResource pool the frame refs resolve against (scene's, or the .tres's own). */
  subResources: readonly TscnInternalResource[];
  /** ExtResource pool the frame/atlas refs resolve against (scene's, or the .tres's own). */
  externalResources: readonly TscnExternalResource[];
}

export interface SpriteFramesResult {
  spriteFrames: ResolvedSpriteFrames | null;
  status: 'pending' | 'loaded' | 'unavailable';
}

const EMPTY: SpriteFramesResult = { spriteFrames: null, status: 'unavailable' };

export function useSpriteFrames(spriteFramesRef: string | undefined): SpriteFramesResult {
  const { internalResources, externalResources } = useSceneResources();

  const ref = spriteFramesRef ? parseResourceReference(spriteFramesRef) : null;
  const isExternal =
    !!spriteFramesRef && (ref?.type === 'ExtResource' || spriteFramesRef.startsWith('res://'));
  const resolvedPath = isExternal ? resolveExtResourcePath(spriteFramesRef, externalResources) : null;
  // Only text resources can ever parse; a binary `.res` SpriteFrames would park
  // the load in-flight forever (no processor handles it).
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  const tresResult = useResource<ParsedTresFile>(tresPath ?? '', 'Resource');

  return useMemo((): SpriteFramesResult => {
    if (!spriteFramesRef) return EMPTY;

    // In-scene SubResource — resolve synchronously against the scene's pools.
    if (ref?.type === 'SubResource') {
      const sub = findSubResource(internalResources, ref.id);
      const animations = parseAnimations((sub?.data as Record<string, unknown> | undefined)?.animations);
      return animations
        ? { spriteFrames: { animations, subResources: internalResources, externalResources }, status: 'loaded' }
        : EMPTY;
    }

    // External `.tres` SpriteFrames — async; resolve frames against the FILE's
    // own ext/sub sections (its frame ids are scoped to the .tres). A non-`.tres`
    // external (e.g. a binary `.res`) leaves tresPath null → unresolvable.
    if (!tresPath) return EMPTY;
    if (tresResult.status === 'pending') return { spriteFrames: null, status: 'pending' };
    if (tresResult.status === 'unavailable' || !tresResult.value) return EMPTY;

    const file = tresResult.value;
    const animations = parseAnimations(file.properties.animations);
    return animations
      ? {
          spriteFrames: {
            animations,
            subResources: file.subResources,
            externalResources: file.extResources,
          },
          status: 'loaded',
        }
      : EMPTY;
  }, [spriteFramesRef, ref?.type, ref?.id, internalResources, externalResources, resolvedPath, tresPath, tresResult.status, tresResult.value]);
}

/** Parse a raw `animations` value into the map, or null when absent/empty. */
function parseAnimations(value: unknown): Map<string, SpriteFramesAnimation> | null {
  if (typeof value !== 'string') return null;
  const map = parseSpriteFramesAnimations(value);
  return map.size > 0 ? map : null;
}
