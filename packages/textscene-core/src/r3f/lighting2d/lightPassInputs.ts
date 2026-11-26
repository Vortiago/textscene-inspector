import type * as THREE from 'three';
import type { AccumulationList, PassMesh } from './lightAccumulationPass.js';
import { listWindow } from './lightListWindow.js';
import { visibleInTree } from '../visibleInTree.js';
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

/** The numbers of the last drawn frame: a frame that reads the same keeps its buffers (ADR-0095). */
export class LightPassInputs {
  /** Written by `drawIfChanged` once a draw returns, cleared by `forget`. */
  private keptLists: readonly AccumulationList[] | null = null;
  private kept: number[] = [];
  private read: number[] = [];

  /** Runs `draw` unless `frame` reads as the kept frame, and keeps `frame` once `draw` returns. */
  drawIfChanged(frame: LightPassFrame, draw: () => void): void {
    this.read.length = 0;
    const isReadable = readFrame(frame, this.read);
    if (isReadable && this.keptLists === frame.lists && sameNumbers(this.kept, this.read)) return;
    // A draw that throws leaves part of a frame in the buffers, so nothing stays kept.
    this.forget();
    draw();
    if (!isReadable) return;
    this.keptLists = frame.lists;
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

function pushAll(out: number[], numbers: ArrayLike<number>): void {
  for (let i = 0; i < numbers.length; i += 1) out.push(numbers[i]!);
}

/** False when the frame holds a value whose change its numbers cannot show. */
function readFrame(frame: LightPassFrame, out: number[]): boolean {
  const { camera, lists, passMeshes, canvasModulate, resolution, windows } = frame;
  camera.updateWorldMatrix(true, false);
  out.push(resolution.x, resolution.y, canvasModulate.r, canvasModulate.g, canvasModulate.b);
  pushAll(out, camera.projectionMatrix.elements);
  pushAll(out, camera.matrixWorldInverse.elements);
  for (const list of lists) readWindow(listWindow(list.placementIds, windows), out);
  out.push(passMeshes.size);
  for (const passMesh of passMeshes) if (!readPassMesh(passMesh, out)) return false;
  return true;
}

function readWindow(window: Rect2 | null, out: number[]): void {
  if (window) out.push(1, window.x, window.y, window.w, window.h);
  else out.push(0);
}

function readPassMesh({ mesh, ordinal, role }: PassMesh, out: number[]): boolean {
  mesh.updateWorldMatrix(true, false);
  // The pass sets the mesh's own flag each draw, so only its ancestors' count.
  const isShown = mesh.parent === null || visibleInTree(mesh.parent);
  out.push(mesh.id, ordinal, role === 'lit' ? 1 : 0, isShown ? 1 : 0, mesh.renderOrder);
  pushAll(out, mesh.matrixWorld.elements);
  const { geometry, material } = mesh as THREE.Object3D & {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material;
  };
  if (geometry) readGeometry(geometry, out);
  return material ? readMaterial(material, out) : true;
}

function readGeometry(geometry: THREE.BufferGeometry, out: number[]): void {
  out.push(geometry.id, geometry.index?.version ?? -1);
  for (const name in geometry.attributes) {
    const attribute = geometry.attributes[name]!;
    out.push('isInterleavedBufferAttribute' in attribute ? attribute.data.version : attribute.version);
  }
}

function readMaterial(material: THREE.Material, out: number[]): boolean {
  out.push(material.id, material.version, material.blending, material.blendEquation, material.blendSrc);
  out.push(material.blendDst, material.blendEquationAlpha ?? -1, material.blendSrcAlpha ?? -1);
  out.push(material.blendDstAlpha ?? -1);
  const { uniforms } = material as THREE.Material & { uniforms?: Record<string, THREE.IUniform> };
  if (!uniforms) return true;
  for (const name in uniforms) if (!readValue(uniforms[name]!.value, out)) return false;
  return true;
}

/** A refill bumps a texture's version, but a render target's texels change with none. */
function readValue(value: unknown, out: number[]): boolean {
  if (typeof value === 'number') out.push(value);
  else if (typeof value === 'boolean') out.push(value ? 1 : 0);
  else if (value === null || value === undefined) out.push(NaN);
  else if (Array.isArray(value)) return value.every((item) => readValue(item, out));
  else if ((value as THREE.Texture).isTexture) {
    const texture = value as THREE.Texture;
    if (texture.isRenderTargetTexture) return false;
    out.push(texture.id, texture.version);
  } else if (typeof (value as { toArray?: unknown }).toArray === 'function') {
    pushAll(out, (value as { toArray(): ArrayLike<number> }).toArray());
  } else return false;
  return true;
}
