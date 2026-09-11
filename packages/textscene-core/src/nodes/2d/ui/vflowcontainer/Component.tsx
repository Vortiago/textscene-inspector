/**
 * VFlowContainer's native (WebGL canvas) painter — a Container draws no
 * chrome of its own; see `flowcontainer/Component.tsx`'s doc for why this is
 * registered anyway.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function VFlowContainer(_props: NativeControlComponentProps) {
  return null;
}
