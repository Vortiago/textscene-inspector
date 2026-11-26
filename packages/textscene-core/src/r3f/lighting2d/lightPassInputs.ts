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

/** The numbers of the last drawn frame: a frame that reads the same keeps its buffers (ADR-0095). */
export class LightPassInputs {
  /** Written by `drawIfChanged` once a draw returns, cleared by `forget`. */
  private keptLists: readonly AccumulationList[] | null = null;
  private kept: number[] = [];
  private read: number[] = [];

  /** Runs `draw` unless `frame` reads as the kept frame, and keeps `frame` once `draw` returns. */
  drawIfChanged(frame: LightPassFrame, draw: () => void): void {
    this.read.length = 0;
    refreshWorldMatrices(frame);
    const isReadable = readFrame(frame, this.read);
    if (isReadable && this.keptLists === frame.lists && sameNumbers(this.kept, this.read)) return;
    // A draw that throws leaves part of a frame in the buffers, so nothing stays kept.
    this.forget();
    draw();
    if (!isReadable) return;
    this.keptLists = frame.lists;
    const kept = this.read;
    this.read = this.kept;
    this.kept = kept;
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

/** A write this frame moves a node before any render has refreshed the world matrices the read takes. */
function refreshWorldMatrices({ camera, passMeshes }: LightPassFrame): void {
  camera.updateWorldMatrix(true, false);
  for (const { mesh } of passMeshes) mesh.updateWorldMatrix(true, false);
}

/** False when the frame holds a value whose change its numbers cannot show. */
function readFrame(frame: LightPassFrame, out: number[]): boolean {
  const { camera, lists, passMeshes, canvasModulate, resolution, windows } = frame;
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
  out.push(mesh.id, ordinal, role === 'lit' ? 1 : 0, mesh.renderOrder, mesh.layers.mask);
  out.push(mesh.frustumCulled ? 1 : 0);
  readAncestors(mesh, out);
  pushAll(out, mesh.matrixWorld.elements);
  const { geometry, material } = mesh as THREE.Object3D & {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
  };
  if (geometry && !readGeometry(geometry, out)) return false;
  if (Array.isArray(material)) return false;
  return material ? readMaterial(material, out) : true;
}

/** Whether every ancestor is shown, and the nearest group's `renderOrder`, which three sorts by first. */
function readAncestors(mesh: THREE.Object3D, out: number[]): void {
  let isShown = true;
  let groupOrder = 0;
  let hasGroup = false;
  for (let parent = mesh.parent; parent; parent = parent.parent) {
    if (!parent.visible) isShown = false;
    if (!hasGroup && (parent as THREE.Group).isGroup) {
      groupOrder = parent.renderOrder;
      hasGroup = true;
    }
  }
  out.push(isShown ? 1 : 0, groupOrder);
}

/** An attribute swapped in starts at version 0 again, so each one reads as its id and version. */
function readGeometry(geometry: THREE.BufferGeometry, out: number[]): boolean {
  // Morph targets weigh in through the mesh's influences, which no version follows.
  if (Object.keys(geometry.morphAttributes).length > 0) return false;
  const { drawRange, index, groups } = geometry;
  out.push(geometry.id, drawRange.start, drawRange.count, groups.length);
  for (const group of groups) out.push(group.start, group.count, group.materialIndex ?? -1);
  if (index) out.push(index.id, index.version);
  else out.push(NaN);
  for (const name in geometry.attributes) {
    const attribute = geometry.attributes[name]!;
    // An interleaved attribute has no id of its own, so its swap shows in no number.
    if ('isInterleavedBufferAttribute' in attribute) return false;
    out.push(attribute.id, attribute.version);
  }
  return true;
}

function readMaterial(material: THREE.Material, out: number[]): boolean {
  out.push(material.id, material.version, material.blending, material.blendEquation, material.blendSrc);
  out.push(material.blendDst, material.blendEquationAlpha ?? -1, material.blendSrcAlpha ?? -1);
  out.push(material.blendDstAlpha ?? -1, material.blendAlpha, material.visible ? 1 : 0, material.side);
  out.push(material.transparent ? 1 : 0, material.premultipliedAlpha ? 1 : 0, material.colorWrite ? 1 : 0);
  out.push(material.depthTest ? 1 : 0, material.depthWrite ? 1 : 0);
  out.push(material.depthFunc, material.alphaTest, material.alphaToCoverage ? 1 : 0);
  out.push(material.polygonOffset ? 1 : 0, material.polygonOffsetFactor, material.polygonOffsetUnits);
  out.push(
    material.stencilWrite ? 1 : 0,
    material.stencilFunc,
    material.stencilRef,
    material.stencilFuncMask
  );
  out.push(material.stencilWriteMask, material.stencilFail, material.stencilZFail, material.stencilZPass);
  material.blendColor.toArray(out, out.length);
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
  else if (Array.isArray(value)) {
    // The length first, so an array that shrinks beside one that grows reads as a change.
    out.push(value.length);
    return value.every((item) => readValue(item, out));
  } else if ((value as THREE.Texture).isTexture) {
    const texture = value as THREE.Texture;
    if (texture.isRenderTargetTexture) return false;
    out.push(texture.id, texture.version);
  } else if (typeof (value as { toArray?: unknown }).toArray === 'function') {
    (value as { toArray(array: number[], offset: number): unknown }).toArray(out, out.length);
  } else return false;
  return true;
}
