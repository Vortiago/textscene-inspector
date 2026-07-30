/**
 * `<VSliderNative>` — the native (WebGL canvas) painter for `VSlider`.
 * Identical reasoning to `hslider/NativeComponent.tsx` (read its module doc
 * first) at `vertical = true`: the grabber travels from the BOTTOM
 * (value = min_value) to the TOP (value = max_value), and ticks draw the
 * `vslider_tick` icon instead of `hslider_tick`. All geometry is
 * `shared/sliderSolver.ts`'s job; this component only resolves theme/state and
 * draws.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { StyleBoxQuad, tintStyleBox } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { SLIDER_GRABBER_ICONS, SLIDER_TICK_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import {
  resolveSliderRatio,
  sliderGrabberAreaRect,
  sliderGrabberRect,
  sliderTickRects,
  sliderTrackRect,
} from '../shared/sliderSolver';
import { SLIDER_DEFAULT_EDITABLE, sliderTickIndices } from '../shared/slider';
import type { VSliderProperties } from './types';


export function VSliderNative({ solveNode, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = solveNode.node.properties as VSliderProperties;
  const size = { x: rect.w, y: rect.h };
  const ratio = resolveSliderRatio(props);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  const trackBase = solveNode.styleBoxes.slider ?? theme.widgets.slider.track;
  const fillBase = solveNode.styleBoxes.grabber_area ?? theme.widgets.slider.fill;
  const track = useMemo(() => tintStyleBox(trackBase, tint.own), [trackBase, tint.own]);
  const fill = useMemo(() => tintStyleBox(fillBase, tint.own), [fillBase, tint.own]);

  const trackRect = sliderTrackRect(true, size, theme);
  const fillRect = sliderGrabberAreaRect(true, size, ratio, theme);
  const grabberRect = sliderGrabberRect(true, size, ratio, theme);
  const tickIndices = sliderTickIndices(props);
  const tickRects = sliderTickRects(true, size, tickIndices, props.tickCount ?? 0, theme);

  const editable = props.editable ?? SLIDER_DEFAULT_EDITABLE;
  const grabberTexture = useIconTexture(editable ? SLIDER_GRABBER_ICONS.grabber : SLIDER_GRABBER_ICONS.grabberDisabled);
  const tickTexture = useIconTexture(SLIDER_TICK_ICONS.vslider);

  return (
    <>
      <group position={[trackRect.x, -trackRect.y, 0]}>
        <StyleBoxQuad styleBox={track} rect={{ x: 0, y: 0, w: trackRect.w, h: trackRect.h }} renderOrder={renderOrder} />
      </group>
      <group position={[fillRect.x, -fillRect.y, 0]}>
        <StyleBoxQuad styleBox={fill} rect={{ x: 0, y: 0, w: fillRect.w, h: fillRect.h }} renderOrder={renderOrder} />
      </group>
      {tickRects.map((tickRect, i) => (
        <group key={tickIndices[i]} position={[tickRect.x, -tickRect.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={tickRect.w}
            height={tickRect.h}
            color={tint.color}
            opacity={tint.opacity}
            map={tickTexture}
          />
        </group>
      ))}
      <group position={[grabberRect.x, -grabberRect.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={grabberRect.w}
          height={grabberRect.h}
          color={tint.color}
          opacity={tint.opacity}
          map={grabberTexture}
        />
      </group>
    </>
  );
}
