import * as THREE from 'three';
import { writeSkyBindings, type SkyLight } from '../../shaders/sky/skyBindings.js';
import type { TranspiledSky } from '../../shaders/sky/transpileSky.js';
import { SkyBackdrop } from './skyBackground.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';

/** Scratch for one conversion, overwritten by each. */
const rotationMatrix = new THREE.Matrix4();

/** A transpiled sky behind a scene, which owns the sky's mesh, and reads `lights` in each render. */
export class ShaderSkyBackground extends SkyBackdrop {
  /** The background energy of the render now starting, written only by `paint`. */
  private brightness = 1;
  /** `sky_rotation` as Godot's basis, written only by `paint`. */
  private readonly skyOrientation = new THREE.Matrix3();

  constructor(
    private readonly sky: TranspiledSky,
    private readonly lights: readonly SkyLight[]
  ) {
    super(sky.mesh.geometry, sky.mesh.material);
    this.name = 'ShaderSkyBackground';
  }

  protected paint(intensity: number, rotation: THREE.Euler): void {
    this.brightness = intensity;
    this.skyOrientation.setFromMatrix4(rotationMatrix.makeRotationFromEuler(rotation));
  }

  /** The bindings of the camera of each render, as one scene can render through several cameras. */
  override onBeforeRender(renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera): void {
    writeSkyBindings(this.sky, {
      camera,
      skyOrientation: this.skyOrientation,
      time: canvasShaderTime(renderer).time,
      brightness: this.brightness,
      lights: this.lights,
    });
  }
}
