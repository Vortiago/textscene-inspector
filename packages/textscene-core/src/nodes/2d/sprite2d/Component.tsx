/**
 * Draws a Sprite2D: a canvas mesh whose one surface is a quad sized to the texture's pixels
 * (1 px = 1 world unit). The region and frame math is shared with Sprite3D in `r3f/spriteFrame`.
 * Flipping stays here: 2D mirrors by mesh scale, which flips the texture too, as in Godot, where 3D
 * negates the UV.
 */

import { useCallback, useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { frameSizePx, frameUvWindow } from '../../../r3f/spriteFrame';
import { useNodeReference } from '../../../resources/reading';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { CanvasMeshBody } from '../../../r3f/canvasMesh/CanvasMeshBody';
import {
  useCanvasMeshTexture,
  type LoadedCanvasMeshTexture,
} from '../../../r3f/canvasMesh/useCanvasMeshTexture';
import { useSpriteQuad } from '../../../r3f/canvasMesh/spriteQuad';
import type { Sprite2DProperties } from './types';

export function Sprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Sprite2DProperties;

  // An active AnimationPlayer can drive the sheet `frame` (ADR-0016), and `null`
  // means none does. The registry carries a numeric tuple (ADR-0017), here a 1-tuple.
  const animatedFrame = useAnimatedValue('frame', (v) => v[0] ?? null);

  // A driven `frame` overrides the authored `frame` and any authored
  // `frame_coords` (in Godot the two are the same value), so the animation wins.
  // With `texture_repeat` Disabled, an overrunning `region_rect` stretches its edge texels,
  // where Sprite3D tiles.
  const windowOf = useCallback(
    ({ source, size, hasNoImage }: LoadedCanvasMeshTexture) => {
      const frameProps =
        animatedFrame !== null ? { ...props, frame: animatedFrame, frame_coords: undefined } : props;
      return frameUvWindow(source ?? undefined, frameProps, hasNoImage ? size : undefined);
    },
    [props, animatedFrame]
  );
  const scope = useSceneResources();
  const texture = useCanvasMeshTexture(props, {
    reference: useNodeReference(props.texture, scope),
    windowOf,
  });
  const frameSize = useMemo(() => frameSizePx(texture.size, props), [texture.size, props]);
  const surfaces = useSpriteQuad(props, frameSize);

  return (
    <CanvasMeshBody node={node} props={props} texture={texture} withoutTexture="nothing" surfaces={surfaces}>
      {children}
    </CanvasMeshBody>
  );
}
