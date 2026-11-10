/**
 * `<ButtonLabel>`: a Button-family label drawn as `Button::_notification` draws it. Each line sits in
 * the label's paragraph box, trimmed by `text_overrun_behavior`, shifted by its own alignment and cut to
 * the box, as `TextParagraph::draw` does. Button, CheckBox, CheckButton, OptionButton and MenuButton share it.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import {
  buttonDrawnLabel,
  shapeWrappedButtonLabel,
  trimButtonLabel,
  type ButtonLabelBox,
  type ButtonWrapProperties,
} from './buttonBase';
import type { ShareNode } from './solveTree';
import { resolveNodeFontMetrics } from './text/resolveNodeFontMetrics';
import { OutlinedTextRun, type OutlinedTextRunProps } from './text/OutlinedTextRun';
import { soloLineLayout, type TextLayoutResult } from './text/textLayout';
import { isDrawnRtl, type TextBidiOptions } from './text/textBidiOptions';

interface ButtonLabelProps extends Pick<
  OutlinedTextRunProps,
  'layout' | 'fontSizePx' | 'tint' | 'outline' | 'clippingPlanes' | 'renderOrder'
> {
  box: ButtonLabelBox;
  /** `TextServer::OverrunBehavior`; absent means no trimming. */
  overrunBehavior: number | undefined;
  /** The paragraph's bidi options: a set RTL direction draws a trimmed fill right to left. */
  bidi: TextBidiOptions;
  /** The label wraps ({@link isButtonAutowrapped}), so no row is trimmed. */
  isWrapped?: boolean;
}

/** @canonical A Button-family label drawn in its paragraph box, each line shifted and cut */
export function ButtonLabel({
  layout,
  box,
  overrunBehavior,
  bidi,
  isWrapped = false,
  ...runProps
}: ButtonLabelProps) {
  const { fontSizePx } = runProps;
  const isLineDrawnRtl = isDrawnRtl(bidi);
  const drawnLines = useMemo(() => {
    const trimmed = trimButtonLabel(layout, overrunBehavior, box.widthPx, {
      fontSizePx,
      isDrawnRtl: isLineDrawnRtl,
      isWrapped,
    });
    return buttonDrawnLabel(trimmed.lines, box.widthPx, box.alignment).map(({ line, offsetXPx }) => ({
      lineLayout: soloLineLayout(line, trimmed),
      offsetXPx,
    }));
  }, [layout, overrunBehavior, fontSizePx, isLineDrawnRtl, isWrapped, box.widthPx, box.alignment]);
  return (
    <>
      {drawnLines.map(({ lineLayout, offsetXPx }, i) => (
        <CanvasItemGroup
          key={i}
          position={[box.leftPx + offsetXPx, -(box.topPx + i * layout.linePitchPx), 0]}
        >
          <OutlinedTextRun layout={lineLayout} {...runProps} />
        </CanvasItemGroup>
      ))}
    </>
  );
}

/** What {@link useButtonLabelLayout} shapes. */
interface ButtonLabelShapeInput {
  themeFontKey: string;
  text: string;
  fontSizePx: number;
  bidi: TextBidiOptions;
  /** The width a wrapping label shapes at ({@link labelWrapWidthPx}). Ignored at AUTOWRAP_OFF. */
  boxWidthPx: number;
}

/**
 * The shaped label of a Button-family control, or null for empty text. The font metrics
 * are read in the render body, not in the `useMemo`, for the reason Label's Component.tsx gives.
 */
export function useButtonLabelLayout(
  solveNode: ShareNode,
  wrap: ButtonWrapProperties,
  { themeFontKey, text, fontSizePx, bidi, boxWidthPx }: ButtonLabelShapeInput
): TextLayoutResult | null {
  const fontMetrics = resolveNodeFontMetrics(solveNode, themeFontKey);
  const { autowrapMode, autowrapTrimFlags } = wrap;
  return useMemo(
    () =>
      text.length > 0
        ? shapeWrappedButtonLabel(
            text,
            { autowrapMode, autowrapTrimFlags },
            { fontSizePx, fontMetrics, bidi, boxWidthPx }
          )
        : null,
    [text, fontSizePx, fontMetrics, bidi, autowrapMode, autowrapTrimFlags, boxWidthPx]
  );
}
