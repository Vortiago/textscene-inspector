import * as THREE from 'three';
import { writeSkyBindings, type SkyLight } from '../../shaders/sky/skyBindings.js';
import { disposeSky, type TranspiledSky } from '../../shaders/sky/transpileSky.js';
import { SkyResolutionPasses } from '../../shaders/sky/skyResolutionPasses.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';

/** Godot's octmap pass views from the origin with no rotation (`sky.cpp:1275-1281`, `:1330`). */
const octmapCamera = new THREE.PerspectiveCamera(90, 1, 0.01, 10);

/** A sky's octmap pass, drawn straight into the radiance as Godot's `SKY_VERSION_OCTMAP` is. */
export class ShaderSkyOctmap {
  private readonly scene = new THREE.Scene();
  private readonly passes: SkyResolutionPasses;
  /** Scratch for one draw's octmap size. */
  private readonly size = new THREE.Vector2();

  constructor(
    private readonly sky: TranspiledSky,
    private readonly lights: readonly SkyLight[]
  ) {
    this.scene.add(sky.mesh);
    this.passes = new SkyResolutionPasses(sky);
  }

  /** Draws the sky over `target`, an octmap whose border size is `borderSize`. */
  draw(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, borderSize: number): void {
    writeSkyBindings(this.sky, {
      camera: octmapCamera,
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

  dispose(): void {
    disposeSky(this.sky);
    this.passes.dispose();
  }
}
