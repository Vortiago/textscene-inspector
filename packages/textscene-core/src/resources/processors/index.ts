/**
 * Resource processor factories.
 * Each factory creates a processor using createResourceProcessor with type-specific logic.
 */

export { createTextureProcessor } from './createTextureProcessor';
export { createMaterialProcessor } from './createMaterialProcessor';
export { createGLBProcessor } from './createGLBProcessor';
export { createSceneProcessor } from './createSceneProcessor';
