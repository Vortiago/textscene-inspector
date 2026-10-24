/**
 * The materials a decal draws its projections with. Godot's decal replaces only the receiver's
 * albedo (`scene_forward_clustered.glsl:1610`) unless an ORM texture is set (`:1627-1636`), so
 * the receiver's roughness, metallic, `metallic_specular`, `diffuse_mode`, `specular_mode` and
 * `disable_specular_occlusion` still shade it. Receivers that agree on those share one material.
 */

import * as THREE from 'three';
import { composeInjections, injectViewportProgram } from '../../../r3f/materialProgramInputs';
import {
  SPECULAR_OCCLUSION_DISABLED,
  disablesSpecularOcclusion,
  specularOcclusionUserData,
} from '../../../r3f/godotIndirectSpecular';
import type { DecalAtlasRect } from './decalAtlas';
import {
  drawsLightModesOf,
  lightModesInjection,
  lightModesOf,
  lightModesUserData,
  type LightModes,
} from '../../../r3f/lightModes';

/** What every projection of one decal shares: the decal atlas, tint and opacity. */
export interface DecalProjectionLook {
  /** The decal atlas. `placeInAtlas` moves each projection's UVs onto the decal's rectangle in it. */
  map: THREE.Texture;
  color: THREE.Color;
  opacity: number;
}

/** The receiver's terms that still shade the projection. */
interface ReceiverShading {
  roughness: number;
  metalness: number;
  /** three's `specularIntensity`, which carries `metallic_specular`. */
  specularIntensity: number;
  lightModes: LightModes;
  disablesSpecularOcclusion: boolean;
}

/** A receiver drawn without PBR terms, such as an unshaded one, shades as BaseMaterial3D's defaults. */
const DEFAULT_PBR = { roughness: 1, metalness: 0 };

/** three's `specularIntensity` at Godot's default `metallic_specular` of 0.5, as a standard class draws it. */
const DEFAULT_SPECULAR_INTENSITY = 1;

function specularIntensityOf(material: THREE.Material | undefined): number {
  return material instanceof THREE.MeshPhysicalMaterial
    ? material.specularIntensity
    : DEFAULT_SPECULAR_INTENSITY;
}

/** The material whose terms shade every projection onto `receiver`. */
function firstSurface(receiver: THREE.Mesh): THREE.Material | undefined {
  return Array.isArray(receiver.material) ? receiver.material[0] : receiver.material;
}

/** The first surface's terms, as a projection spans a receiver's surfaces with one material. */
function receiverShading(receiver: THREE.Mesh): ReceiverShading {
  const material = firstSurface(receiver);
  const pbr = material instanceof THREE.MeshStandardMaterial ? material : DEFAULT_PBR;
  return {
    roughness: pbr.roughness,
    metalness: pbr.metalness,
    specularIntensity: specularIntensityOf(material),
    lightModes: lightModesOf(material),
    disablesSpecularOcclusion: disablesSpecularOcclusion(material),
  };
}

/** Whether `projection` still shades as `receiver` does. It allocates nothing, as it runs each frame. */
function shadesAlike(projection: THREE.MeshPhysicalMaterial, receiver: THREE.Mesh): boolean {
  const material = firstSurface(receiver);
  const pbr = material instanceof THREE.MeshStandardMaterial ? material : DEFAULT_PBR;
  return (
    projection.roughness === pbr.roughness &&
    projection.metalness === pbr.metalness &&
    projection.specularIntensity === specularIntensityOf(material) &&
    drawsLightModesOf(projection, material) &&
    disablesSpecularOcclusion(projection) === disablesSpecularOcclusion(material)
  );
}

