/**
 * Re-export of the StandardMaterial3D slice's `.tres` loader for
 * `processing/index.ts`, which nothing imports.
 */

export {
  createMaterialFromContent,
  isMaterialPath,
  type TextureLoaderFn,
} from '../materials/standardmaterial3d/loadMaterial';
