import * as THREE from 'three';
import { writeSkyBindings, type SkyFog, type SkyLight } from '../../shaders/sky/skyBindings.js';
import { fogUniforms } from '../fog/fogUniforms.js';
import type { TranspiledSky } from '../../shaders/sky/transpileSky.js';
import { SkyBackdrop } from './skyBackground.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';

/** Scratch for one conversion, overwritten by each. */
const rotationMatrix = new THREE.Matrix4();

/** Scratch for one render's fog colour, which the fog's energy has scaled. */
const renderedFogColor = new THREE.Color();

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
      fog: this.fog(),
      lights: this.lights,
    });
  }

  /** The depth fog of the render now drawing, which `prepareFog` wrote, or none while it is off. */
  protected fog(): SkyFog | undefined {
    const { depthColor, depthShape, depthLayer, depthSky } = fogUniforms;
    if (depthColor[3] === 0) return undefined;
    renderedFogColor.setRGB(depthColor[0]!, depthColor[1]!, depthColor[2]!);
    return {
      lightColor: renderedFogColor,
      lightEnergy: 1,
      sunScatter: depthSky[1]!,
      skyAffect: depthSky[0]!,
      aerialPerspective: depthLayer[3]!,
      density: depthShape[0]!,
    };
  }
}

/** The sky as the radiance bake renders it, with no fog (`sky.glsl:282`). */
export class ShaderSkyCube extends ShaderSkyBackground {
  protected override fog(): undefined {
    return undefined;
  }
}
