import * as THREE from 'three';
import type { SkyDraw, TranspiledSky } from './transpileSky.js';

type Resolution = 'half' | 'quarter';

/** Godot sizes the passes from a screen of at least 4 by 4 (`sky.cpp:996-997`). */
const MIN_SCREEN = 4;

/** Each pass's size as a power of two under the target's (`sky.cpp:1433`, `:1449`). */
const SHIFTS: Readonly<Record<Resolution, number>> = { half: 1, quarter: 2 };

/** Godot's half and quarter resolution passes of a sky: targets, order and reads (`sky.cpp:525-578`). */
export class SkyResolutionPasses {
  /** Written only by the constructor, and resized by `draw`. Freed by `dispose`. */
  private readonly targets: Partial<Record<Resolution, THREE.WebGLRenderTarget>> = {};
  private readonly scene = new THREE.Scene();

  constructor(private readonly sky: TranspiledSky) {
    for (const resolution of ['half', 'quarter'] as const)
      if (sky[resolution]) this.targets[resolution] = passTarget();
    this.bindTargets();
  }

  /** Whether the sky draws any pass of its own before its full one. */
  get isEmpty(): boolean {
    return !this.targets.half && !this.targets.quarter;
  }

  /** Draws the quarter pass, then the half pass (`sky.cpp:1427-1457`), and keeps the render target. */
  draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera, size: THREE.Vector2): void {
    const previous = renderer.getRenderTarget();
    for (const resolution of ['quarter', 'half'] as const) {
      const target = this.targets[resolution];
      const pass = this.sky[resolution];
      if (target && pass) this.drawPass(renderer, camera, pass, target, size, SHIFTS[resolution]);
    }
    renderer.setRenderTarget(previous);
  }

  dispose(): void {
    for (const target of Object.values(this.targets)) target.dispose();
  }

  private drawPass(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    pass: SkyDraw,
    target: THREE.WebGLRenderTarget,
    size: THREE.Vector2,
    shift: number
  ): void {
    target.setSize(Math.max(size.x, MIN_SCREEN) >> shift, Math.max(size.y, MIN_SCREEN) >> shift);
    this.scene.add(pass.mesh);
    renderer.setRenderTarget(target);
    renderer.render(this.scene, camera);
    this.scene.remove(pass.mesh);
  }

  /** A pass reads no target of its own resolution, as Godot binds a default there (`sky.cpp:552`, `:572`). */
  private bindTargets(): void {
    const { half, quarter } = this.targets;
    for (const [pass, ownTarget] of [
      [this.sky, undefined],
      [this.sky.half, 'half_res'],
      [this.sky.quarter, 'quarter_res'],
    ] as const) {
      if (!pass) continue;
      if (half && ownTarget !== 'half_res') bind(pass, 'half_res', half.texture);
      if (quarter && ownTarget !== 'quarter_res') bind(pass, 'quarter_res', quarter.texture);
    }
  }
}

function bind(pass: SkyDraw, name: string, texture: THREE.Texture): void {
  const node = pass.textures.get(name);
  if (node) node.value = texture;
}

/** Godot's sky texture format, RGBA16F (`sky.cpp:921`), read with a linear clamp sampler (`sky.glsl:255`). */
function passTarget(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
  });
}
