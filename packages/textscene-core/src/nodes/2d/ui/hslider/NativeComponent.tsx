/**
 * `<HSliderNative>` — the native (WebGL canvas) painter for `HSlider`. Draws
 * the four parts `Slider::_notification(NOTIFICATION_DRAW)` paints, in
 * Godot's own draw order (`scene/gui/slider.cpp:333-363`): the `slider` track
 * StyleBox across the full width, the `grabber_area` fill from the low end to
 * the grabber's centre, each painted `tick` icon, and the `grabber` icon last
 * (on top of everything else) at the value's position. All geometry is
 * `shared/sliderSolver.ts`'s job (shared with `vslider/NativeComponent.tsx`,
 * which is this component at `vertical = true`); this component only resolves
 * theme/state and draws.
 *
 * Tint follows the house rule: the walker has already folded this node's OWN
 * `modulate` into the ambient `Modulate2DContext`, so this calls
 * `useCanvasItemTint` with `modulate: WHITE_MODULATE` and only `self_modulate`.
 * A StyleBox carries two base colours (`PanelChrome.tsx`'s rule), so `tint.own`
 * (raw sRGB) is multiplied into each stylebox via `tintStyleBox` before
 * `StyleBoxQuad`'s own single sRGB→linear conversion; the grabber/tick icons
 * have no separate theme colour of their own (Slider draws them with the
 * canvas item's own modulate and nothing else), so they take `tint.color`/
 * `tint.opacity` directly, mirroring `HSplitContainerNative`'s icon.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
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
import type { HSliderProperties } from './types';

export function HSliderNative({ solveNode, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = solveNode.node.properties as HSliderProperties;
  const size = { x: rect.w, y: rect.h };
  const ratio = resolveSliderRatio(props);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  const trackBase = solveNode.styleBoxes.slider ?? theme.widgets.slider.track;
  const fillBase = solveNode.styleBoxes.grabber_area ?? theme.widgets.slider.fill;
  const track = useMemo(() => tintStyleBox(trackBase, tint.own), [trackBase, tint.own]);
  const fill = useMemo(() => tintStyleBox(fillBase, tint.own), [fillBase, tint.own]);

  const trackRect = sliderTrackRect(false, size, theme);
  const fillRect = sliderGrabberAreaRect(false, size, ratio, theme);
  const grabberRect = sliderGrabberRect(false, size, ratio, theme);
  const tickIndices = sliderTickIndices(props);
  const tickRects = sliderTickRects(false, size, tickIndices, props.tickCount ?? 0, theme);

  const editable = props.editable ?? SLIDER_DEFAULT_EDITABLE;
  const grabberTexture = useIconTexture(editable ? SLIDER_GRABBER_ICONS.grabber : SLIDER_GRABBER_ICONS.grabberDisabled);
  const tickTexture = useIconTexture(SLIDER_TICK_ICONS.hslider);

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
