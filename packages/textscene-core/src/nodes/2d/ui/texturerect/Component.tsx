/**
 * `<TextureRect>`: the native (WebGL canvas) painter, one `<ControlQuad>` placed by the `stretch_mode`
 * math in `nativeSolver.ts` and textured through `useTexture2D`, so an image file and a procedural
 * texture arrive alike. Tint is the walker's `tint` as is, since TextureRect has no `color`. The
 * walker owns the transform, and `index.r3f.ts` registers the minimum size.
 */

import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import {
  useCanvasItemViewSampler,
  useInheritedTextureSampler,
} from '../../../../r3f/canvasItemTextureSampler';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { textureRectDraw } from './nativeSolver';
import { rectTextureSampler, sampledDraw } from './rectTexture';
import type { TextureRectProperties } from './types';
import { useOwnedTextureView } from '../../../../r3f/useTextureView';

export function TextureRect({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<TextureRectProperties>(solveNode);
  // Walks PARENT_NODE up to the nearest ancestor naming a value. The walker folds the same
  // way, but the fold is idempotent, so repeating it keeps this painter correct on its own.
  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);

  // The node's own scope, not the ambient provider's: a TextureRect that
  // arrived through an instanced sub-scene names ids from that scene.
  const { externalResources, internalResources } = solveNode.resources;
  // `useTexture2D`, not the path-only resolver: `texture` may be an inline
  // procedural texture, which has no path and rasterises out of the scene.
  const { texture: rawTexture, size } = useTexture2D(props.texture, externalResources, internalResources);

  const draw = useMemo(
    () =>
      sampledDraw(rawTexture, size, (reported) =>
        textureRectDraw({ x: rect.w, y: rect.h }, reported, props.stretchMode)
      ),
    [rawTexture, size, rect.w, rect.h, props.stretchMode]
  );

  const viewSampler = useCanvasItemViewSampler(sampler);
  const drawnTexture = useOwnedTextureView(
    rawTexture,
    draw &&
      rectTextureSampler(draw, viewSampler, {
        flipH: props.flipH === true,
        flipV: props.flipV === true,
      })
  );

  if (!draw || !drawnTexture) return null;

  return (
    <PositionedIcon
      rect={{ x: draw.offset.x, y: draw.offset.y, w: draw.size.x, h: draw.size.y }}
      texture={drawnTexture}
      color={tint.color}
      opacity={tint.opacity}
      renderOrder={renderOrder}
      canvasKey={renderOrder}
    />
  );
}
