/**
 * `<HSlider>`, the native (WebGL canvas) painter for `Slider::_notification(NOTIFICATION_DRAW)`
 * in Godot's order (`scene/gui/slider.cpp:333-363`): the `slider` track, the
 * `grabber_area` fill to the grabber's centre, each `tick`, then the `grabber`.
 * `shared/sliderSolver.ts` owns the geometry, `ControlCanvasWalker` `visible`, `children` and the transform.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView, controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { SLIDER_GRABBER_ICONS, SLIDER_TICK_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import {
  resolveSliderRatio,
  sliderGrabberAreaRect,
  sliderGrabberIconSize,
  sliderGrabberRect,
  sliderTickRects,
  sliderTrackRect,
} from '../shared/sliderSolver';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { SLIDER_DEFAULT_EDITABLE, sliderTickIndices } from '../shared/slider';
import type { HSliderProperties } from './types';

// A StyleBox has two base colours, so each `<StyleBoxQuad>` takes the raw sRGB
// `tint.own`. Slider draws its icons with the modulate alone, so they take
// `tint.color`/`tint.opacity`.
export function HSlider({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = painterView<HSliderProperties>(solveNode);
  const size = { x: rect.w, y: rect.h };
  const ratio = resolveSliderRatio(props, controlLayoutOrder(solveNode));

  const trackBase = requiredThemeItem(solveNode.styleBoxes, 'slider');
  const fillBase = requiredThemeItem(solveNode.styleBoxes, 'grabber_area');

  const grabberIconSize = sliderGrabberIconSize(theme, solveNode.textureSlots);
  const trackRect = sliderTrackRect(false, size, trackBase);
  const fillRect = sliderGrabberAreaRect(false, size, ratio, trackBase, grabberIconSize, solveNode.rtl);
  const grabberRect = sliderGrabberRect(false, size, ratio, grabberIconSize, solveNode.rtl);
  const tickIndices = sliderTickIndices(props);
  const tickRects = sliderTickRects(
    false,
    size,
    tickIndices,
    props.tickCount ?? 0,
    theme,
    grabberIconSize,
    trackBase
  );

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
        <PositionedIcon
          key={tickIndices[i]}
          rect={tickRect}
          texture={tickTexture}
          color={tint.color}
          opacity={tint.opacity}
          renderOrder={renderOrder}
          canvasKey={renderOrder}
        />
      ))}
      <PositionedIcon
        rect={grabberRect}
        texture={grabberTexture}
        color={tint.color}
        opacity={tint.opacity}
        renderOrder={renderOrder}
        canvasKey={renderOrder}
      />
    </>
  );
}
