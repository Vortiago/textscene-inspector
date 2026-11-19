import type * as THREE from 'three';

/** The part of three's `WebGLNodesHandler` that a draw outside the render list calls. */
interface ObjectHook {
  setObject(object: THREE.Object3D, material: THREE.Material): void;
}

/** Written only by `registerNodesHandler`: three gives no getter (`WebGLRenderer.js:1077`). */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const handlers = new WeakMap<THREE.WebGLRenderer, ObjectHook>();

export function registerNodesHandler(renderer: THREE.WebGLRenderer, handler: ObjectHook): void {
  handlers.set(renderer, handler);
}

/** Whether `renderer` holds a nodes handler. */
export const hasNodesHandler = (renderer: THREE.WebGLRenderer): boolean => handlers.has(renderer);

/** Points the handler at `object` before a node material's draw (`WebGLRenderer.js:2170`). */
export function setNodeObject(
  renderer: THREE.WebGLRenderer,
  object: THREE.Object3D,
  material: THREE.Material
): void {
  if ((material as { isNodeMaterial?: boolean }).isNodeMaterial)
    handlers.get(renderer)?.setObject(object, material);
}
