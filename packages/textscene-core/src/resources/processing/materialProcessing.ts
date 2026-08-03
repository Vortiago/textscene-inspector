/**
 * Compatibility re-export of the StandardMaterial3D slice's `.tres` loader.
 *
 * The value-shape-sniffing decode that lived here dissolved into
 * `resources/materials/standardmaterial3d/` (ADR-0031), where it shares one
 * decode with the inline `[sub_resource]` path. This module stays only because
 * `processing/index.ts` re-exports it; it holds no logic, and that barrel has no
 * consumers, so both are candidates for deletion.
 */

export {
  createMaterialFromContent,
  isMaterialPath,
  type TextureLoaderFn,
} from '../materials/standardmaterial3d/loadMaterial';
