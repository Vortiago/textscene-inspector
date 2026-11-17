import * as THREE from 'three';
import { writeSkyBindings, type SkyLight } from '../../shaders/sky/skyBindings.js';
import type { TranspiledSky } from '../../shaders/sky/transpileSky.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';

/** Godot's octmap pass views from the origin with no rotation (`sky.cpp:1275-1281`, `:1330`). */
const octmapCamera = new THREE.PerspectiveCamera(90, 1, 0.01, 10);

/** A sky's octmap pass, drawn straight into the radiance as Godot's `SKY_VERSION_OCTMAP` is. */
export class ShaderSkyOctmap {
  private readonly scene = new THREE.Scene();

  constructor(
    private readonly sky: TranspiledSky,
    private readonly lights: readonly SkyLight[]
  ) {
    this.scene.add(sky.mesh);
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
    gl.setRenderTarget(target);
    gl.render(this.scene, octmapCamera);
  }

  dispose(): void {
    this.sky.mesh.geometry.dispose();
    this.sky.mesh.material.dispose();
  }
}
