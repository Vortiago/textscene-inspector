import type { Node } from 'three/webgpu';

/**
 * `node` held in a variable where it stands, so later reads see this value.
 * @canonical hold a TSL node in a shader variable
 */
export const heldInVariable = (node: Node): Node => (node as unknown as { toVar(): Node }).toVar();
