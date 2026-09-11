/**
 * `<HSeparator>` — `SeparatorChrome` fixed to `horizontal`
 * (`scene/gui/separator.cpp:71-73`: the constructor sets
 * `orientation = HORIZONTAL`; `Separator::orientation` has no `ADD_PROPERTY`,
 * so a `.tscn` can never set it any other way).
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { SeparatorChrome } from '../separator/Component';

export function HSeparator(props: NativeControlComponentProps) {
  return <SeparatorChrome {...props} orientation="horizontal" />;
}
