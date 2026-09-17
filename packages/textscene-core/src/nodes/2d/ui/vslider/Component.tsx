/**
 * `<VSlider>` — the native (WebGL canvas) painter for `VSlider`.
 * Identical reasoning to `hslider/Component.tsx` (read its module doc
 * first) at `vertical = true`: the grabber travels from the BOTTOM
 * (value = min_value) to the TOP (value = max_value), and ticks draw the
 * `vslider_tick` icon instead of `hslider_tick`. All geometry is
 * `shared/sliderSolver.ts`'s job; this component only resolves theme/state and
 * draws.
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
import type { VSliderProperties } from './types';


export function VSlider({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = painterView<VSliderProperties>(solveNode);
  const size = { x: rect.w, y: rect.h };
  const ratio = resolveSliderRatio(props, controlLayoutOrder(solveNode));

  const trackBase = solveNode.styleBoxes.slider ?? theme.widgets.slider.track;
  const fillBase = solveNode.styleBoxes.grabber_area ?? theme.widgets.slider.fill;

  const grabberIconSize = sliderGrabberIconSize(theme, solveNode.textureSlots);
  const trackRect = sliderTrackRect(true, size, theme);
  const fillRect = sliderGrabberAreaRect(true, size, ratio, theme, grabberIconSize, solveNode.rtl);
  const grabberRect = sliderGrabberRect(true, size, ratio, grabberIconSize, solveNode.rtl);
  const tickIndices = sliderTickIndices(props);
  const tickRects = sliderTickRects(true, size, tickIndices, props.tickCount ?? 0, theme, grabberIconSize);

  const editable = props.editable ?? SLIDER_DEFAULT_EDITABLE;
  const grabberTexture = useNodeIcon(
    solveNode.icons[editable ? 'grabber' : 'grabber_disabled'],
    editable ? SLIDER_GRABBER_ICONS.grabber : SLIDER_GRABBER_ICONS.grabberDisabled
  );
  const tickTexture = useNodeIcon(solveNode.icons.tick, SLIDER_TICK_ICONS.vslider);

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
