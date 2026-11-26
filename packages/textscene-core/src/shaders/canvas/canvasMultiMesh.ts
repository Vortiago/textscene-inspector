import * as THREE from 'three';
import { INSTANCE_ID_ATTRIBUTE } from '../template/surfaceAttributes.js';

/** One instance of a 2D MultiMesh: its transform rows, and its colour and custom data or null for none. */
export interface CanvasInstance {
  readonly transform: Float32Array;
  readonly color: Float32Array | null;
  readonly customData: Float32Array | null;
}

/** A 2D MultiMesh's instance buffer as the canvas template reads it from `transforms.data`. */
export interface CanvasInstances {
  readonly count: number;
  /** Each instance's two transform rows, then its colour and custom data where used. */
  readonly words: Uint32Array;
  readonly usesColors: boolean;
  readonly usesCustomData: boolean;
}

/** `canvas_uniforms_inc.glsl:42-46`. */
const INSTANCING_SINGLE = 1;
const INSTANCING_HAS_COLORS = 1 << 7;
const INSTANCING_HAS_CUSTOM_DATA = 1 << 8;

/** Every bit of `batch_flags` the instancing of a batch sets. */
export const INSTANCING_BITS = 0x7f | INSTANCING_HAS_COLORS | INSTANCING_HAS_CUSTOM_DATA;

/** The two rows of a `TRANSFORM_2D` instance (`mesh_storage.cpp:1927-1934`). */
const TRANSFORM_2D_FLOATS = 8;
const VECTOR_FLOATS = 4;

/** The buffer `multimesh_set_buffer` holds for `instances`, every instance in one format. */
export function canvasInstances(instances: readonly CanvasInstance[]): CanvasInstances {
  const usesColors = instances[0]?.color != null;
  const usesCustomData = instances[0]?.customData != null;
  const stride =
    TRANSFORM_2D_FLOATS + (usesColors ? VECTOR_FLOATS : 0) + (usesCustomData ? VECTOR_FLOATS : 0);
  const floats = new Float32Array(instances.length * stride);
  instances.forEach(({ transform, color, customData }, index) => {
    let offset = index * stride;
    if (transform.length !== TRANSFORM_2D_FLOATS)
      throw new Error(
        `expected ${TRANSFORM_2D_FLOATS} transform floats a 2D instance, got ${transform.length}`
      );
    floats.set(transform, offset);
    offset += TRANSFORM_2D_FLOATS;
    if (usesColors) {
      floats.set(color!, offset);
      offset += VECTOR_FLOATS;
    }
    if (usesCustomData) floats.set(customData!, offset);
  });
  return { count: instances.length, words: new Uint32Array(floats.buffer), usesColors, usesCustomData };
}

/** The instancing bits of a multimesh batch (`renderer_canvas_render_rd.cpp:2792-2799`). */
export function instancingFlags({ usesColors, usesCustomData }: CanvasInstances): number {
  return (
    INSTANCING_SINGLE |
    (usesColors ? INSTANCING_HAS_COLORS : 0) |
    (usesCustomData ? INSTANCING_HAS_CUSTOM_DATA : 0)
  );
}

/** `geometry` drawn `count` times in one call, sharing its attributes and index. */
export function instancedGeometry(
  geometry: THREE.BufferGeometry,
  count: number
): THREE.InstancedBufferGeometry {
  const instanced = new THREE.InstancedBufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes))
    instanced.setAttribute(name, attribute);
  instanced.setIndex(geometry.getIndex());
  instanced.instanceCount = count;
  instanced.boundingSphere = geometry.boundingSphere;
  return instanced;
}

/** Emulated points drawn for each of `count` instances, all of instance 0 first, as Godot orders them. */
export function instancedPoints(
  points: THREE.InstancedBufferGeometry,
  count: number
): THREE.InstancedBufferGeometry {
  if (count === 1) return points;
  const pointCount = points.instanceCount;
  const instanced = new THREE.InstancedBufferGeometry();
  instanced.instanceCount = pointCount * count;
  for (const [name, attribute] of Object.entries(points.attributes)) {
    const perPoint = attribute as THREE.InstancedBufferAttribute;
    if (name === INSTANCE_ID_ATTRIBUTE) instanced.setAttribute(name, instanceIds(pointCount, count));
    else if (!perPoint.isInstancedBufferAttribute) instanced.setAttribute(name, attribute);
    else instanced.setAttribute(name, repeatedPerPoint(perPoint, pointCount, count));
  }
  instanced.setIndex(points.getIndex());
  instanced.boundingSphere = points.boundingSphere;
  instanced.boundingBox = points.boundingBox;
  return instanced;
}

function instanceIds(pointCount: number, count: number): THREE.InstancedBufferAttribute {
  const ids = new Float32Array(pointCount * count);
  for (let instance = 0; instance < count; instance++)
    ids.fill(instance, instance * pointCount, (instance + 1) * pointCount);
  return new THREE.InstancedBufferAttribute(ids, 1);
}

/** A point's attribute for every instance: a constant one stays one item for every quad. */
function repeatedPerPoint(
  attribute: THREE.InstancedBufferAttribute,
  pointCount: number,
  count: number
): THREE.InstancedBufferAttribute {
  const isConstant = attribute.meshPerAttribute > 1;
  const source = attribute.array as Float32Array | Uint32Array;
  const values = isConstant
    ? source
    : new (source.constructor as Float32ArrayConstructor)(source.length * count);
  if (!isConstant)
    for (let instance = 0; instance < count; instance++) values.set(source, instance * source.length);
  const repeated = new THREE.InstancedBufferAttribute(
    values,
    attribute.itemSize,
    attribute.normalized,
    isConstant ? pointCount * count : 1
  );
  repeated.gpuType = attribute.gpuType;
  return repeated;
}
