/**
 * `<ButtonLabel>`: a Button-family label drawn as `Button::_notification` draws it. Each line sits in
 * the label's paragraph box, shifted by its own alignment and cut to the box, as `TextParagraph::draw`
 * does. Button, CheckBox, CheckButton, OptionButton and MenuButton share it.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import { buttonDrawnLabel, type ButtonLabelBox } from './buttonBase';
import { TextRun, type TextRunProps } from './text/TextRun';
import { soloLineLayout } from './text/textLayout';

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
