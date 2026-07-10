/** Timer render component — transform group wrapping children. */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

export function Timer({ node, children }: NodeComponentProps) {
  return <Node node={node}>{children}</Node>;
}
