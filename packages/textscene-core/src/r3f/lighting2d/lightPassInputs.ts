import type * as THREE from 'three';
import type { AccumulationList, PassMesh } from './lightAccumulationPass.js';
import { listWindow } from './lightListWindow.js';
import type { Rect2 } from '../../godot/math/rect2.js';

/** What the pass draws from besides its targets. */
export interface LightPassFrame {
  readonly camera: THREE.Camera;
  readonly lists: readonly AccumulationList[];
  readonly passMeshes: ReadonlySet<PassMesh>;
  readonly canvasModulate: { r: number; g: number; b: number };
  readonly resolution: THREE.Vector2;
  readonly windows: ReadonlyMap<string, Rect2>;
}

/** A value whose change the numbers cannot show, so the frame that holds it always draws. */
class Unreadable extends Error {}

/** The numbers of the last drawn frame: a frame that reads the same keeps its buffers (ADR-0095). */
export class LightPassInputs {
  /** Written by `keep`, cleared by `forget`. */
  private keptLists: readonly AccumulationList[] | null = null;
  private kept: number[] = [];
  private read: number[] = [];
  private readLists: readonly AccumulationList[] | null = null;

  /** Whether `frame` reads as the kept frame. Never while it holds a render target's texture. */
  matches(frame: LightPassFrame): boolean {
    this.read.length = 0;
    this.readLists = null;
    try {
      readFrame(frame, this.read);
    } catch (error) {
      if (!(error instanceof Unreadable)) throw error;
      this.forget();
      return false;
    }
    this.readLists = frame.lists;
    return this.keptLists === frame.lists && sameNumbers(this.kept, this.read);
  }

  /** Keeps the frame `matches` last read, once the pass has drawn it. */
  keep(): void {
    if (this.readLists === null) return;
    this.keptLists = this.readLists;
    [this.kept, this.read] = [this.read, this.kept];
  }

  /** Forgets the kept frame: the buffers no longer hold it. */
  forget(): void {
    this.keptLists = null;
  }
}

/** `Object.is`, so a NaN on both sides reads as the same. */
function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false;
  return true;
}

function readFrame(frame: LightPassFrame, out: number[]): void {
  const { camera, lists, passMeshes, canvasModulate, resolution, windows } = frame;
  camera.updateWorldMatrix(true, false);
  out.push(resolution.x, resolution.y, canvasModulate.r, canvasModulate.g, canvasModulate.b);
  out.push(...camera.projectionMatrix.elements, ...camera.matrixWorldInverse.elements);
  for (const list of lists) readWindow(listWindow(list.placementIds, windows), out);
  out.push(passMeshes.size);
  for (const passMesh of passMeshes) readPassMesh(passMesh, out);
}

function readWindow(window: Rect2 | null, out: number[]): void {
  if (window) out.push(1, window.x, window.y, window.w, window.h);
  else out.push(0);
}

function readPassMesh({ mesh, ordinal, role }: PassMesh, out: number[]): void {
  mesh.updateWorldMatrix(true, false);
  out.push(mesh.id, ordinal, role === 'lit' ? 1 : 0, areAncestorsShown(mesh) ? 1 : 0, mesh.renderOrder);
  out.push(...mesh.matrixWorld.elements);
  const { geometry, material } = mesh as THREE.Object3D & {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material;
  };
  if (geometry) readGeometry(geometry, out);
  if (material) readMaterial(material, out);
}

/** The pass sets the mesh's own flag each draw, but the renderer skips it under a hidden ancestor too. */
function areAncestorsShown(mesh: THREE.Object3D): boolean {
  for (let parent = mesh.parent; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

function readGeometry(geometry: THREE.BufferGeometry, out: number[]): void {
  out.push(geometry.id, geometry.index?.version ?? -1);
  for (const attribute of Object.values(geometry.attributes))
    out.push((attribute as THREE.BufferAttribute).version);
}

function readMaterial(material: THREE.Material, out: number[]): void {
  out.push(material.id, material.version, material.blending, material.blendEquation, material.blendSrc);
  out.push(material.blendDst, material.blendEquationAlpha ?? -1, material.blendSrcAlpha ?? -1);
  out.push(material.blendDstAlpha ?? -1);
  const { uniforms } = material as THREE.Material & { uniforms?: Record<string, THREE.IUniform> };
  if (uniforms) for (const uniform of Object.values(uniforms)) readValue(uniform.value, out);
}

function readValue(value: unknown, out: number[]): void {
  if (typeof value === 'number') out.push(value);
  else if (typeof value === 'boolean') out.push(value ? 1 : 0);
  else if (value === null || value === undefined) out.push(NaN);
  else if (Array.isArray(value)) for (const item of value) readValue(item, out);
  else if (isTexture(value)) readTexture(value, out);
  else if (hasElements(value)) out.push(...value.elements);
  else if (hasToArray(value)) out.push(...value.toArray());
  else throw new Unreadable();
}

/** A refill bumps the version, but a render target's texels change with none. */
function readTexture(texture: THREE.Texture, out: number[]): void {
  if (texture.isRenderTargetTexture) throw new Unreadable();
  out.push(texture.id, texture.version);
}

function isTexture(value: object): value is THREE.Texture {
  return (value as THREE.Texture).isTexture === true;
}

function hasElements(value: object): value is { elements: Iterable<number> } {
  return 'elements' in value;
}

function hasToArray(value: object): value is { toArray(): number[] } {
  return typeof (value as { toArray?: unknown }).toArray === 'function';
}
