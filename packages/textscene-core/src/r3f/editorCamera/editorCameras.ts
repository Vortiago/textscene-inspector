import type { NodeHandle } from '../../scene/nodeHandle.js';
import { nodeNotFound } from '../../scene/nodeHandle.js';
import type { CallResult } from '../../scene/nodeMethods.js';
import type { SceneValue } from '../../scene/variant.js';
import type { ViewportMode } from '../contexts/ViewportModeContext.js';

/** What a mounted stage does to its camera. The node waits for one, as the stage loads on demand. */
export interface EditorCameraBacking {
  get(property: string): SceneValue | null;
  set(property: string, value: SceneValue): boolean;
  call(method: string, args: readonly SceneValue[]): CallResult;
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
  };
}

function createSlot(
  type: EditorCameraType,
  ended: () => Error | null
): EditorCameraSlot & { end(reason: Error): void } {
  let bound: EditorCameraBacking | null = null;
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
      bound = backing;
      const woken = waiters;
      waiters = [];
      woken.forEach((waiter) => waiter.resolve(backing));
      return () => {
        if (bound === backing) bound = null;
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
