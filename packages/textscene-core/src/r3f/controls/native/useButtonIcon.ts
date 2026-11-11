/**
 * The two icon hooks every Button-family painter shares: Button's own `icon` property, and the colour an
 * icon draws in (`button.cpp:278-330`).
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useOwnerCanvas2DTexture } from '../../canvas2DTextureDecode';
import { useItemLinearColor } from '../../canvasItemModulate';
import type { Rgba } from '../../../godot/math/math';
import { tintColor } from './buttonBase';
import type { SolveNode } from './solveTree';

/**
 * An icon reference (Button's `icon`, a check family `icon`, an OptionButton item or a TabBar tab) as a texture, `null` until it loads and for no `icon`. A painter lays out
 * for the size the solver holds (`textureSize`, `textureSlots`), never for this texture's: the layout
 * then agrees with the minimum size on every frame, and a late load only paints the quad. It resolves
 * in the node's own scope, since a node that arrived through an instanced sub-scene names ids from that scene.
 */
export function useIconRefTexture(solveNode: SolveNode, ref: string | undefined): THREE.Texture | null {
  const { externalResources, internalResources } = solveNode.resources;
  // `useTexture2D`, not the path-only resolver: an icon may be an inline procedural texture, which has no path to load from.
  const { texture: source } = useTexture2D(ref, externalResources, internalResources);
  // NoColorSpace: the 2D canvas's hardware filter blends undecoded sRGB bytes
  // (`canvas2DTextureDecode.ts`), and `ControlQuad` decodes the filtered sample once it sees this tag.
  return useOwnerCanvas2DTexture(source);
}

/** An icon's `base` modulate times the item's own tint, converted to linear once (`button.cpp:278-330`). */
export function useIconModulate(base: Rgba, tint: Rgba): { color: THREE.Color; opacity: number } {
  const srgb = useMemo(() => tintColor(base, tint), [base, tint]);
  const color = useItemLinearColor(srgb);
  return { color, opacity: srgb.a };
}
