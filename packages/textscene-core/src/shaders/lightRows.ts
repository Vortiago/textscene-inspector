/**
 * The pooled rows of one light kind: one `uniformArray` of `vec4` that every light node of the
 * kind reads, so a program holds one uniform block for the kind however many lights it draws.
 * The handler turns each `uniformArray` into a block of its own (r187 `WebGLNodesHandler.js`
 * `collectUniformsGroups`), and WebGL 2 promises 12 blocks in a fragment program. Rows are `vec4`
 * only, as a `float` or `vec3` array pads each element to a `vec4` in std140
 * (`UniformArrayNode.getPaddedType`).
 */

import * as THREE from 'three';
import { uniformArray } from 'three/tsl';
import type { NodeFrame } from 'three/webgpu';
import type { IntNode, Vec4Node } from './nodeTypes.js';

/** Sets field `field` of the light's slot. */
export type RowWrite = (field: number, x: number, y: number, z: number, w: number) => void;

/** Writes one light's rows before a render. */
export type RowsWriter = (write: RowWrite, frame: NodeFrame) => void;

interface Slot {
  light: THREE.Object3D;
  writer: RowsWriter;
}

/** Whether `object` hangs under a scene, through its parent or any ancestor. */
function isInScene(object: THREE.Object3D): boolean {
  let top = object;
  while (top.parent) top = top.parent;
  return (top as THREE.Scene).isScene === true;
}

export class LightRows {
  /** The rows the array uploads. Written only by the writers, on the array's update once per render. */
  readonly values: THREE.Vector4[];
  private readonly array;
  /** Each slot's light, or null for a free slot. */
  private readonly slots: (Slot | null)[];

  constructor(
    readonly rowsPerLight: number,
    lightCount: number
  ) {
    this.values = Array.from({ length: rowsPerLight * lightCount }, () => new THREE.Vector4());
    this.slots = Array.from({ length: lightCount }, () => null);
    this.array = uniformArray<'vec4'>(this.values, 'vec4').onFrameUpdate((frame) => this.update(frame));
  }

  /**
   * The light's slot, the same one on every call, and `writer` as the writer of its rows. Null
   * when every slot holds a light that is still in a scene: the caller draws that light nothing.
   */
  slotFor(light: THREE.Object3D, writer: RowsWriter): number | null {
    const held = this.slots.findIndex((slot) => slot?.light === light);
    const slot = held >= 0 ? held : this.freeSlot();
    if (slot === null) return null;
    this.slots[slot] = { light, writer };
    return slot;
  }

  /** Field `field` of slot `slot`, one element of the shared array. */
  row(slot: number, field: number): Vec4Node {
    return this.at(slot * this.rowsPerLight + field);
  }

  /** Element `index` of the shared array: a slot's first row, plus a field. */
  at(index: number | IntNode): Vec4Node {
    return this.array.element(index) as unknown as Vec4Node;
  }

  /**
   * Runs the writer of every slot whose light is in a scene. The array calls it once per render,
   * before it uploads the rows, so a light's rows are current for every draw of the render.
   */
  update(frame: NodeFrame): void {
    this.slots.forEach((slot, index) => {
      if (!slot || !isInScene(slot.light)) return;
      const first = index * this.rowsPerLight;
      slot.writer((field, x, y, z, w) => this.values[first + field]!.set(x, y, z, w), frame);
    });
  }

  /** A slot no light holds, or the slot of a light that left its scene. */
  private freeSlot(): number | null {
    const free = this.slots.findIndex((slot) => slot === null || !isInScene(slot.light));
    return free >= 0 ? free : null;
  }
}
