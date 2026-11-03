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

/** The texel three's cube background reads for a material with no cube, which the sky replaces. */
const THREE_NO_CUBE_TEXEL = 'vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );';

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
          [{ three: THREE_NO_CUBE_TEXEL, godot: GODOT_SKY_TEXEL }],
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
  }

  /**
   * Draws behind `scene` in the render now starting, at `intensity` and turned by `rotation`, unless
   * the scene shows a background of its own, as an interior probe's capture does (`captureStage.ts`).
   * `showSkyBackground` takes it out once the render ends. It is in the scene only in a render, so
   * no traversal between renders, such as a pick or a bounds fit, meets it.
   */
  drawIn(scene: THREE.Scene, intensity: number, rotation: THREE.Euler): void {
    if (scene.background !== null) return;
    const { uniforms } = this.material;
    uniforms.backgroundIntensity!.value = intensity;
    worldToSky(rotation, uniforms.backgroundRotation!.value as THREE.Matrix3);
    scene.add(this);
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
 * Clears `scene`'s own background so a `SkyBackground` draws, and takes the one each render drew out
 * of the scene when the render ends, until the returned disposer puts the background back.
 */
export function showSkyBackground(scene: THREE.Scene): () => void {
  const previousBackground = scene.background;
  scene.background = null;
  const stopRemoving = observeSceneRenderEnd(scene, () => removeSkyBackground(scene));
  return () => {
    stopRemoving();
    // A render that threw never reached its end, which takes the sky out.
    removeSkyBackground(scene);
    scene.background = previousBackground;
  };
}

function removeSkyBackground(scene: THREE.Scene): void {
  // Backwards, as each removal shifts the children after it.
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const child = scene.children[i]!;
    if (child instanceof SkyBackground) scene.remove(child);
  }
}
