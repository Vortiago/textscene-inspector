import { findInClassChain } from '../godot/classdb/classBaseTypes.js';
import type { NodeHandle } from './nodeHandle.js';
import type { SceneValue } from './variant.js';
import type { ViewportCameras } from './viewportCameras.js';

/** What `call` answers: a value, a node, or null for a method that returns nothing. */
export type CallResult = SceneValue | NodeHandle | null;

/** What a ported method reads and moves of its node and its scene. */
export interface MethodTarget {
  /** The node's live path, null for the root window. */
  readonly livePath: string | null;
  readonly cameras: ViewportCameras;
  /** A stored property as `get` reads it, with no ported getter run. */
  readStored(property: string): Promise<SceneValue | null>;
  /** A stored property as `set` writes it, with no ported setter run. */
  writeStored(property: string, value: SceneValue): Promise<boolean>;
  /** The handle of the node at a live path. */
  handleAt(livePath: string): NodeHandle;
}

/** A method of Godot's class this release ports, with the count of arguments its binding takes. */
interface PortedMethod {
  readonly minArguments: number;
  readonly maxArguments: number;
  /** `args` holds `minArguments` at least, as `runPortedMethod` checks first. */
  run(target: MethodTarget, args: readonly SceneValue[]): CallResult | Promise<CallResult>;
}

function boolArgument(value: SceneValue, method: string): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  throw new Error(`expected a bool for ${method}, got ${JSON.stringify(value)}`);
}

/** A ported method is called only on a node, so its live path is never the root window's. */
function nodePath(target: MethodTarget): string {
  return target.livePath!;
}

function cameraHandle(target: MethodTarget, livePath: string | null): NodeHandle | null {
  return livePath === null ? null : target.handleAt(livePath);
}

const CAMERA_3D_METHODS: Readonly<Record<string, PortedMethod>> = {
  make_current: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => (target.cameras.makeCurrent3D(nodePath(target)), null),
  },
  clear_current: {
    minArguments: 0,
    maxArguments: 1,
    run: (target, [enableNext = true]) => {
      target.cameras.clearCurrent3D(nodePath(target), boolArgument(enableNext, 'clear_current'));
      return null;
    },
  },
  // camera_3d.cpp:377-383
  set_current: {
    minArguments: 1,
    maxArguments: 1,
    run: (target, [enabled]) => {
      if (boolArgument(enabled!, 'set_current')) target.cameras.makeCurrent3D(nodePath(target));
      else target.cameras.clearCurrent3D(nodePath(target), true);
      return null;
    },
  },
  is_current: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => target.cameras.isCurrent3D(nodePath(target)),
  },
};

const CAMERA_2D_METHODS: Readonly<Record<string, PortedMethod>> = {
  make_current: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => (target.cameras.makeCurrent2D(nodePath(target)), null),
  },
  is_current: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => target.cameras.isCurrent2D(nodePath(target)),
  },
  // camera_2d.cpp:522-536: an unchanged value returns before the hand-over.
  set_enabled: {
    minArguments: 1,
    maxArguments: 1,
    run: async (target, [value]) => {
      const isEnabled = boolArgument(value!, 'set_enabled');
      if ((await target.readStored('enabled')) === isEnabled) return null;
      await target.writeStored('enabled', isEnabled);
      target.cameras.enabledChanged2D(nodePath(target), isEnabled);
      return null;
    },
  },
};

const VIEWPORT_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_camera_3d: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => cameraHandle(target, target.cameras.camera3D(target.livePath)),
  },
  get_camera_2d: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => cameraHandle(target, target.cameras.camera2D(target.livePath)),
  },
};

const PORTED_METHODS: Readonly<Record<string, Readonly<Record<string, PortedMethod>>>> = {
  Camera3D: CAMERA_3D_METHODS,
  Camera2D: CAMERA_2D_METHODS,
  Viewport: VIEWPORT_METHODS,
};

/** The nearest class's port of `method`, as a call resolves a method up the class chain. */
export function findPortedMethod(className: string, method: string): PortedMethod | undefined {
  return findInClassChain(className, (type) =>
    PORTED_METHODS[type] && Object.hasOwn(PORTED_METHODS[type], method)
      ? PORTED_METHODS[type][method]
      : undefined
  );
}

/** Runs a ported method after Godot's count check of a bound call (`method_bind.h`). */
export function runPortedMethod(
  method: PortedMethod,
  name: string,
  target: MethodTarget,
  args: readonly SceneValue[]
): CallResult | Promise<CallResult> {
  if (args.length < method.minArguments || args.length > method.maxArguments) {
    const expected =
      method.minArguments === method.maxArguments
        ? `${method.minArguments}`
        : `${method.minArguments} to ${method.maxArguments}`;
    throw new Error(`expected ${expected} arguments for ${name}, got ${args.length}`);
  }
  return method.run(target, args);
}
