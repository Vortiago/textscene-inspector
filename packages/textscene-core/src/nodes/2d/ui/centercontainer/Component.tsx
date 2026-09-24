/**
 * `<CenterContainer>` paints nothing: CenterContainer draws no chrome in Godot and
 * only centres its children (`nativeSolver.ts`). The walker renders the children.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function CenterContainer(_props: NativeControlComponentProps) {
  return null;
}
