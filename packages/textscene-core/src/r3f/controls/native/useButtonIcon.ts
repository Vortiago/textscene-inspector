/**
 * The two icon hooks every Button-family painter shares: Button's own `icon` property, and the colour an
 * icon draws in (`button.cpp:278-330`).
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import { sizeWithArea } from '../../../resources/textures/textureSize';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useOwnerCanvas2DTexture } from '../../canvas2DTextureDecode';
import { useItemLinearColor } from '../../canvasItemModulate';
import type { Rgba } from '../../../godot/math/math';
import type { Vector2 } from '../../../godot/math/vector';
import { tintColor } from './buttonBase';
import type { SolveNode } from './solveTree';

interface OwnButtonIcon {
  /** `null` until the texture loads, and for no `icon`. */
  texture: THREE.Texture | null;
  /** The icon's size in pixels, `null` when `texture` is. */
  naturalSize: Vector2 | null;
}

/** Button's own `icon` property, resolved in the node's own scope: a node that arrived through an instanced sub-scene names ids from that scene. */
export function useOwnButtonIcon(solveNode: SolveNode, ref: string | undefined): OwnButtonIcon {
  const { externalResources, internalResources } = solveNode.resources;
  // `useTexture2D`, not the path-only resolver: an icon may be an inline procedural texture, which has no path to load from.
  const { texture: source, size } = useTexture2D(ref, externalResources, internalResources);
  // NoColorSpace: the 2D canvas's hardware filter blends undecoded sRGB bytes
  // (`canvas2DTextureDecode.ts`), and `ControlQuad` decodes the filtered sample once it sees this tag.
  const texture = useOwnerCanvas2DTexture(source);
  return useMemo(
    () => ({ texture, naturalSize: texture && ref ? sizeWithArea(size) : null }),
    [texture, ref, size]
  );
}

/** An icon's `base` modulate times the item's own tint, converted to linear once (`button.cpp:278-330`). */
export function useIconModulate(base: Rgba, tint: Rgba): { color: THREE.Color; opacity: number } {
  const srgb = useMemo(() => tintColor(base, tint), [base, tint]);
  const color = useItemLinearColor(srgb);
  return { color, opacity: srgb.a };
}
