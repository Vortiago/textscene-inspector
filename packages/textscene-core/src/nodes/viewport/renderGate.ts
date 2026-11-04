/**
 * Which offscreen viewport passes render in a frame, and what each render clears. It follows
 * `RendererViewport::draw_viewports`: a viewport renders by its update mode (`renderer_viewport.cpp:769-813`),
 * and a render clears by its clear mode (`:373-378`).
 */
import * as THREE from 'three';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../godot/scene/viewport';

/** One pass as the gate sees it. */
export interface GatedPass {
  id: string;
  /** The effective mode: a SubViewportContainer parent has already replaced the authored one. */
  updateMode: number;
  /** The viewport this pass sits in, null for the root viewport. */
  enclosingId: string | null;
  /** Whether the target has rendered since it was made. */
  hasRendered: boolean;
}

/** What the gate knows of a frame beyond its passes. */
export interface GateFrame {
  /**
   * Frames since the scene load completed, 0 before. Frame 1 is the first frame after the load,
   * where a ONCE viewport renders.
   */
  index: number;
  /** The passes whose target was sampled since their last render. */
  sampledIds: ReadonlySet<string>;
}

/**
 * The ids that render in `frame`. A viewport without a pass in `passes` renders, as the root does,
 * so a WHEN_PARENT_VISIBLE pass under it renders too.
 */
export function renderingPassIds(passes: readonly GatedPass[], frame: GateFrame): ReadonlySet<string> {
  const byId = new Map(passes.map((pass) => [pass.id, pass]));
  const rendering = new Map<string, boolean>();

  function renders(pass: GatedPass): boolean {
    const known = rendering.get(pass.id);
    if (known !== undefined) return known;
    const result = rendersByMode(pass);
    rendering.set(pass.id, result);
    return result;
  }

  function rendersByMode(pass: GatedPass): boolean {
    switch (pass.updateMode) {
      case SubViewportUpdateMode.DISABLED:
        return false;
      case SubViewportUpdateMode.ONCE:
        return frame.index >= 1 && !pass.hasRendered;
      case SubViewportUpdateMode.WHEN_VISIBLE:
        return frame.sampledIds.has(pass.id);
      case SubViewportUpdateMode.WHEN_PARENT_VISIBLE: {
        const enclosing = pass.enclosingId === null ? undefined : byId.get(pass.enclosingId);
        return enclosing === undefined || renders(enclosing);
      }
      default:
        return true;
    }
  }

  return new Set(passes.filter(renders).map((pass) => pass.id));
}

/** The clear one render makes. */
export interface RenderClear {
  /** Whether the render clears its target first. */
  clears: boolean;
  /**
   * The colour a clear writes, and the colour a 3D render paints its background with. A render
   * that does not clear paints the colour of the last clear, or opaque black where there was none:
   * the target's clear colour is only set by a clear (`texture_storage.h:446`, `color.h:251-252`).
   */
  color: THREE.Color;
}

/** The colour of a target no clear has touched. */
export const BLACK = new THREE.Color(0, 0, 0);

/**
 * The renders one target has had, which its clear mode and a ONCE update mode count. Written only
 * by `takeRender`. A new target makes a new state, as Godot's new target starts at (0, 0, 0, 0)
 * with its ONCE pending.
 */
export class TargetRenderState {
  private renders = 0;
  private lastClearColor: THREE.Color | null = null;

  get hasRendered(): boolean {
    return this.renders > 0;
  }

  /** Counts a render under `clearMode` and answers what it clears. `projectClearColor` is linear. */
  takeRender(clearMode: number, projectClearColor: THREE.Color): RenderClear {
    const clears =
      clearMode === SubViewportClearMode.ALWAYS ||
      (clearMode === SubViewportClearMode.ONCE && this.renders === 0);
    this.renders++;
    if (clears) (this.lastClearColor ??= new THREE.Color()).copy(projectClearColor);
    return { clears, color: this.lastClearColor ?? BLACK };
  }

  /** Forgets every render: a new parse of the scene makes new viewports. */
  restart(): void {
    this.renders = 0;
    this.lastClearColor = null;
  }
}

/**
 * The frame count and the sampled marks of the passes one orchestrator drives. Written only by the
 * orchestrator's frame.
 */
export class GateClock {
  private index = 0;
  private readonly sampled = new Set<string>();

  /** Starts a frame. The count runs only while the scene is loaded, so frame 1 follows the load. */
  begin(isLoaded: boolean): GateFrame {
    if (isLoaded) this.index++;
    return { index: this.index, sampledIds: this.sampled };
  }

  /** Spends the mark of a pass that rendered: its target must be sampled again to render again. */
  spend(id: string): void {
    this.sampled.delete(id);
  }

  /** Marks a target a consumer samples in the frame that ends. Godot marks none before frame 1. */
  mark(id: string): void {
    if (this.index >= 1) this.sampled.add(id);
  }

  /** Forgets the marks of passes that are gone, so a mark never outlives its pass. */
  prune(isRegistered: (id: string) => boolean): void {
    for (const id of this.sampled) if (!isRegistered(id)) this.sampled.delete(id);
  }

  restart(): void {
    this.index = 0;
    this.sampled.clear();
  }
}
