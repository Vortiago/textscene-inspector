import * as THREE from 'three';
import {
  createFirstOpaqueSentinel,
  createLastOpaqueSentinel,
  type OpaqueSentinel,
} from './opaqueSentinel.js';
import { drawSurface, visibleSurfaces, type Surface } from './opaqueSurfaces.js';
import {
  DEPTH_PREPASS_DISABLED_VENDORS,
  vendorDisablesDepthPrepass,
} from '../../godot/rendering/depthPrepassVendors.js';
import { rendererOf, type Renderer, type RenderingMethod } from '../preprocessor/renderingMethod.js';
import { glRendererName } from './glRendererName.js';

/** How the prepass draws one surface material. */
export interface PrepassDraw {
  /** The material the prepass draws the surface with: its own, or the shared default material. */
  readonly material: THREE.Material;
  /** Sets a per-pass value, such as the opaque prepass threshold, for the prepass draw only. */
  readonly around?: (draw: () => void) => void;
}

/** The prepass draw of a material, or null when the prepass skips its surfaces. */
export type PrepassDrawOf = (material: THREE.Material) => PrepassDraw | null;

/** Written only by `setPrepassDraw`. An entry goes with its material. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const prepassDraws = new WeakMap<THREE.Material, PrepassDraw | null>();

/** Sets how the prepass draws `material`'s surfaces: null keeps them out of the prepass. */
export function setPrepassDraw(material: THREE.Material, draw: PrepassDraw | null): void {
  prepassDraws.set(material, draw);
}

/** The draw its maker set, else `unset`'s. */
export function prepassDrawOf(
  material: THREE.Material,
  unset: PrepassDrawOf = ownProgramDraw
): PrepassDraw | null {
  return prepassDraws.has(material) ? prepassDraws.get(material)! : unset(material);
}

