/**
 * What a channel slider's `draw` callback draws over its HSlider chrome: the mode's gradient across
 * the top `16 * base_scale` pixels, on its underlay (`ColorMode::slider_draw`, `color_mode.cpp`, and
 * `_alpha_slider_draw`, `color_picker.cpp:1423-1450`). `colorize_sliders` has no scene line, so it
 * stays on and every channel and alpha slider draws one.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import type { ControlProperties } from '../../control/types';
import type { NativeControlComponentProps } from '../../../../../r3f/controls/ControlComponentRegistry';
import { ControlQuad } from '../../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../../r3f/controls/native/controlClipping';
import { painterView } from '../../../../../r3f/controls/native/solveTree';
import {
  multiplyModulate,
  useItemLinearColor,
  useVertexColorTint,
} from '../../../../../r3f/canvasItemModulate';
import { AlphaCheckerboardQuad } from '../../shared/AlphaCheckerboardQuad';
import { GradientMesh, buildGeometry, tintVertexColors } from '../GradientMesh';
import { horizontalStripGeometry, texelStripGeometry } from '../svGradient';
import type { ChannelGradient } from '../colorModes';

/** A channel HSlider's properties: what its `draw` callback reads of the picker. */
export interface ChannelGradientProperties {
  channelGradient: ChannelGradient;
}

/** `margin = 16 * base_scale` (`color_mode.cpp:187`, `color_picker.cpp:1433`): the band's height. */
const BAND_HEIGHT = 16;

export function ChannelGradientDraw({
  solveNode,
  rect,
  tint,
  theme,
  renderOrder,
}: NativeControlComponentProps) {
  const { channelGradient: gradient } = painterView<ControlProperties & ChannelGradientProperties>(solveNode);
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];
  const vertexTint = useVertexColorTint(tint.own);
  const height = BAND_HEIGHT * theme.scale;
  const geometry = useMemo(() => {
    const stripOf = gradient.isTexture ? texelStripGeometry : horizontalStripGeometry;
    const strip = stripOf(rect.w, height, gradient.stops);
    return buildGeometry({ ...strip, colors: tintVertexColors(strip.colors, vertexTint.vertex) });
  }, [gradient, rect.w, height, vertexTint.vertex]);
  const { underlay } = gradient;
  return (
    <>
      {underlay === 'checkerboard' && (
        <AlphaCheckerboardQuad
          width={rect.w}
          height={height}
          color={tint.color}
          opacity={tint.opacity}
          renderOrder={renderOrder}
          themed={solveNode.icons.sample_bg}
        />
      )}
      {underlay !== null && underlay !== 'checkerboard' && (
        <GreyUnderlay
          grey={underlay.grey}
          width={rect.w}
          height={height}
          tint={tint}
          renderOrder={renderOrder}
        />
      )}
      <GradientMesh
        geometry={geometry}
        renderOrder={renderOrder}
        clippingPlanes={clippingPlanes}
        tint={vertexTint}
      />
    </>
  );
}

/** The HSV H row's flat grey under the hue rainbow (`color_mode.cpp:218-219`). */
function GreyUnderlay({
  grey,
  width,
  height,
  tint,
  renderOrder,
}: {
  grey: ChannelGradient['stops'][number];
  width: number;
  height: number;
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}) {
  const drawn = useMemo(() => multiplyModulate(tint.own, grey), [tint.own, grey]);
  const color = useItemLinearColor(drawn);
  return (
    <ControlQuad width={width} height={height} color={color} opacity={drawn.a} renderOrder={renderOrder} />
  );
}
