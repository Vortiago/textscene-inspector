/**
 * Godot's sky background: the sky shader runs at each pixel of the view, on the ray the pixel casts
 * (`sky.cpp:1463-1524`, `sky.glsl:217-223`), with no cube between the shader and the screen. It
 * draws through three's cube background program with the sky in place of the cube's texel, so the
 * sky projection, the sky fog, the debanding and the tone curve that patch that program hold for it.
 */

import * as THREE from 'three';
import { editedShader } from '../shaderPatch/chunkPatch.js';
import { backgroundCube } from '../shaderPatch/backgroundPrograms.js';

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

/** Scratch for one rotation: the render hooks never interleave. */
const rotationMatrix = new THREE.Matrix4();

/**
 * A sky drawn at each pixel behind a scene. `skyGlsl` declares the sky's uniforms and defines
 * `vec3 godotSky(vec3 eyedir)`, and `skyUniforms` holds their values. `dispose` frees what the
 * sky owns, and `onDispose` frees what its uniforms read, such as the panorama.
 */
export class SkyBackground extends THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial> {
  readonly isSkyBackground = true;

  constructor(
    skyGlsl: string,
    skyUniforms: Record<string, THREE.IUniform>,
    private readonly onDispose: () => void
  ) {
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
   * `removeSkyBackground` takes it out once the render ends.
   */
  drawIn(scene: THREE.Scene, intensity: number, rotation: THREE.Euler): void {
    if (scene.background !== null) return;
    const { uniforms } = this.material;
    uniforms.backgroundIntensity!.value = intensity;
    (uniforms.backgroundRotation!.value as THREE.Matrix3)
      .setFromMatrix4(rotationMatrix.makeRotationFromEuler(rotation))
      .transpose();
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
    this.onDispose();
    super.dispose();
  }
}

/** Takes the sky background a render of `scene` drew out of it, so no pass outside a render sees it. */
export function removeSkyBackground(scene: THREE.Scene): void {
  for (const child of [...scene.children]) {
    if ((child as Partial<SkyBackground>).isSkyBackground) scene.remove(child);
  }
}
