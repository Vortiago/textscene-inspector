/**
 * The materials a decal draws its projections with. Godot's decal replaces only the receiver's
 * albedo (`scene_forward_clustered.glsl:1610`) unless an ORM texture is set (`:1627-1636`), so
 * the receiver's roughness, metallic and `diffuse_mode` still shade it. Receivers that agree on
 * those share one material.
 */

import * as THREE from 'three';
import { injectProgram } from '../../../r3f/materialProgramInputs';
import { diffuseModeInjection, diffuseModeOf, diffuseModeUserData } from '../../../r3f/godotDiffuse';
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

/** The material whose terms shade every projection onto `receiver`. */
function firstSurface(receiver: THREE.Mesh): THREE.Material | undefined {
  return Array.isArray(receiver.material) ? receiver.material[0] : receiver.material;
}

/** The first surface's terms, as a projection spans a receiver's surfaces with one material. */
function receiverShading(receiver: THREE.Mesh): ReceiverShading {
  const material = firstSurface(receiver);
  if (!material) return DEFAULT_SHADING;
  const pbr = material instanceof THREE.MeshStandardMaterial ? material : DEFAULT_SHADING;
  return { roughness: pbr.roughness, metalness: pbr.metalness, diffuseMode: diffuseModeOf(material) };
}

/** Whether `projection` still shades as `receiver` does. It allocates nothing, as it runs each frame. */
function shadesAlike(projection: THREE.MeshStandardMaterial, receiver: THREE.Mesh): boolean {
  const material = firstSurface(receiver);
  const pbr = material instanceof THREE.MeshStandardMaterial ? material : DEFAULT_SHADING;
  const diffuseMode = material ? diffuseModeOf(material) : DEFAULT_SHADING.diffuseMode;
  return (
    projection.roughness === pbr.roughness &&
    projection.metalness === pbr.metalness &&
    diffuseModeOf(projection) === diffuseMode
  );
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
    userData: diffuseModeUserData(shading.diffuseMode),
  });
  injectProgram(material, diffuseModeInjection(shading.diffuseMode));
  return material;
}

/** A projection mesh and the receiver it lies on. */
interface Projection {
  mesh: THREE.Mesh;
  receiver: THREE.Mesh;
}

export class DecalProjectionMaterials {
  /** Each material by its receiver shading's key. Written only by `materialFor`, cleared by `dispose`. */
  private readonly byShading = new Map<string, THREE.MeshStandardMaterial>();
  /** Each projection `project` built. Cleared by `dispose`. */
  private readonly projections: Projection[] = [];

  constructor(private readonly look: DecalProjectionLook) {}

  /** A projection mesh of `geometry` onto `receiver`, shaded as the receiver is. */
  project(geometry: THREE.BufferGeometry, receiver: THREE.Mesh): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.materialFor(receiver));
    this.projections.push({ mesh, receiver });
    return mesh;
  }

  /**
   * Re-shades each projection whose receiver's terms moved, as when its `.tres` loads after the
   * decal or an edit changes its roughness, and is true when one did.
   */
  followReceivers(): boolean {
    let changed = false;
    for (const { mesh, receiver } of this.projections) {
      if (shadesAlike(mesh.material as THREE.MeshStandardMaterial, receiver)) continue;
      mesh.material = this.materialFor(receiver);
      changed = true;
    }
    return changed;
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
    this.projections.length = 0;
  }

  private materialFor(receiver: THREE.Mesh): THREE.MeshStandardMaterial {
    const shading = receiverShading(receiver);
    const key = `${shading.roughness}|${shading.metalness}|${shading.diffuseMode}`;
    let material = this.byShading.get(key);
    if (!material) {
      material = projectionMaterial(this.look, shading);
      this.byShading.set(key, material);
    }
    return material;
  }
}
