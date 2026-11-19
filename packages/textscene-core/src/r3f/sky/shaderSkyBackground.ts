import * as THREE from 'three';
import { writeSkyBindings, type SkyLight } from '../../shaders/sky/skyBindings.js';
import { renderedEnvironmentFog } from '../fog/fogFrame.js';
import { bindRadiance, disposeSky, type TranspiledSky } from '../../shaders/sky/transpileSky.js';
import type { SkyLayers } from '../../resources/sky/skyLayers.js';
import { SkyResolutionPasses } from '../../shaders/sky/skyResolutionPasses.js';
import { SkyBackdrop } from './skyBackground.js';
import { writeFramebufferHeight } from '../shadowFilter/framebufferRows.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';
import { renderTargetSize } from '../renderTargetSize.js';
import { skyEnergies } from './skyRadiance.js';

/** Scratch for one conversion, overwritten by each. */
const rotationMatrix = new THREE.Matrix4();

/** Scratch for one render's target size. */
const targetSize = new THREE.Vector2();

/** A transpiled sky behind a scene, which owns the sky's mesh, and reads `lights` in each render. */
export class ShaderSkyBackground extends SkyBackdrop {
  /** The background energy of the render now starting, written only by `paint`. */
  private brightness = 1;
  /** `sky_rotation` as Godot's basis, written only by `paint`. */
  private readonly skyOrientation = new THREE.Matrix3();
  private readonly passes: SkyResolutionPasses;
  /** The border of the radiance octmap, written only by `readRadiance`. 1 reads as no border. */
  private radianceBorder = 1;
  /** What `RADIANCE` reads, written only by `readRadiance`, bound in each render as its array swaps. */
  private radiance: SkyLayers | null = null;

  constructor(
    private readonly sky: TranspiledSky,
    private lights: readonly SkyLight[]
  ) {
    super(sky.mesh.geometry, sky.mesh.material);
    this.name = 'ShaderSkyBackground';
    this.passes = new SkyResolutionPasses(sky);
  }

  /** The lights of the renders from now on. */
  setLights(lights: readonly SkyLight[]): void {
    this.lights = lights;
  }

  /** Reads the sky's own radiance `layers` as `RADIANCE` behind the scene (`sky.cpp:533`). */
  readRadiance(layers: SkyLayers): void {
    this.radiance = layers;
    this.radianceBorder = layers.layout.borderSize;
  }

  protected paint(intensity: number, rotation: THREE.Euler): void {
    this.brightness = intensity;
    this.skyOrientation.setFromMatrix4(rotationMatrix.makeRotationFromEuler(rotation));
  }

  /** The bindings of the camera of each render, as one scene can render through several cameras. */
  override onBeforeRender(renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.radiance) bindRadiance(this.sky, this.radiance.target.texture);
    writeSkyBindings(this.sky, {
      camera,
      skyOrientation: this.skyOrientation,
      time: canvasShaderTime(renderer).time,
      brightness: this.brightness,
      fog: renderedEnvironmentFog(),
      lights: this.lights,
      borderSize: this.radianceBorder,
      radianceEnergy: skyEnergies[0],
    });
    // Godot draws the quarter and half passes before the scene, at the size of its buffers (`sky.cpp:1427`).
    if (this.passes.isEmpty) return;
    this.passes.draw(renderer, camera, renderTargetSize(renderer, targetSize));
    // A pass's render writes its target's height, which the lit surfaces after the sky must not read.
    writeFramebufferHeight(renderer);
  }

  override dispose(): void {
    super.dispose();
    disposeSky(this.sky);
    this.passes.dispose();
  }
}
