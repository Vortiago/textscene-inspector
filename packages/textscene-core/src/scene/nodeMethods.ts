import { descendsFromClass, findInClassChain } from '../godot/classdb/classBaseTypes.js';
import type { NodeHandle } from './nodeHandle.js';
import { VARIANT_TYPE as T, variantTypeName } from '../godot/variant/variantType.js';
import { valueOfSceneValue, type SceneValue } from './variant.js';
import type { ViewportCameras } from './viewportCameras.js';

/** What `call` answers: a value, a node, or null for a method that returns nothing. */
export type CallResult = SceneValue | NodeHandle | null;

/** What a ported method reads and moves of its node and its scene. */
export interface MethodTarget {
  /** The node's class, as `get_class` answers it. */
  readonly className: string;
  /** The node's live path, null for the root window. */
  readonly livePath: string | null;
  /** The scene's cameras, while the node is still of the text the call began in. */
  cameras(): ViewportCameras;
  /** A stored property as `get` reads it, with no ported getter run. */
  readStored(property: string): Promise<SceneValue | null>;
  /** A stored property as `set` writes it, with no ported setter run. */
  writeStored(property: string, value: SceneValue): Promise<boolean>;
  /** The handle of the node at a live path. */
  handleAt(livePath: string): NodeHandle;
  /** As the node's tree entry gives them: empty and null for the root window. */
  sceneFilePath(): string;
  ownerPath(): string | null;
}

/** A method of Godot's class this release ports, with the count of arguments its binding takes. */
export interface PortedMethod {
  /** The property ClassDB names this method the setter or the getter of, if any. */
  readonly accessor?: { readonly role: 'setter' | 'getter'; readonly property: string };
  readonly minArguments: number;
  readonly maxArguments: number;
  /** `args` holds `minArguments` at least, as `runPortedMethod` checks first. */
  /** `name` is `Class::method` of the node's own class, for Godot's error text. */
  run(target: MethodTarget, args: readonly SceneValue[], name: string): CallResult | Promise<CallResult>;
}

/** A bound call casts between bool, int and float, and refuses any other type (measured in Godot 4.6.3). */
function numberArgument(value: SceneValue, name: string, to: 'bool' | 'int'): number | boolean {
  const cast = valueOfSceneValue(value);
  if (cast.type === T.BOOL || cast.type === T.INT || cast.type === T.FLOAT)
    return cast.value as number | boolean;
  throw new Error(`${name}: Cannot convert argument 1 from ${variantTypeName(cast.type)} to ${to}.`);
}

// A bound String takes a StringName and a NodePath, and refuses any other type (measured in Godot 4.6.3).
function stringArgument(value: SceneValue, name: string): string {
  const cast = valueOfSceneValue(value);
  if (cast.type === T.STRING || cast.type === T.STRING_NAME || cast.type === T.NODE_PATH) return cast.value;
  throw new Error(`${name}: Cannot convert argument 1 from ${variantTypeName(cast.type)} to String.`);
}

function boolArgument(value: SceneValue, name: string): boolean {
  return Number(numberArgument(value, name, 'bool')) !== 0;
}

/** A float truncates, as Godot's cast to `int64_t` does. */
export function intArgument(value: SceneValue, name: string): number {
  return Math.trunc(Number(numberArgument(value, name, 'int')));
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
    run: (target) => (target.cameras().makeCurrent3D(nodePath(target)), null),
  },
  clear_current: {
    minArguments: 0,
    maxArguments: 1,
    run: (target, [enableNext = true], name) => {
      target.cameras().clearCurrent3D(nodePath(target), boolArgument(enableNext, name));
      return null;
    },
  },
  // camera_3d.cpp:377-383
  set_current: {
    accessor: { role: 'setter', property: 'current' },
    minArguments: 1,
    maxArguments: 1,
    run: (target, [enabled], name) => {
      if (boolArgument(enabled!, name)) target.cameras().makeCurrent3D(nodePath(target));
      else target.cameras().clearCurrent3D(nodePath(target), true);
      return null;
    },
  },
  is_current: {
    accessor: { role: 'getter', property: 'current' },
    minArguments: 0,
    maxArguments: 0,
    run: (target) => target.cameras().isCurrent3D(nodePath(target)),
  },
};

