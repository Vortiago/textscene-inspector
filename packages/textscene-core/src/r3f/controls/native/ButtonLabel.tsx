/**
 * `<ButtonLabel>`: a Button-family label drawn as `Button::_notification` draws it. Each line sits in
 * the label's paragraph box, shifted by its own alignment and cut to the box, as `TextParagraph::draw`
 * does. Button, CheckBox, CheckButton, OptionButton and MenuButton share it.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import { buttonDrawnLabel, shapeButtonLabel, type ButtonLabelBox } from './buttonBase';
import type { ShareNode } from './solveTree';
import { resolveNodeFontMetrics } from './text/resolveNodeFontMetrics';
import { TextRun, type TextRunProps } from './text/TextRun';
import { soloLineLayout, type TextLayoutResult } from './text/textLayout';

interface ButtonLabelProps extends Pick<
  TextRunProps,
  'layout' | 'fontSizePx' | 'tint' | 'clippingPlanes' | 'renderOrder'
> {
  box: ButtonLabelBox;
}

/** @canonical A Button-family label drawn in its paragraph box, each line shifted and cut */
export function ButtonLabel({ layout, box, ...runProps }: ButtonLabelProps) {
  const drawnLines = useMemo(
    () =>
      buttonDrawnLabel(layout.lines, box.widthPx, box.alignment).map(({ line, offsetXPx }) => ({
        lineLayout: soloLineLayout(line, layout),
        offsetXPx,
      })),
    [layout, box.widthPx, box.alignment]
  );
  return (
    <>
      {drawnLines.map(({ lineLayout, offsetXPx }, i) => (
        <CanvasItemGroup
          key={i}
          position={[box.leftPx + offsetXPx, -(box.topPx + i * layout.linePitchPx), 0]}
        >
          <TextRun layout={lineLayout} {...runProps} />
        </CanvasItemGroup>
      ))}
    </>
  );
}

/**
 * The shaped one-line label of a Button-family control, or null for empty text. The font metrics
 * are read in the render body, not in the `useMemo`, for the reason Label's Component.tsx gives.
 */
export function useButtonLabelLayout(
  solveNode: ShareNode,
  themeFontKey: string,
  text: string,
  fontSizePx: number
): TextLayoutResult | null {
  const fontMetrics = resolveNodeFontMetrics(solveNode, themeFontKey);
  return useMemo(
    () => (text.length > 0 ? shapeButtonLabel(text, fontSizePx, fontMetrics) : null),
    [text, fontSizePx, fontMetrics]
  );
}
