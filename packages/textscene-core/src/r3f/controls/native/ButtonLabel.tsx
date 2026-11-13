/**
 * `<ButtonLabel>`: a Button-family label drawn as `Button::_notification` draws it. Each line sits in
 * the label's paragraph box, trimmed by `text_overrun_behavior`, shifted by its own alignment and cut to
 * the box, as `TextParagraph::draw` does. `ButtonPainter` draws it for every Button class.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import { buttonDrawnLabel, trimButtonLabel, type ButtonLabelBox } from './buttonBase';
import { OutlinedTextRun, type OutlinedTextRunProps } from './text/OutlinedTextRun';
import { soloLineLayout } from './text/textLayout';
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
  isWrapped: boolean;
}

/** @canonical A Button-family label drawn in its paragraph box, each line shifted and cut */
export function ButtonLabel({
  layout,
  box,
  overrunBehavior,
  bidi,
  isWrapped,
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