const CAMERA_2D_METHODS: Readonly<Record<string, PortedMethod>> = {
  make_current: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => (target.cameras().makeCurrent2D(nodePath(target)), null),
  },
  is_current: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => target.cameras().isCurrent2D(nodePath(target)),
  },
  // camera_2d.cpp:522-536: an unchanged value returns before the hand-over.
  set_enabled: {
    accessor: { role: 'setter', property: 'enabled' },
    minArguments: 1,
    maxArguments: 1,
    run: async (target, [value], name) => {
      const isEnabled = boolArgument(value!, name);
      if ((await target.readStored('enabled')) === isEnabled) return null;
      target.cameras().keep();
      await target.writeStored('enabled', isEnabled);
      target.cameras().enabledChanged2D(nodePath(target), isEnabled);
      return null;
    },
  },
};

const VIEWPORT_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_camera_3d: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => cameraHandle(target, target.cameras().camera3D(target.livePath)),
  },
  get_camera_2d: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => cameraHandle(target, target.cameras().camera2D(target.livePath)),
  },
};

const NODE_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_owner: {
    minArguments: 0,
    maxArguments: 0,
    run: (target) => {
      const ownerPath = target.ownerPath();
      return ownerPath === null ? null : target.handleAt(ownerPath);
    },
  },
  get_scene_file_path: {
    accessor: { role: 'getter', property: 'scene_file_path' },
    minArguments: 0,
    maxArguments: 0,
    run: (target) => target.sceneFilePath(),
  },
};

const OBJECT_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_class: { minArguments: 0, maxArguments: 0, run: (target) => target.className },
  // object.cpp:2220. The class table stops below `Object`, which every class inherits.
  is_class: {
    minArguments: 1,
    maxArguments: 1,
    run: (target, [className], name) => {
      const asked = stringArgument(className!, name);
      return asked === 'Object' || descendsFromClass(target.className, asked);
    },
  },
};

const PORTED_METHODS: Readonly<Record<string, Readonly<Record<string, PortedMethod>>>> = {
  Node: NODE_METHODS,
  Camera3D: CAMERA_3D_METHODS,
  Camera2D: CAMERA_2D_METHODS,
  Viewport: VIEWPORT_METHODS,
};

/** The nearest class's port of the setter or the getter of `property`, with the method's name. */
export function findPortedAccessor(
  className: string,
  role: 'setter' | 'getter',
  property: string
): { name: string; method: PortedMethod } | undefined {
  return findInClassChain(className, (type) => {
    const found = Object.entries(PORTED_METHODS[type] ?? {}).find(
      ([, method]) => method.accessor?.role === role && method.accessor.property === property
    );
    return found && { name: found[0], method: found[1] };
  });
}

/** The nearest class's port of `method`, as a call resolves a method up the class chain. */
export function findPortedMethod(className: string, method: string): PortedMethod | undefined {
  const own = findInClassChain(className, (type) =>
    PORTED_METHODS[type] && Object.hasOwn(PORTED_METHODS[type], method)
      ? PORTED_METHODS[type][method]
      : undefined
  );
  return own ?? (Object.hasOwn(OBJECT_METHODS, method) ? OBJECT_METHODS[method] : undefined);
}

/** Godot's error for a bound call with the wrong count, `name` as `Class::method` (`object.cpp:888`). */
export function argumentCountError(name: string, expected: number, given: number): Error {
  return new Error(`${name}: Method expected ${expected} argument(s), but called with ${given}.`);
}

/** Runs a ported method after Godot's count check of a bound call, `name` as `Class::method`. */
export function runPortedMethod(
  method: PortedMethod,
  name: string,
  target: MethodTarget,
  args: readonly SceneValue[]
): CallResult | Promise<CallResult> {
  if (args.length > method.maxArguments) throw argumentCountError(name, method.maxArguments, args.length);
  if (args.length < method.minArguments) throw argumentCountError(name, method.minArguments, args.length);
  return method.run(target, args, name);
}
