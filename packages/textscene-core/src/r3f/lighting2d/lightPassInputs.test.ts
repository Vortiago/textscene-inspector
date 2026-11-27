import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LightPassInputs, type LightPassFrame } from './lightPassInputs';
import type { AccumulationList, PassMesh } from './lightAccumulationPass';
import { LIGHT_PASS_LAYER } from './lightPassLayers';
import type { Rect2 } from '../../godot/math/rect2';

type LightMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

/** A frame whose fields a row may write, as the pass's own objects are written in place. */
type Frame = { -readonly [K in keyof LightPassFrame]: LightPassFrame[K] };

/** One light mesh in a group on the pass layer, under a scene, with a uniform of each kind. */
interface Rig {
  readonly mesh: LightMesh;
  readonly group: THREE.Group;
  readonly frame: Frame;
  readonly passMeshes: Set<PassMesh>;
}

function lightMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uEnergy: { value: 1 },
      uShadowed: { value: false },
      uCookie: { value: new THREE.Texture() },
      uOffset: { value: new THREE.Vector2() },
      uColor: { value: new THREE.Color(1, 1, 1) },
      uHeights: { value: [1, 2] },
      uWidths: { value: [3] },
      uUnset: { value: null },
    },
  });
}

function lightMesh(material: THREE.Material = lightMaterial()): LightMesh {
  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(new THREE.PlaneGeometry(), material);
  mesh.layers.set(LIGHT_PASS_LAYER);
  return mesh as LightMesh;
}

function rigOf(mesh: THREE.Object3D = lightMesh()): Rig {
  const group = new THREE.Group();
  group.layers.set(LIGHT_PASS_LAYER);
  new THREE.Scene().add(group.add(mesh));
  const passMeshes = new Set<PassMesh>([{ mesh, ordinal: 0, role: 'lit' }]);
  const list: AccumulationList = { entries: new Map(), placementIds: ['item'], summed: null, apart: null };
  const frame: Frame = {
    camera: new THREE.OrthographicCamera(),
    lists: [list],
    passMeshes,
    canvasModulate: { r: 1, g: 1, b: 1 },
    resolution: new THREE.Vector2(4, 2),
    windows: new Map(),
  };
  return { mesh: mesh as LightMesh, group, frame, passMeshes };
}

/** Draws the rig's frame once, applies `write`, and answers whether the next frame drew. */
function drawsAfter(rig: Rig, write: (rig: Rig) => void): boolean {
  const inputs = new LightPassInputs();
  inputs.drawIfChanged(rig.frame, () => {});
  write(rig);
  const draw = vi.fn();
  inputs.drawIfChanged(rig.frame, draw);
  return draw.mock.calls.length === 1;
}

/** Changes the first pass mesh in place in the set's order, which is the order the key reads. */
function replacePassMesh({ passMeshes }: Rig, change: Partial<PassMesh>): void {
  const [first, ...rest] = passMeshes;
  passMeshes.clear();
  for (const passMesh of [{ ...first!, ...change }, ...rest]) passMeshes.add(passMesh);
}

/** A second light mesh at the same render order, so three orders the two by material and mesh id. */
function pairRig(): Rig {
  const rig = rigOf();
  const second = lightMesh();
  rig.group.add(second);
  rig.passMeshes.add({ mesh: second, ordinal: 1, role: 'lit' });
  return rig;
}

/** A mesh like the first, made later, so its id sorts after the second mesh's. */
function laterTwin(rig: Rig): void {
  const twin = new THREE.Mesh(rig.mesh.geometry, rig.mesh.material);
  twin.layers.set(LIGHT_PASS_LAYER);
  rig.group.remove(rig.mesh).add(twin);
  replacePassMesh(rig, { mesh: twin });
}

/** Two lists, the first with a window of zeros, which reads as the second's window without a flag. */
function twoListsRig(): Rig {
  const rig = rigOf();
  const second: AccumulationList = { entries: new Map(), placementIds: ['other'], summed: null, apart: null };
  rig.frame.lists = [...rig.frame.lists, second];
  rig.frame.windows = new Map([['item', { x: 0, y: 0, w: 0, h: 0 }]]);
  return rig;
}

