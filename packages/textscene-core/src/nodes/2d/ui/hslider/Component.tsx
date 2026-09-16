/**
 * `<HSlider>` — the native (WebGL canvas) painter for `HSlider`. Draws
 * the four parts `Slider::_notification(NOTIFICATION_DRAW)` paints, in
 * Godot's own draw order (`scene/gui/slider.cpp:333-363`): the `slider` track
 * StyleBox across the full width, the `grabber_area` fill from the low end to
 * the grabber's centre, each painted `tick` icon, and the `grabber` icon last
 * (on top of everything else) at the value's position. All geometry is
 * `shared/sliderSolver.ts`'s job (shared with `vslider/Component.tsx`,
 * which is this component at `vertical = true`); this component only resolves
 * theme/state and draws.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`.
 * A StyleBox carries two base colours (`PanelChrome.tsx`'s rule), so `tint.own`
 * (raw sRGB) is handed straight to each `<StyleBoxQuad>`'s own `color` prop,
 * which composes it internally before its single sRGB→linear conversion; the
 * grabber/tick icons have no separate theme colour of their own (Slider draws
 * them with the canvas item's own modulate and nothing else), so they take
 * `tint.color`/`tint.opacity` directly, mirroring `HSplitContainer`'s icon.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { SLIDER_GRABBER_ICONS, SLIDER_TICK_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import {
  resolveSliderRatio,
  sliderGrabberAreaRect,
  sliderGrabberIconSize,
  sliderGrabberRect,
  sliderTickRects,
  sliderTrackRect,
} from '../shared/sliderSolver';
import { SLIDER_DEFAULT_EDITABLE, sliderTickIndices } from '../shared/slider';
import type { HSliderProperties } from './types';

export function HSlider({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = painterView<HSliderProperties>(solveNode);
  const size = { x: rect.w, y: rect.h };
  const ratio = resolveSliderRatio(props, controlLayoutOrder(solveNode));

  const trackBase = solveNode.styleBoxes.slider ?? theme.widgets.slider.track;
  const fillBase = solveNode.styleBoxes.grabber_area ?? theme.widgets.slider.fill;

  const grabberIconSize = sliderGrabberIconSize(theme, solveNode.textureSlots);
  const trackRect = sliderTrackRect(false, size, theme);
  const fillRect = sliderGrabberAreaRect(false, size, ratio, theme, grabberIconSize);
  const grabberRect = sliderGrabberRect(false, size, ratio, grabberIconSize);
  const tickIndices = sliderTickIndices(props);
  const tickRects = sliderTickRects(false, size, tickIndices, props.tickCount ?? 0, theme, grabberIconSize);

  const editable = props.editable ?? SLIDER_DEFAULT_EDITABLE;
  const grabberTexture = useNodeIcon(
    solveNode.icons[editable ? 'grabber' : 'grabber_disabled'],
    editable ? SLIDER_GRABBER_ICONS.grabber : SLIDER_GRABBER_ICONS.grabberDisabled
  );
  const tickTexture = useNodeIcon(solveNode.icons.tick, SLIDER_TICK_ICONS.hslider);

  return (
    <>
      <CanvasItemGroup position={[trackRect.x, -trackRect.y, 0]}>
        <StyleBoxQuad
          styleBox={trackBase}
          color={tint.own}
          rect={{ x: 0, y: 0, w: trackRect.w, h: trackRect.h }}
          renderOrder={renderOrder}
        />
      </CanvasItemGroup>
      <CanvasItemGroup position={[fillRect.x, -fillRect.y, 0]}>
        <StyleBoxQuad
          styleBox={fillBase}
          color={tint.own}
          rect={{ x: 0, y: 0, w: fillRect.w, h: fillRect.h }}
          renderOrder={renderOrder}
        />
      </CanvasItemGroup>
      {tickRects.map((tickRect, i) => (
        <CanvasItemGroup key={tickIndices[i]} position={[tickRect.x, -tickRect.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={tickRect.w}
            height={tickRect.h}
            color={tint.color}
            opacity={tint.opacity}
            map={tickTexture}
          />
        </CanvasItemGroup>
      ))}
      <CanvasItemGroup position={[grabberRect.x, -grabberRect.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={grabberRect.w}
          height={grabberRect.h}
          color={tint.color}
          opacity={tint.opacity}
          map={grabberTexture}
        />
      </CanvasItemGroup>
    </>
  );
}
