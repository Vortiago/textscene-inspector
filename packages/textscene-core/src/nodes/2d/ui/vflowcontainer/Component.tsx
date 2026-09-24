/**
 * VFlowContainer's native (WebGL canvas) painter. A Container draws no chrome.
 * `flowcontainer/Component.tsx` says why it is registered anyway.
 */

import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function VFlowContainer(_props: NativeControlComponentProps) {
  return null;
}
