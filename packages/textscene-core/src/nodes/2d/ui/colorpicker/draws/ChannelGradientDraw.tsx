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
import type { ControlProperties } from '../../control/types';
import type { NativeControlComponentProps } from '../../../../../r3f/controls/ControlComponentRegistry';
import { ControlQuad } from '../../../../../r3f/controls/native/controlQuad';
import { painterView } from '../../../../../r3f/controls/native/solveTree';
import {
  multiplyModulate,
  useItemLinearColor,
  type OwnPixelTint,
} from '../../../../../r3f/canvasItemModulate';
import { useOwnerCanvas2DTexture } from '../../../../../r3f/canvas2DTextureDecode';
import { useDisposeOnRelease } from '../../../../../r3f/useDisposeOnRelease';
import { rasterizeGradientTexture2D } from '../../../../../resources/textures/gradienttexture2d/build';
import type { Gradient, GradientTexture2D } from '../../../../../resources/textures/gradienttexture2d/types';
import type { Rgba } from '../../../../../godot/math/math';
import { AlphaCheckerboardQuad } from '../../shared/AlphaCheckerboardQuad';
import { TintedGradient } from '../GradientMesh';
import { horizontalStripGeometry } from '../svGradient';
import type { ChannelGradient } from '../colorModes';

/** A channel HSlider's properties: what its `draw` callback reads of the picker. */
export interface ChannelGradientProperties {
  channelGradient: ChannelGradient;
}

/** `margin = 16 * base_scale` (`color_mode.cpp:187`, `color_picker.cpp:1433`): the band's height. */
const BAND_HEIGHT = 16;

interface BandProps {
  width: number;
  height: number;
  tint: OwnPixelTint;
  renderOrder: number;
}

export function ChannelGradientDraw({
  solveNode,
  rect,
  tint,
  theme,
  renderOrder,
}: NativeControlComponentProps) {
  const { channelGradient: band } = painterView<ControlProperties & ChannelGradientProperties>(solveNode);
  const size = { width: rect.w, height: BAND_HEIGHT * theme.scale, tint, renderOrder };
  if ('texture' in band) return <TextureBand texture={band.texture} gradient={band.gradient} {...size} />;
  return (
    <>
      {band.underlay === 'checkerboard' && (
        <AlphaCheckerboardQuad
          width={size.width}
          height={size.height}
          color={tint.color}
          opacity={tint.opacity}
          renderOrder={renderOrder}
          themed={solveNode.icons.sample_bg}
        />
      )}
      {band.underlay !== null && band.underlay !== 'checkerboard' && (
        <GreyUnderlay grey={band.underlay.grey} {...size} />
      )}
      <PolygonBand stops={band.stops} {...size} />
    </>
  );
}

/** `draw_texture_rect` of the row's gradient texture, sampled with the slider's own filter and repeat. */
function TextureBand({
  texture,
  gradient,
  width,
  height,
  tint,
  renderOrder,
}: BandProps & { texture: GradientTexture2D; gradient: Gradient }) {
  const raster = useMemo(() => rasterizeGradientTexture2D(texture, gradient), [texture, gradient]);
  useDisposeOnRelease(raster);
  const sampled = useOwnerCanvas2DTexture(raster);
  return (
    <ControlQuad
      width={width}
      height={height}
      color={tint.color}
      opacity={tint.opacity}
      map={sampled}
      renderOrder={renderOrder}
    />
  );
}

/** `draw_polygon` of `stops` evenly spaced across the band. */
function PolygonBand({ stops, width, height, tint, renderOrder }: BandProps & { stops: readonly Rgba[] }) {
  const strip = useMemo(() => horizontalStripGeometry(width, height, stops), [width, height, stops]);
  return <TintedGradient layer={strip} tint={tint} renderOrder={renderOrder} />;
}

/** The HSV H row's flat grey under the hue rainbow (`color_mode.cpp:218-219`). */
function GreyUnderlay({ grey, width, height, tint, renderOrder }: BandProps & { grey: Rgba }) {
  const drawn = useMemo(() => multiplyModulate(tint.own, grey), [tint.own, grey]);
  const color = useItemLinearColor(drawn);
  return (
    <ControlQuad width={width} height={height} color={color} opacity={drawn.a} renderOrder={renderOrder} />
  );
}