function groupedRig(): Rig {
  const rig = rigOf();
  rig.mesh.geometry.addGroup(0, 6, 0);
  return rig;
}

function windowedRig(): Rig {
  const rig = rigOf();
  rig.frame.windows = new Map([['item', { x: 0, y: 0, w: 2, h: 2 }]]);
  return rig;
}

function moveWindow({ frame }: Rig, change: Partial<Rect2>): void {
  frame.windows = new Map([['item', { ...frame.windows.get('item')!, ...change }]]);
}

function sphere({ mesh }: Rig): THREE.Sphere {
  mesh.geometry.computeBoundingSphere();
  return mesh.geometry.boundingSphere!;
}

function material({ mesh }: Rig): THREE.ShaderMaterial {
  return mesh.material;
}

function uniform({ mesh }: Rig, name: string): THREE.IUniform {
  return mesh.material.uniforms[name]!;
}

function position({ mesh }: Rig): THREE.BufferAttribute {
  return mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
}

function instancedRig(): Rig {
  const plane = new THREE.PlaneGeometry();
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(plane.getIndex()).setAttribute('position', plane.getAttribute('position'));
  geometry.setAttribute('aShift', new THREE.InstancedBufferAttribute(new Float32Array(4), 2));
  return rigOf(new THREE.Mesh(geometry, lightMaterial()));
}

/** A group outside the pass layer, whose render order three leaves out of the sort. */
function groupOffLayerRig(): Rig {
  const rig = rigOf();
  rig.group.layers.set(0);
  rig.group.renderOrder = 3;
  return rig;
}