/** Its own program with no colour. Godot draws a sky, an overlay and a refraction in no prepass. */
export function ownProgramDraw(material: THREE.Material): PrepassDraw | null {
  const { depthFunc, depthWrite } = colourDepthOf(material);
  const isRefracting = ((material as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0;
  if (material.transparent || !material.depthTest || !depthWrite || isRefracting) return null;
  const keepsNearest = depthFunc === THREE.LessEqualDepth || depthFunc === THREE.LessDepth;
  return keepsNearest ? { material, around: asDepthOnly(material) } : null;
}

/** Draws with `material`'s own depth state and no colour, then gives back the state it found. */
function asDepthOnly(material: THREE.Material): (draw: () => void) => void {
  return (draw) => {
    const found = { colorWrite: material.colorWrite, ...colourDepthNow(material) };
    Object.assign(material, { colorWrite: false, ...colourDepthOf(material) });
    try {
      draw();
    } finally {
      Object.assign(material, found);
    }
  };
}

/** Which renderer draws the prepass, and what it draws after one. */
export interface DepthPrepassOptions {
  /** The project's `rendering/renderer/rendering_method`, `forward_plus` when left out. */
  readonly renderingMethod?: RenderingMethod;
  /** `rendering/driver/depth_prepass/disable_for_vendors`, Godot's default when left out. */
  readonly disabledVendors?: string;
  /** The prepass draw of a material whose maker set none, `ownProgramDraw` when left out. */
  readonly unset?: PrepassDrawOf;
  /** Runs the prepass's draws, so a caller can time them. */
  readonly timed?: (renderer: THREE.WebGLRenderer, draw: () => void) => void;
}

/** The opaque colour pass's depth test after `renderer`'s prepass, or null where it draws none. */
function colourDepthFuncAfter(
  renderer: Renderer,
  webgl: THREE.WebGLRenderer,
  disabledVendors: string
): THREE.DepthModes | null {
  if (renderer === 'forward_plus') return THREE.EqualDepth;
  if (renderer === 'mobile' || vendorDisablesDepthPrepass(glRendererOf(webgl), disabledVendors)) return null;
  // GEQUAL with no depth write (`rasterizer_scene_gles3.cpp:3161-3168`), turned round for GL's depth.
  return THREE.LessEqualDepth;
}

/** Written only by `glRendererOf`. An entry goes with its renderer. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const glRenderers = new WeakMap<THREE.WebGLRenderer, string>();

function glRendererOf(webgl: THREE.WebGLRenderer): string {
  let name = glRenderers.get(webgl);
  if (name === undefined) {
    name = glRendererName(webgl.getContext() as WebGL2RenderingContext) ?? '';
    glRenderers.set(webgl, name);
  }
  return name;
}

/** The two sentinels of a scene's prepass: the first draws it, the last ends the colour pass's state. */
export interface DepthPrepass {
  readonly first: OpaqueSentinel;
  readonly last: OpaqueSentinel;
}

/** The depth state of an opaque material's colour pass. */
interface ColourDepth {
  readonly depthFunc: THREE.DepthModes;
  readonly depthWrite: boolean;
}

/** Written only by `testAgainstPrepass`, and emptied by the prepass that wrote an entry, at its end. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const depthBeforePrepass = new WeakMap<THREE.Material, ColourDepth>();

const colourDepthNow = ({ depthFunc, depthWrite }: THREE.Material): ColourDepth => ({
  depthFunc,
  depthWrite,
});

/** Its own depth state, also inside a render nested in one whose prepass has changed it. */
const colourDepthOf = (material: THREE.Material): ColourDepth =>
  depthBeforePrepass.get(material) ?? colourDepthNow(material);

/** A prepass to add to a scene, both sentinels together. */
export function createDepthPrepass({
  renderingMethod = 'forward_plus',
  disabledVendors = DEPTH_PREPASS_DISABLED_VENDORS,
  unset = ownProgramDraw,
  timed = (_renderer, draw) => draw(),
}: DepthPrepassOptions = {}): DepthPrepass {
  const renderer = rendererOf(renderingMethod);
  // Written by the first sentinel and emptied by the last, inside one render.
  const changed: THREE.Material[] = [];
  const first = createFirstOpaqueSentinel('DepthPrepass', (webgl, scene, camera) => {
    const colourDepthFunc = colourDepthFuncAfter(renderer, webgl, disabledVendors);
    if (colourDepthFunc === null) return;
    timed(webgl, () => {
      const draws = new Map<THREE.Material, PrepassDraw | null>();
      const drawOf = (material: THREE.Material): PrepassDraw | null => {
        if (!draws.has(material))
          draws.set(material, material.visible ? prepassDrawOf(material, unset) : null);
        return draws.get(material)!;
      };
      const surfaces = visibleSurfaces(scene, camera, (material) => drawOf(material) !== null);
      for (const surface of surfaces) drawPrepass(webgl, scene, camera, surface, drawOf(surface.material)!);
      for (const { material } of surfaces)
        if (!material.transparent) testAgainstPrepass(material, colourDepthFunc, changed);
    });
  });
  const last = createLastOpaqueSentinel('DepthPrepassEnd', () => restoreColourDepth(changed));
  return { first, last };
}

function drawPrepass(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  surface: Surface,
  { material, around = (draw: () => void) => draw() }: PrepassDraw
): void {
  around(() => drawSurface(renderer, scene, camera, surface, material));
}

/** The colour pass tests the prepass's depth and writes none (`scene_shader_forward_clustered.cpp:448`). */
function testAgainstPrepass(
  material: THREE.Material,
  depthFunc: THREE.DepthModes,
  changed: THREE.Material[]
): void {
  if (depthBeforePrepass.has(material)) return;
  depthBeforePrepass.set(material, colourDepthNow(material));
  changed.push(material);
  Object.assign(material, { depthFunc, depthWrite: false });
}

function restoreColourDepth(changed: THREE.Material[]): void {
  for (const material of changed) {
    Object.assign(material, depthBeforePrepass.get(material));
    depthBeforePrepass.delete(material);
  }
  changed.length = 0;
}
