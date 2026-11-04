/**
 * Godot's sky background: the sky shader runs at each pixel of the view, on the ray the pixel casts
 * (`sky.cpp:1463-1524`, `sky.glsl:217-223`), with no cube between the shader and the screen. It
 * draws through three's cube background program with the sky in place of the cube's texel, so the
 * sky projection, the sky fog, the debanding and the tone curve that patch that program hold for it.
 */

import * as THREE from 'three';
import { editedShader } from '../shaderPatch/chunkPatch.js';
import { backgroundCube } from '../shaderPatch/backgroundPrograms.js';
import { observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { worldToSky } from './skyRotation.js';

/**
 * The texel three's cube background reads from a cube that is not a PMREM, which the sky replaces.
 * The material defines no `ENVMAP_TYPE_PMREM`, so this is the line it compiles.
 */
const THREE_CUBE_TEXEL = 'vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );';

/** The sky at the pixel's ray, turned by the sky's orientation as three turns its cube. */
const GODOT_SKY_TEXEL =
  'vec4 texColor = vec4( godotSky( normalize( backgroundRotation * vWorldDirection ) ), 1.0 );';

/**
 * After every opaque surface, as Godot draws the sky after its opaque pass
 * (`render_forward_clustered.cpp:2266`). It tests depth at the far plane as Godot's sky pipeline
 * does (`sky.cpp:142-144`), so it shows only where no surface drew.
 */
const SKY_RENDER_ORDER = Number.MAX_SAFE_INTEGER;

/**
 * A sky drawn at each pixel behind a scene. `skyGlsl` declares the sky's uniforms and defines
 * `vec3 godotSky(vec3 eyedir)`, and `skyUniforms` holds their values, which the caller owns. It
 * reads three's cube background program as `installShaderPatches` left it.
 */
export class SkyBackground extends THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial> {
  constructor(skyGlsl: string, skyUniforms: Record<string, THREE.IUniform>) {
    const program = backgroundCube();
    super(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.ShaderMaterial({
        name: 'SkyBackgroundMaterial',
        uniforms: { ...THREE.UniformsUtils.clone(program.uniforms), ...skyUniforms },
        vertexShader: program.vertexShader,
        fragmentShader: `${skyGlsl}\n${editedShader(
          program.fragmentShader,
          [{ three: THREE_CUBE_TEXEL, godot: GODOT_SKY_TEXEL }],
          'backgroundCube_frag'
        )}`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        allowOverride: false,
      })
    );
    this.name = 'SkyBackground';
    this.renderOrder = SKY_RENDER_ORDER;
    this.frustumCulled = false;
    this.matrixAutoUpdate = false;
    this.matrixWorldAutoUpdate = false;
    this.layers.enableAll();
    this.raycast = () => {};
    this.userData = { tscnFrameExcluded: true };
    this.visible = false;
  }

  /**
   * Draws behind `scene` in the render now starting, at `intensity` and turned by `rotation`, unless
   * the scene shows a background of its own, as an interior probe's capture does (`captureStage.ts`).
   * `showSkyBackground` hides it once the render ends. It stays a child of the scene it drew in, so
   * the trackers of the scene's children see it arrive once and not in every render.
   */
  drawIn(scene: THREE.Scene, intensity: number, rotation: THREE.Euler): void {
    if (scene.background !== null) return;
    const { uniforms } = this.material;
    uniforms.backgroundIntensity!.value = intensity;
    worldToSky(rotation, uniforms.backgroundRotation!.value as THREE.Matrix3);
    if (this.parent !== scene) scene.add(this);
    this.visible = true;
  }

  /** The box follows the camera, as three's cube background does (`WebGLBackground.js`). */
  override onBeforeRender(_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera): void {
    this.matrixWorld.copyPosition(camera.matrixWorld);
  }

  override dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    super.dispose();
  }
}

/**
 * Clears `scene`'s own background so a `SkyBackground` draws, and hides the one each render drew
 * when the render ends, so no pass outside a render draws it. The returned disposer takes every
 * sky out of the scene and puts the background back.
 */
export function showSkyBackground(scene: THREE.Scene): () => void {
  const previousBackground = scene.background;
  scene.background = null;
  const stopHiding = observeSceneRenderEnd(scene, () => hideSkyBackgrounds(scene));
  return () => {
    stopHiding();
    removeSkyBackgrounds(scene);
    scene.background = previousBackground;
  };
}

function hideSkyBackgrounds(scene: THREE.Scene): void {
  for (const child of scene.children) {
    if (child instanceof SkyBackground) child.visible = false;
  }
}

function removeSkyBackgrounds(scene: THREE.Scene): void {
  // Backwards, as each removal shifts the children after it.
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const child = scene.children[i]!;
    if (child instanceof SkyBackground) scene.remove(child);
  }
}