/** Each input three r187 reads to draw a pass mesh, with a write that only its own key field shows. */
const KEYED_INPUTS: ReadonlyArray<readonly [string, (rig: Rig) => void, () => Rig]> = [
  ['the drawing buffer width', ({ frame }) => frame.resolution.set(8, 2), rigOf],
  ['the drawing buffer height', ({ frame }) => frame.resolution.set(4, 8), rigOf],
  ['the canvas modulate red', ({ frame }) => (frame.canvasModulate = { r: 0.5, g: 1, b: 1 }), rigOf],
  ['the canvas modulate green', ({ frame }) => (frame.canvasModulate = { r: 1, g: 0.5, b: 1 }), rigOf],
  ['the canvas modulate blue', ({ frame }) => (frame.canvasModulate = { r: 1, g: 1, b: 0.5 }), rigOf],
  [
    'the camera projection',
    ({ frame }) => (
      ((frame.camera as THREE.OrthographicCamera).zoom = 2),
      (frame.camera as THREE.OrthographicCamera).updateProjectionMatrix()
    ),
    rigOf,
  ],
  [
    'the camera transform',
    ({ frame }) => ((frame.camera.position.x = 3), frame.camera.updateMatrixWorld()),
    rigOf,
  ],
  [
    'the list a window is on',
    ({ frame }) => (frame.windows = new Map([['other', frame.windows.get('item')!]])),
    twoListsRig,
  ],
  ['a window x', (rig) => moveWindow(rig, { x: 1 }), windowedRig],
  ['a window y', (rig) => moveWindow(rig, { y: 1 }), windowedRig],
  ['a window width', (rig) => moveWindow(rig, { w: 1 }), windowedRig],
  ['a window height', (rig) => moveWindow(rig, { h: 1 }), windowedRig],
  ['the lists', ({ frame }) => (frame.lists = [...frame.lists]), rigOf],
  [
    'the pass mesh count',
    ({ passMeshes }) => passMeshes.add({ mesh: lightMesh(), ordinal: 1, role: 'lit' }),
    rigOf,
  ],
  ['the mesh id, which orders meshes three cannot tell apart', laterTwin, pairRig],
  ['the light ordinal', (rig) => replacePassMesh(rig, { ordinal: 1 }), rigOf],
  ['the mesh role', (rig) => replacePassMesh(rig, { role: 'unshadowed' }), rigOf],
  ['the mesh render order', ({ mesh }) => (mesh.renderOrder = 3), rigOf],
  ['the mesh layers', ({ mesh }) => mesh.layers.set(2), rigOf],
  ['the mesh frustum culling', ({ mesh }) => (mesh.frustumCulled = false), rigOf],
  ["an ancestor's visibility", ({ group }) => (group.visible = false), rigOf],
  ['the group render order', ({ group }) => (group.renderOrder = 3), rigOf],
  ["a group's layers", ({ group }) => group.layers.set(LIGHT_PASS_LAYER), groupOffLayerRig],
  ['the scene the mesh is in', ({ group }) => group.removeFromParent(), rigOf],
  ['the mesh transform', ({ mesh }) => (mesh.position.x = 1), rigOf],
  ['the geometry', ({ mesh }) => (mesh.geometry = new THREE.PlaneGeometry()), rigOf],
  ['the draw range start', ({ mesh }) => mesh.geometry.setDrawRange(3, Infinity), rigOf],
  ['the draw range count', ({ mesh }) => mesh.geometry.setDrawRange(0, 3), rigOf],
  ['the geometry group count', ({ mesh }) => mesh.geometry.addGroup(0, 3, 0), rigOf],
  ['a geometry group start', ({ mesh }) => (mesh.geometry.groups[0]!.start = 3), groupedRig],
  ['a geometry group count', ({ mesh }) => (mesh.geometry.groups[0]!.count = 3), groupedRig],
  ['a geometry group material', ({ mesh }) => (mesh.geometry.groups[0]!.materialIndex = 1), groupedRig],
  ['the bounding sphere centre x', (rig) => (sphere(rig).center.x = 5), rigOf],
  ['the bounding sphere centre y', (rig) => (sphere(rig).center.y = 5), rigOf],
  ['the bounding sphere centre z', (rig) => (sphere(rig).center.z = 5), rigOf],
  ['the bounding sphere radius', (rig) => (sphere(rig).radius = 9), rigOf],
  [
    'the instance count',
    ({ mesh }) => ((mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = 2),
    instancedRig,
  ],
  ['the index', ({ mesh }) => mesh.geometry.setIndex(mesh.geometry.getIndex()!.clone()), rigOf],
  ['the index version', ({ mesh }) => (mesh.geometry.getIndex()!.needsUpdate = true), rigOf],
  [
    'an attribute',
    ({ mesh }) => mesh.geometry.setAttribute('position', mesh.geometry.getAttribute('position').clone()),
    rigOf,
  ],
  ['an attribute version', (rig) => (position(rig).needsUpdate = true), rigOf],
  [
    'an attribute count',
    (rig) => position(rig).copy(new THREE.BufferAttribute(new Float32Array(9), 3)),
    rigOf,
  ],
  ['an attribute item size', (rig) => (position(rig).itemSize = 2), rigOf],
  ['an attribute normalisation', (rig) => (position(rig).normalized = true), rigOf],
  [
    'an attribute instance step',
    ({ mesh }) =>
      ((mesh.geometry.getAttribute('aShift') as THREE.InstancedBufferAttribute).meshPerAttribute = 2),
    instancedRig,
  ],
  [
    'the material id, which orders meshes three cannot tell apart',
    ({ mesh }) => (mesh.material = new THREE.ShaderMaterial({ uniforms: mesh.material.uniforms })),
    pairRig,
  ],
  ['the material version', (rig) => (material(rig).needsUpdate = true), rigOf],
  ['the material visibility', (rig) => (material(rig).visible = false), rigOf],
  ['the side', (rig) => (material(rig).side = THREE.DoubleSide), rigOf],
  ['the single pass', (rig) => (material(rig).forceSinglePass = false), rigOf],
  ['the transparency', (rig) => (material(rig).transparent = true), rigOf],
  [
    'the transmission',
    (rig) => ((material(rig) as THREE.ShaderMaterial & { transmission: number }).transmission = 1),
    rigOf,
  ],
  ['the colour write', (rig) => (material(rig).colorWrite = false), rigOf],
  [
    'the alpha test',
    (rig) => (material(rig).alphaTest = 0.5),
    withMaterial((shader) => (shader.alphaTest = 0.3)),
  ],
  ['the alpha to coverage', (rig) => (material(rig).alphaToCoverage = true), rigOf],
  ['the wireframe', (rig) => (material(rig).wireframe = true), rigOf],
  ['the wireframe width', (rig) => (material(rig).wireframeLinewidth = 2), rigOf],
  ['the blending', (rig) => (material(rig).blending = THREE.AdditiveBlending), rigOf],
  ['the blend equation', (rig) => (material(rig).blendEquation = THREE.SubtractEquation), rigOf],
  ['the blend source', (rig) => (material(rig).blendSrc = THREE.OneFactor), rigOf],
  ['the blend destination', (rig) => (material(rig).blendDst = THREE.OneFactor), rigOf],
  ['the alpha blend equation', (rig) => (material(rig).blendEquationAlpha = THREE.SubtractEquation), rigOf],
  ['the alpha blend source', (rig) => (material(rig).blendSrcAlpha = THREE.OneFactor), rigOf],
  ['the alpha blend destination', (rig) => (material(rig).blendDstAlpha = THREE.OneFactor), rigOf],
  ['the blend alpha', (rig) => (material(rig).blendAlpha = 0.5), rigOf],
  ['the blend colour', (rig) => material(rig).blendColor.set(1, 0, 0), rigOf],
  ['the premultiplied alpha', (rig) => (material(rig).premultipliedAlpha = true), rigOf],
  ['the depth test', (rig) => (material(rig).depthTest = false), rigOf],
  ['the depth write', (rig) => (material(rig).depthWrite = false), rigOf],
  ['the depth function', (rig) => (material(rig).depthFunc = THREE.AlwaysDepth), rigOf],
  ['the polygon offset', (rig) => (material(rig).polygonOffset = true), rigOf],
  ['the polygon offset factor', (rig) => (material(rig).polygonOffsetFactor = 1), rigOf],
  ['the polygon offset units', (rig) => (material(rig).polygonOffsetUnits = 1), rigOf],
  ['the stencil write', (rig) => (material(rig).stencilWrite = true), rigOf],
  ['the stencil function', (rig) => (material(rig).stencilFunc = THREE.NeverStencilFunc), rigOf],
  ['the stencil reference', (rig) => (material(rig).stencilRef = 1), rigOf],
  ['the stencil function mask', (rig) => (material(rig).stencilFuncMask = 1), rigOf],
  ['the stencil write mask', (rig) => (material(rig).stencilWriteMask = 1), rigOf],
  ['the stencil fail', (rig) => (material(rig).stencilFail = THREE.ZeroStencilOp), rigOf],
  ['the stencil depth fail', (rig) => (material(rig).stencilZFail = THREE.ZeroStencilOp), rigOf],
  ['the stencil pass', (rig) => (material(rig).stencilZPass = THREE.ZeroStencilOp), rigOf],
  ['a number uniform', (rig) => (uniform(rig, 'uEnergy').value = 2), rigOf],
  ['a boolean uniform', (rig) => (uniform(rig, 'uShadowed').value = true), rigOf],
  ['an unset uniform', (rig) => (uniform(rig, 'uUnset').value = 0), rigOf],
  ['a texture uniform', (rig) => (uniform(rig, 'uCookie').value = new THREE.Texture()), rigOf],
  [
    'a texture version',
    (rig) => ((uniform(rig, 'uCookie').value as THREE.Texture).needsUpdate = true),
    rigOf,
  ],
  ['a vector uniform', (rig) => (uniform(rig, 'uOffset').value as THREE.Vector2).set(1, 0), rigOf],
  ['a colour uniform', (rig) => (uniform(rig, 'uColor').value as THREE.Color).set(0, 0, 1), rigOf],
  ['an array uniform', (rig) => (uniform(rig, 'uHeights').value = [1, 5]), rigOf],
  [
    'two arrays that trade an item',
    (rig) => ((uniform(rig, 'uHeights').value = [1]), (uniform(rig, 'uWidths').value = [2, 3])),
    rigOf,
  ],
];

function withMaterial(change: (material: THREE.ShaderMaterial) => void): () => Rig {
  return () => {
    const shader = lightMaterial();
    change(shader);
    return rigOf(lightMesh(shader));
  };
}

function interleavedRig(): Rig {
  const geometry = new THREE.BufferGeometry();
  const buffer = new THREE.InterleavedBuffer(new Float32Array(9), 3);
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  return rigOf(new THREE.Mesh(geometry, lightMaterial()));
}

function morphRig(): Rig {
  const mesh = lightMesh();
  mesh.geometry.morphAttributes.position = [mesh.geometry.getAttribute('position').clone()];
  return rigOf(mesh);
}

/** Each input whose change no number shows, so a mesh that holds one draws every frame. */
const UNREADABLE_INPUTS: ReadonlyArray<readonly [string, () => Rig]> = [
  ['an interleaved attribute', interleavedRig],
  ['morph targets', morphRig],
  ['a material array', () => rigOf(new THREE.Mesh(new THREE.PlaneGeometry(), [lightMaterial()]))],
  [
    'a material that is no ShaderMaterial',
    () => rigOf(lightMesh(new THREE.MeshBasicMaterial({ fog: false }))),
  ],
  ['scene lights', withMaterial((shader) => (shader.lights = true))],
  ['scene fog', withMaterial((shader) => (shader.fog = true))],
  ['clipping', withMaterial((shader) => (shader.clipping = true))],
  ['clipping planes', withMaterial((shader) => (shader.clippingPlanes = [new THREE.Plane()]))],
  ['uniform groups', withMaterial((shader) => (shader.uniformsGroups = [new THREE.UniformsGroup()]))],
  [
    'a render target texture',
    withMaterial((shader) => (shader.uniforms.uCookie!.value = new THREE.WebGLRenderTarget().texture)),
  ],
  ['a uniform of no known kind', withMaterial((shader) => (shader.uniforms.uEnergy!.value = 'bright'))],
  ['a material render hook', withMaterial((shader) => (shader.onBeforeRender = () => {}))],
  ['a mesh render hook', () => rigOf(Object.assign(lightMesh(), { onBeforeRender: () => {} }))],
  ['a mesh after-render hook', () => rigOf(Object.assign(lightMesh(), { onAfterRender: () => {} }))],
  ['instances', () => rigOf(new THREE.InstancedMesh(new THREE.PlaneGeometry(), lightMaterial(), 2))],
  ['bones', () => rigOf(new THREE.SkinnedMesh(new THREE.PlaneGeometry(), lightMaterial()))],
  ['a batch', () => rigOf(new THREE.BatchedMesh(1, 4, 6, lightMaterial()))],
];

describe('LightPassInputs.drawIfChanged', () => {
  it('skips the draw of a frame that reads as the kept frame', () => {
    expect(drawsAfter(rigOf(), () => {})).toBe(false);
  });

  it('keeps nothing after a draw that throws', () => {
    const inputs = new LightPassInputs();
    const { frame } = rigOf();
    expect(() =>
      inputs.drawIfChanged(frame, () => {
        throw new Error('context lost');
      })
    ).toThrow('context lost');
    const draw = vi.fn();
    inputs.drawIfChanged(frame, draw);
    expect(draw).toHaveBeenCalledOnce();
  });

  it.each(KEYED_INPUTS)('draws again after a write to %s', (_input, write, rig) => {
    expect(drawsAfter(rig(), write)).toBe(true);
  });

  it.each(UNREADABLE_INPUTS)('draws every frame for a mesh with %s', (_input, rig) => {
    expect(drawsAfter(rig(), () => {})).toBe(true);
  });
});

describe('LightPassInputs.forget', () => {
  it('makes the next frame draw', () => {
    const inputs = new LightPassInputs();
    const { frame } = rigOf();
    inputs.drawIfChanged(frame, () => {});
    inputs.forget();
    const draw = vi.fn();
    inputs.drawIfChanged(frame, draw);
    expect(draw).toHaveBeenCalledOnce();
  });

  it('leaves a frame with nothing kept to draw', () => {
    const inputs = new LightPassInputs();
    inputs.forget();
    const draw = vi.fn();
    inputs.drawIfChanged(rigOf().frame, draw);
    expect(draw).toHaveBeenCalledOnce();
  });
});
