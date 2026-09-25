/**
 * `<VSeparator>`: `SeparatorChrome` fixed to vertical. The constructor sets `orientation = VERTICAL`
 * (`scene/gui/separator.cpp:75-77`), and `Separator::orientation` has no `ADD_PROPERTY`.
 */

import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { SeparatorChrome } from '../separator/Component';

export function VSeparator(props: NativeControlComponentProps) {
  return <SeparatorChrome {...props} orientation="vertical" />;
}