/** The physical class, for `specularIntensity`. At its defaults it draws as the standard class does. */
function projectionMaterial(look: DecalProjectionLook, shading: ReceiverShading): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    map: look.map,
    color: look.color,
    roughness: shading.roughness,
    metalness: shading.metalness,
    specularIntensity: shading.specularIntensity,
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
    userData: {
      ...lightModesUserData(shading.lightModes),
      ...specularOcclusionUserData(shading.disablesSpecularOcclusion),
    },
  });
  injectViewportProgram(
    material,
    composeInjections([
      lightModesInjection(shading.lightModes),
      shading.disablesSpecularOcclusion ? SPECULAR_OCCLUSION_DISABLED : undefined,
    ])
  );
  return material;
}

/** A projection mesh and the receiver it lies on. */
interface Projection {
  mesh: THREE.Mesh;
  receiver: THREE.Mesh;
  /** The UVs the geometry was baked with, over the whole texture, which the atlas rectangle scales. */
  textureUv: Float32Array;
}

/**
 * Maps the projection's texture UVs into `rect`, as the shader of Godot's decal does
 * (`scene_forward_clustered.glsl:1604`), and shows it. Without a rectangle the projection has no
 * texture to sample, and is hidden.
 */
function placeIn(rect: DecalAtlasRect | undefined, { mesh, textureUv }: Projection): void {
  mesh.visible = rect !== undefined;
  if (!rect) return;
  const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
  const placed = uv.array as Float32Array;
  for (let i = 0; i < textureUv.length; i += 2) {
    placed[i] = textureUv[i]! * rect.width + rect.x;
    placed[i + 1] = textureUv[i + 1]! * rect.height + rect.y;
  }
  uv.needsUpdate = true;
}

export class DecalProjectionMaterials {
  /** Each material by its receiver shading's key. Written only by `materialFor`, cleared by `dispose`. */
  private readonly byShading = new Map<string, THREE.MeshPhysicalMaterial>();
  /** Each projection `project` built. Cleared by `dispose`. */
  private readonly projections: Projection[] = [];
  /** Where the decal's texture lies in the atlas. Written only by `placeInAtlas`. */
  private rect: DecalAtlasRect | undefined;

  constructor(private readonly look: DecalProjectionLook) {}

  /**
   * A projection mesh of `geometry` onto `receiver`, shaded as the receiver is. `geometry`'s `uv`
   * runs over the whole texture, top row at v = 0, and this rewrites it into the atlas.
   */
  project(geometry: THREE.BufferGeometry, receiver: THREE.Mesh): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.materialFor(receiver));
    const projection = { mesh, receiver, textureUv: Float32Array.from(geometry.getAttribute('uv').array) };
    this.projections.push(projection);
    placeIn(this.rect, projection);
    return mesh;
  }

  /**
   * Moves every projection onto `rect`, the decal's texture in the atlas. The atlas hands out the
   * same rectangle until it rebuilds, so one that is the same object moves nothing.
   */
  placeInAtlas(rect: DecalAtlasRect | undefined): void {
    if (rect === this.rect) return;
    this.rect = rect;
    for (const projection of this.projections) placeIn(rect, projection);
  }

  /**
   * Re-shades each projection whose receiver's terms moved, as when its `.tres` loads after the
   * decal or an edit changes its roughness, and is true when one did.
   */
  followReceivers(): boolean {
    let changed = false;
    for (const { mesh, receiver } of this.projections) {
      if (shadesAlike(mesh.material as THREE.MeshPhysicalMaterial, receiver)) continue;
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

  private materialFor(receiver: THREE.Mesh): THREE.MeshPhysicalMaterial {
    const shading = receiverShading(receiver);
    const { diffuseMode, specularMode } = shading.lightModes;
    const key = [
      shading.roughness,
      shading.metalness,
      shading.specularIntensity,
      diffuseMode,
      specularMode,
      shading.disablesSpecularOcclusion,
    ].join('|');
    let material = this.byShading.get(key);
    if (!material) {
      material = projectionMaterial(this.look, shading);
      this.byShading.set(key, material);
    }
    return material;
  }
}
