import * as THREE from 'three';
import { skyDraws, type SkyDraw, type TranspiledSky } from './transpileSky.js';

export type SkyPassResolution = 'half' | 'quarter';

/** Godot sizes the passes from a screen of at least 4 by 4 (`sky.cpp:996-997`). */
const MIN_SCREEN = 4;

/** Each pass in draw order, its size as a power of two under the target's (`sky.cpp:1433`, `:1449`). */
const PASSES = [
  { resolution: 'quarter', shift: 2, texture: 'quarter_res' },
  { resolution: 'half', shift: 1, texture: 'half_res' },
] as const satisfies readonly { resolution: SkyPassResolution; shift: number; texture: string }[];

/** Godot's half and quarter passes (`sky.cpp:525-578`), with a target for each pass and each colour read. */
export class SkyResolutionPasses {
  /** Written only by the constructor, and resized by `draw`. Freed by `dispose`. */
  private readonly targets: Partial<Record<SkyPassResolution, THREE.WebGLRenderTarget>> = {};
  private readonly scene = new THREE.Scene();

  /** `colorsRead` are the sizes a draw reads with no pass of its own: an octmap pass reads radiance mips. */
  constructor(
    private readonly sky: TranspiledSky,
    colorsRead: readonly SkyPassResolution[] = []
  ) {
    for (const { resolution } of PASSES)
      if (sky[resolution] || colorsRead.includes(resolution)) this.targets[resolution] = passTarget();
    this.bindTargets();
  }

  /** Whether the sky draws any pass of its own before its full one. */
  get isEmpty(): boolean {
    return !this.sky.half && !this.sky.quarter;
  }

  /** Each target, with its size as the radiance mip it stands for in an octmap pass: half is mip 1. */
  forEachTarget(visit: (target: THREE.WebGLRenderTarget, mip: number) => void): void {
    for (const { resolution, shift } of PASSES) {
      const target = this.targets[resolution];
      if (target) visit(target, shift);
    }
  }

  /** Draws the quarter pass, then the half pass (`sky.cpp:1427-1457`), and keeps the render target. */
  draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera, size: THREE.Vector2): void {
    const previous = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace();
    const level = renderer.getActiveMipmapLevel();
    for (const pass of PASSES) this.drawPass(renderer, camera, size, pass);
    renderer.setRenderTarget(previous, face, level);
  }

  dispose(): void {
    for (const target of Object.values(this.targets)) target.dispose();
  }

  /** Sizes the target of `resolution`, then draws the sky's pass into it, when the sky has that pass. */
  private drawPass(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    size: THREE.Vector2,
    { resolution, shift }: (typeof PASSES)[number]
  ): void {
    const target = this.targets[resolution];
    if (!target) return;
    target.setSize(Math.max(size.x, MIN_SCREEN) >> shift, Math.max(size.y, MIN_SCREEN) >> shift);
    const pass = this.sky[resolution];
    if (!pass) return;
    this.scene.add(pass.mesh);
    renderer.setRenderTarget(target);
    renderer.render(this.scene, camera);
    this.scene.remove(pass.mesh);
  }

  /** A pass reads no target of its own resolution, as Godot binds a default there (`sky.cpp:552`, `:572`). */
  private bindTargets(): void {
    for (const draw of skyDraws(this.sky))
      for (const { resolution, texture } of PASSES) {
        const target = this.targets[resolution];
        if (target && draw !== this.sky[resolution]) bind(draw, texture, target.texture);
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
