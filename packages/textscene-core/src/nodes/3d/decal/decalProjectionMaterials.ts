/**
 * The materials a decal draws its projections with. Godot's decal replaces only the receiver's
 * albedo (`scene_forward_clustered.glsl:1610`) unless an ORM texture is set (`:1627-1636`), so the receiver's roughness, metallic and
 * `diffuse_mode` still shade it. Receivers that agree on those share one material.
 */

import * as THREE from 'three';
import { injectProgram } from '../../../r3f/materialProgramInputs';
import { diffuseModeInjection, diffuseModeOf } from '../../../r3f/godotDiffuse';
import { DiffuseMode } from '../../../godot/diffuseMode';

/** What every projection of one decal shares: its texture, tint and opacity. */
export interface DecalProjectionLook {
  map: THREE.Texture;
  color: THREE.Color;
  opacity: number;
}

/** The receiver's terms that still shade the projection. */
interface ReceiverShading {
  roughness: number;
  metalness: number;
  diffuseMode: number;
}

/** A receiver drawn without PBR terms, such as an unshaded one, shades as BaseMaterial3D's defaults. */
const DEFAULT_SHADING: ReceiverShading = {
  roughness: 1,
  metalness: 0,
  diffuseMode: DiffuseMode.DIFFUSE_BURLEY,
};

/** The first surface's terms, as a projection spans a receiver's surfaces with one material. */
function receiverShading(receiver: THREE.Mesh): ReceiverShading {
  const material = Array.isArray(receiver.material) ? receiver.material[0] : receiver.material;
  if (!material) return DEFAULT_SHADING;
  const pbr = material instanceof THREE.MeshStandardMaterial ? material : DEFAULT_SHADING;
  return { roughness: pbr.roughness, metalness: pbr.metalness, diffuseMode: diffuseModeOf(material) };
}

function projectionMaterial(look: DecalProjectionLook, shading: ReceiverShading): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: look.map,
    color: look.color,
    roughness: shading.roughness,
    metalness: shading.metalness,
    transparent: true,
    opacity: look.opacity,
    // Godot's depth/normal fades ride the baked RGBA `color` attribute, whose RGB is 1, so only
    // alpha scales. three enables vertex alpha only at itemSize 4, and
    // `buildDecalProjectionGeometry` always writes the attribute, so no geometry lacks one,
    // which would sample the material default instead of skipping the fade.
    vertexColors: true,
    depthWrite: false,
    // Sit the projection on the surface without z-fighting the coincident receiver face.
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  injectProgram(material, diffuseModeInjection(shading.diffuseMode));
  return material;
}

export class DecalProjectionMaterials {
  /** Each material by its receiver shading's key. Written only by `shading`, cleared by `dispose`. */
  private readonly byShading = new Map<string, THREE.MeshStandardMaterial>();

  constructor(private readonly look: DecalProjectionLook) {}

  /** The material that shades a projection onto `receiver` as the receiver is shaded. */
  shading(receiver: THREE.Mesh): THREE.MeshStandardMaterial {
    const shading = receiverShading(receiver);
    const key = `${shading.roughness}|${shading.metalness}|${shading.diffuseMode}`;
    let material = this.byShading.get(key);
    if (!material) {
      material = projectionMaterial(this.look, shading);
      this.byShading.set(key, material);
    }
    return material;
  }

  /** Writes `opacity` to every material, and is true when that changed one. */
  setOpacity(opacity: number): boolean {
    let changed = false;
    for (const material of this.byShading.values()) {
      if (material.opacity === opacity) continue;
      material.opacity = opacity;
      changed = true;
    }
    return changed;
  }

  dispose(): void {
    for (const material of this.byShading.values()) material.dispose();
    this.byShading.clear();
  }
}
