/**
 * What `_sample_draw` draws on `sample` (`scene/gui/color_picker.cpp:1362-1414`): the pick colour over
 * the top 95% of the TextureRect, on `sample_bg` tiles when it is translucent, and the
 * `overbright_indicator` at its centre top for an HDR colour. A loaded picker shows no old colour.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useMemo } from 'react';
import type { Rgba } from '../../../../../godot/math/math';
import type { ControlProperties } from '../../control/types';
import type { NativeControlComponentProps } from '../../../../../r3f/controls/ControlComponentRegistry';
import { CanvasItemGroup } from '../../../../../r3f/components/CanvasItemGroup';
import { ControlQuad } from '../../../../../r3f/controls/native/controlQuad';
import { useNodeIcon } from '../../../../../r3f/controls/native/useIconTexture';
import { painterView } from '../../../../../r3f/controls/native/solveTree';
import { COLOR_PICKER_OVERBRIGHT_ICON } from '../../../../../r3f/controls/native/themeIcons';
import { multiplyModulate, useItemLinearColor } from '../../../../../r3f/canvasItemModulate';
import { AlphaCheckerboardQuad } from '../../shared/AlphaCheckerboardQuad';
import { isColorOverbright, overbrightIconSize } from '../../shared/colorOverbright';

/** The `sample` TextureRect's properties: the picker's `color`, which no scene line of `sample` carries. */
export interface SampleDrawProperties {
  pickColor: Rgba;
}

/** `rect_new`'s height: 95% of the sample's (`color_picker.cpp:1383`). */
const SAMPLE_HEIGHT_FRACTION = 0.95;

export function SampleDraw({ solveNode, rect, tint, theme, renderOrder }: NativeControlComponentProps) {
  const { pickColor } = painterView<ControlProperties & SampleDrawProperties>(solveNode);
  const fill = useMemo(() => multiplyModulate(tint.own, pickColor), [tint.own, pickColor]);
  const fillColor = useItemLinearColor(fill);
  const overbrightTexture = useNodeIcon(solveNode.icons.overbright_indicator, COLOR_PICKER_OVERBRIGHT_ICON);
  const height = rect.h * SAMPLE_HEIGHT_FRACTION;
  const overbrightSide = overbrightIconSize(theme.scale);
  return (
    <>
      {pickColor.a < 1 && (
        <AlphaCheckerboardQuad
          width={rect.w}
          height={height}
          color={tint.color}
          opacity={tint.opacity}
          renderOrder={renderOrder}
          themed={solveNode.icons.sample_bg}
        />
      )}
      <ControlQuad
        width={rect.w}
        height={height}
        color={fillColor}
        opacity={fill.a}
        renderOrder={renderOrder}
      />
      {isColorOverbright(pickColor) && (
        <CanvasItemGroup position={[rect.w * 0.5, 0, 0]}>
          <ControlQuad
            width={overbrightSide}
            height={overbrightSide}
            color={tint.color}
            opacity={tint.opacity}
            map={overbrightTexture}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
