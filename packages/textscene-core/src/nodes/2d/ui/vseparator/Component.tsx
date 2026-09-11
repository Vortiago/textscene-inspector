/**
 * `<VSeparator>` — `SeparatorChrome` fixed to `vertical`
 * (`scene/gui/separator.cpp:75-77`: the constructor sets
 * `orientation = VERTICAL`; `Separator::orientation` has no `ADD_PROPERTY`,
 * so a `.tscn` can never set it any other way).
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { SeparatorChrome } from '../separator/Component';

export function VSeparator(props: NativeControlComponentProps) {
  return <SeparatorChrome {...props} orientation="vertical" />;
}
