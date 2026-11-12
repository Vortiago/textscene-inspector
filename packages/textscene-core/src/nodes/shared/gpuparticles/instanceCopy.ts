/**
 * The instance buffer the copy shader fills (`particles_copy.glsl`): the settled particles in the
 * draw order, each with its basis turned for `transform_align`. Pure: no THREE and no React.
 */

import { affineInverseTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import type { Vector3 } from '../../../godot/math/vector';
import { GpuTransformAlign } from '../../../godot/scene/particles3d';
import { PARTICLE_FLOATS } from '../particles3d/particleBuffer';
import { dot, normalize, type Float3 } from './float3';
import { alignColumns, type AlignView, type Columns } from './instanceAlign';
import { rowsInDrawOrder } from './instanceOrder';
import type { SettledGpuParticles } from './settle';

/** The camera's `basis.get_column(2)` and `get_column(1)`, in world space. */
export interface CameraAxes {
  axis: Vector3;
  up: Vector3;
}

export interface InstanceCopy {
  /** `amount` of the emitter. */
  amount: number;
  drawOrder: number;
  transformAlign: number;
  localCoords: boolean;
  /** The node's global transform: the settle took a world-space particle back through it. */
  emissionTransform: Transform3D;
  /** Null until the camera is known: the order is then the index order, and no billboard turns. */
  view: CameraAxes | null;
}

/** The instance buffer for `settled`: the settled buffer itself when nothing orders or turns it. */
export function copyInstances(settled: SettledGpuParticles, request: InstanceCopy): Float32Array {
  const frame = simulationFrame(request);
  const view = request.view && frame.view(request.view);
  const order = rowsInDrawOrder(
    request.drawOrder,
    { phase: settled.phase, indices: settled.indices, amount: request.amount },
    view && ((row) => dot(view.direction, frame.toSimulation(originAt(settled.buffer, row))))
  );
  const turns = turnsBasis(request.transformAlign, view);
  if (!order && !turns) return settled.buffer;

  const copied = new Float32Array(settled.buffer.length);
  for (let slot = 0; slot < settled.indices.length; slot++) {
    const row = order ? order[slot]! : slot;
    const at = slot * PARTICLE_FLOATS;
    copied.set(settled.buffer.subarray(row * PARTICLE_FLOATS, (row + 1) * PARTICLE_FLOATS), at);
    if (turns) {
      const velocity: Float3 = [
        settled.velocity[row * 3]!,
        settled.velocity[row * 3 + 1]!,
        settled.velocity[row * 3 + 2]!,
      ];
      turnBasis(copied, at, request.transformAlign, velocity, view, frame);
    }
  }
  return copied;
}

/** Y_TO_VELOCITY reads the velocity alone; the other turns read the camera (`particles_storage.cpp:1223`). */
function turnsBasis(transformAlign: number, view: AlignView | null): boolean {
  if (transformAlign === GpuTransformAlign.DISABLED) return false;
  return transformAlign === GpuTransformAlign.Y_TO_VELOCITY || view !== null;
}

/** The space the particles simulate in, against node space. */
interface SimulationFrame {
  toSimulation(vector: Float3): Float3;
  toNode(vector: Float3): Float3;
  /** The camera axes in this space. */
  view(camera: CameraAxes): AlignView;
}

/** World-space particles sit in the node's frame turned by its basis; local-coordinate ones sit in node space itself. */
function simulationFrame({ localCoords, emissionTransform }: InstanceCopy): SimulationFrame {
  const rows = basisRows(emissionTransform);
  const inverseRows = basisRows(affineInverseTransform3D(emissionTransform));
  const same = (vector: Float3) => vector;
  return {
    toSimulation: localCoords ? same : (vector) => applied(rows, vector),
    toNode: localCoords ? same : (vector) => applied(inverseRows, vector),
    // `normalize(basis.xform_inv(axis))` for local coordinates; the up axis stays in the world (`particles_storage.cpp:1307-1309`).
    view: ({ axis, up }) => {
      const direction: Float3 = [axis.x, axis.y, axis.z];
      return {
        direction: localCoords ? normalize(applied(transposed(rows), direction)) : direction,
        up: [up.x, up.y, up.z],
      };
    },
  };
}

/** Turns the basis of the row at `at` in `copied`, which holds node-space rows. */
function turnBasis(
  copied: Float32Array,
  at: number,
  transformAlign: number,
  velocity: Float3,
  view: AlignView | null,
  frame: SimulationFrame
): void {
  const columns = [0, 1, 2].map((column) => frame.toSimulation(columnAt(copied, at, column))) as Columns;
  alignColumns(transformAlign, columns, velocity, view);
  columns.forEach((column, index) => {
    const [x, y, z] = frame.toNode(column);
    copied[at + index] = x;
    copied[at + 4 + index] = y;
    copied[at + 8 + index] = z;
  });
}

/** Column `column` of the transform in the rows at `at`; column 3 is the origin. */
function columnAt(buffer: Float32Array, at: number, column: number): Float3 {
  return [buffer[at + column]!, buffer[at + 4 + column]!, buffer[at + 8 + column]!];
}

function basisRows({ basis_x: x, basis_y: y, basis_z: z }: Transform3D): Float3[] {
  return [
    [x.x, x.y, x.z],
    [y.x, y.y, y.z],
    [z.x, z.y, z.z],
  ];
}

function applied(rows: Float3[], vector: Float3): Float3 {
  return [dot(rows[0]!, vector), dot(rows[1]!, vector), dot(rows[2]!, vector)];
}

function transposed(rows: Float3[]): Float3[] {
  return [0, 1, 2].map((column) => [rows[0]![column]!, rows[1]![column]!, rows[2]![column]!] as Float3);
}

/** Row `row`'s origin in node space. */
function originAt(buffer: Float32Array, row: number): Float3 {
  return columnAt(buffer, row * PARTICLE_FLOATS, 3);
}
