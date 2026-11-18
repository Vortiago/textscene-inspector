import * as THREE from 'three';
import { writeSkyBindings, type SkyLight } from '../../shaders/sky/skyBindings.js';
import { disposeSky, type TranspiledSky } from '../../shaders/sky/transpileSky.js';
import { SkyResolutionPasses, type SkyPassResolution } from '../../shaders/sky/skyResolutionPasses.js';
import type { Vector3 } from '../../godot/math/vector.js';
import { copyRadianceMip, type SkyLayers } from '../../resources/sky/skyLayers.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';

/** Godot's octmap pass views from the origin with no rotation (`sky.cpp:1275-1281`, `:1330`). */
const octmapCamera = new THREE.PerspectiveCamera(90, 1, 0.01, 10);

/** A sky's octmap pass. Its half and quarter targets are the octmap's mips 1 and 2 (`sky.cpp:1284`). */
export class ShaderSkyOctmap {
  private readonly scene = new THREE.Scene();
  private readonly passes: SkyResolutionPasses;
  /** Scratch for one draw's octmap size. */
  private readonly size = new THREE.Vector2();

  constructor(
    private readonly sky: TranspiledSky,
    private readonly lights: readonly SkyLight[],
    colorsRead: readonly SkyPassResolution[]
  ) {
    this.scene.add(sky.mesh);
    this.passes = new SkyResolutionPasses(sky, colorsRead);
  }

  /** Draws the sky over `target` at the renderer's `TIME`, with `POSITION` at the camera's `position`. */
  draw(
    gl: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget,
    borderSize: number,
    position: Readonly<Vector3>
  ): void {
    writeSkyBindings(this.sky, {
      camera: octmapCamera,
      position,
      time: canvasShaderTime(gl).time,
      brightness: 1,
      lights: this.lights,
      borderSize,
    });
    // The quarter and half passes draw into mips 2 and 1 of the octmap first (`sky.cpp:1284-1320`).
    this.passes.draw(gl, octmapCamera, this.size.set(target.width, target.height));
    gl.setRenderTarget(target);
    gl.render(this.scene, octmapCamera);
  }

  /** Leaves mips 1 and 2 of the radiance `layers` in the targets the next bake reads (`sky.cpp:545-575`). */
  keepRadianceMips(gl: THREE.WebGLRenderer, layers: SkyLayers): void {
    this.passes.forEachUndrawnTarget((target, mip) => copyRadianceMip(gl, layers, mip, target));
  }

  dispose(): void {
    disposeSky(this.sky);
    this.passes.dispose();
  }
}
