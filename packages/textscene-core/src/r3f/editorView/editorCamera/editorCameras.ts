import type { NodeHandle } from '../../../scene/nodeHandle.js';
import { nodeNotFound } from '../../../scene/nodeHandle.js';
import type { CallResult } from '../../../scene/nodeMethods.js';
import type { SceneValue } from '../../../scene/variant.js';
import type { ViewportMode } from '../../viewportMode.js';
import * as logger from '../../../logger.js';

/** What a mounted stage does to its camera. The node waits for one, as the stage loads on demand. */
export interface EditorCameraBacking {
  get(property: string): SceneValue | null;
  set(property: string, value: SceneValue): boolean;
  call(method: string, args: readonly SceneValue[]): CallResult;
  /** The view keeps it while the stage is unmounted, and gives it to the next stage of the mode. */
  pose(): unknown;
  setPose(pose: unknown): void;
  /** The scene the stage draws now: a pose returns to its own scene alone (editor_node.cpp:4816). */
  scene(): string;
}

export type EditorCameraType = 'Camera3D' | 'Camera2D';

/** One camera node, and the seat its mode's stage fills while it is mounted. */
export interface EditorCameraSlot {
  readonly node: NodeHandle;
  /** Returns the removal: a newer stage may bind before the old one unmounts. */
  bind(backing: EditorCameraBacking): () => void;
}

export interface EditorCameras {
  /** Null in the In-game mode, which draws through the game's own camera. */
  of(mode: ViewportMode): NodeHandle | null;
  slot(type: EditorCameraType): EditorCameraSlot;
  /** Every read and write after this rejects with `reason`. */
  end(reason: Error): void;
  hasEnded(): boolean;
}

export function createEditorCameras(): EditorCameras {
  let ended: Error | null = null;
  const isEnded = () => ended;
  const slots = {
    Camera3D: createSlot('Camera3D', isEnded),
    Camera2D: createSlot('Camera2D', isEnded),
  };
  return {
    of: (mode) => (mode === 'in-game' ? null : slots[mode === '3D' ? 'Camera3D' : 'Camera2D'].node),
    slot: (type) => slots[type],
    end(reason) {
      ended = reason;
      slots.Camera3D.end(reason);
      slots.Camera2D.end(reason);
    },
    hasEnded: () => ended !== null,
  };
}

function createSlot(
  type: EditorCameraType,
  ended: () => Error | null
): EditorCameraSlot & { end(reason: Error): void } {
  let bound: EditorCameraBacking | null = null;
  // Godot's viewport keeps its camera through a switch to the 2D editor and back.
  let kept: { scene: string; pose: unknown } | null = null;
  let waiters: { resolve(backing: EditorCameraBacking): void; reject(reason: Error): void }[] = [];

  function mounted(): Promise<EditorCameraBacking> {
    const reason = ended();
    if (reason) return Promise.reject(reason);
    if (bound) return Promise.resolve(bound);
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  }

  const name = `@Editor${type}`;
  const path = `/root/${name}`;
  const node: NodeHandle = {
    path,
    name,
    type,
    getNode(relative) {
      throw nodeNotFound(path, relative);
    },
    getNodeOrNull: () => null,
    getParent: () => null,
    getChildren: () => [],
    isInsideTree: () => bound !== null && ended() === null,
    get: async (property) => (await mounted()).get(property),
    set: async (property, value) => (await mounted()).set(property, value),
    call: async (method, ...args) => (await mounted()).call(method, args),
  };

  return {
    node,
    bind(backing) {
      if (kept?.scene === backing.scene()) backing.setPose(kept.pose);
      bound = backing;
      const woken = waiters;
      waiters = [];
      woken.forEach((waiter) => waiter.resolve(backing));
      return () => {
        if (bound !== backing) return;
        kept = { scene: backing.scene(), pose: backing.pose() };
        bound = null;
      };
    },
    end(reason) {
      bound = null;
      const left = waiters;
      waiters = [];
      left.forEach((waiter) => waiter.reject(reason));
    },
  };
}

/** What a view answers of its editor camera: `mountScene` and a `TscnCanvas` ref give it. */
export interface EditorViewAnswers {
  /** The current editor mode's camera, never in the scene tree. Null in the In-game mode. */
  readonly editorCamera: NodeHandle | null;
}

/** Gives a view's answers the camera of the mode that `mode` reads at each access. */
export function withEditorCamera<Answers extends object>(
  answers: Answers,
  cameras: EditorCameras,
  mode: () => ViewportMode
): Answers & EditorViewAnswers {
  return Object.defineProperty(answers, 'editorCamera', {
    get: () => cameras.of(mode()),
    enumerable: true,
  }) as Answers & EditorViewAnswers;
}

/**
 * A write the view ended under, or its stage refused, warns instead of rejecting unhandled.
 * @canonical A UI write to the editor camera that no caller awaits
 */
export function warnOfCameraFailure(error: unknown): void {
  logger.warn(`[EditorCamera] ${error instanceof Error ? error.message : String(error)}`);
}
