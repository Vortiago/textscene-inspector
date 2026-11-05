/**
 * `<ButtonLabel>`: a Button-family label drawn as `Button::_notification` draws it. Each line sits in
 * the label's paragraph box, trimmed by `text_overrun_behavior`, shifted by its own alignment and cut to
 * the box, as `TextParagraph::draw` does. Button, CheckBox, CheckButton, OptionButton and MenuButton share it.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import { buttonDrawnLabel, trimButtonLabel, type ButtonLabelBox } from './buttonBase';
import type { FontMetrics } from './text/fontMetrics';
import { TextRun, type TextRunProps } from './text/TextRun';
import { soloLineLayout } from './text/textLayout';

interface ButtonLabelProps extends Pick<
  TextRunProps,
  'layout' | 'fontSizePx' | 'tint' | 'clippingPlanes' | 'renderOrder'
> {
  box: ButtonLabelBox;
  /** `TextServer::OverrunBehavior`; absent means no trimming. */
  overrunBehavior: number | undefined;
  fontMetrics: FontMetrics;
}

/** @canonical A Button-family label drawn in its paragraph box, each line shifted and cut */
export function ButtonLabel({ layout, box, overrunBehavior, fontMetrics, ...runProps }: ButtonLabelProps) {
  const { fontSizePx } = runProps;
  const drawnLines = useMemo(() => {
    const trimmed = trimButtonLabel(layout, overrunBehavior, box.widthPx, { fontMetrics, fontSizePx });
    return buttonDrawnLabel(trimmed.lines, box.widthPx, box.alignment).map(({ line, offsetXPx }) => ({
      lineLayout: soloLineLayout(line, trimmed),
      offsetXPx,
    }));
  }, [layout, overrunBehavior, fontMetrics, fontSizePx, box.widthPx, box.alignment]);
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
