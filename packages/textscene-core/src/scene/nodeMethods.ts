import { descendsFromClass, findInClassChain } from '../godot/classdb/classBaseTypes.js';
import type { NodeHandle } from './nodeHandle.js';
import { VARIANT_TYPE as T, variantTypeName } from '../godot/variant/variantType.js';
import { sceneValueOf, valueOfSceneValue, type SceneValue } from './variant.js';
import { absolutePathOf, ROOT_WINDOW_PATH } from './nodePathWalk.js';
import type { ViewportCameras } from './viewportCameras.js';
import { animationLibrariesOf, animationNamesOf, type LibraryTexts } from './animationLibraries.js';
import type { LoadedResource } from './listed/listedProperties.js';
import { boneCountOf } from './listed/skeletonBones.js';
import { tileMapLayerCount, tileMapUsedCells } from './listed/tileMapLayers.js';
import { tileMapLayerCells, usedCellsValue } from './tileCells.js';

/** What `call` answers: a value, a node, or null for a method that returns nothing. */
export type CallResult = SceneValue | NodeHandle | null;

/** What `call` takes: a value, or a node for a method whose binding takes an Object. */
export type CallArgument = SceneValue | NodeHandle;

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
  /** The flag an `[editable]` of any enclosing file sets on `node`, false for a node of another scene. */
  isEditableInstance(node: NodeHandle): boolean;
  /** Each text the node's files set, in the order `_set` applies them, and the class of a resource. */
  ownTexts(): Promise<LibraryTexts>;
  /** The same texts as the files spell them, by property name. */
  fileTexts(): Promise<Readonly<Record<string, string>>>;
  /** The resource a path names, loaded as `load` would. Null where none loads. */
  resource(path: string): Promise<LoadedResource | null>;
}

/** A method of Godot's class this release ports, with the count of arguments its binding takes. */
export interface PortedMethod {
  /** The property ClassDB names this method the setter or the getter of, if any. */
  readonly accessor?: { readonly role: 'setter' | 'getter'; readonly property: string };
  readonly minArguments: number;
  readonly maxArguments: number;
  /** `args` holds `minArguments` at least, as `runPortedMethod` checks first. */
  /** `name` is `Class::method` of the node's own class, for Godot's error text. */
  run(target: MethodTarget, args: readonly CallArgument[], name: string): CallResult | Promise<CallResult>;
}

export function isNodeHandle(value: unknown): value is NodeHandle {
  return typeof value === 'object' && value !== null && 'getChildren' in value;
}

function cannotConvert(name: string, from: string, to: string): Error {
  return new Error(`${name}: Cannot convert argument 1 from ${from} to ${to}.`);
}

/** The value of a bound value argument: a node is an Object, which a value binding refuses. */
function valueArgument(value: CallArgument, name: string, to: string) {
  if (isNodeHandle(value)) throw cannotConvert(name, 'Object', to);
  return valueOfSceneValue(value);
}

/** A bound call casts between bool, int and float, and refuses any other type (measured in Godot 4.6.3). */
function numberArgument(value: CallArgument, name: string, to: 'bool' | 'int'): number | boolean {
  const cast = valueArgument(value, name, to);
  if (cast.type === T.BOOL || cast.type === T.INT || cast.type === T.FLOAT)
    return cast.value as number | boolean;
  throw cannotConvert(name, variantTypeName(cast.type) ?? 'Nil', to);
}

// A bound String takes a StringName and a NodePath, and refuses any other type (measured in Godot 4.6.3).
function stringArgument(value: CallArgument, name: string): string {
  const cast = valueArgument(value, name, 'String');
  if (cast.type === T.STRING || cast.type === T.STRING_NAME || cast.type === T.NODE_PATH) return cast.value;
  throw cannotConvert(name, variantTypeName(cast.type) ?? 'Nil', 'String');
}

/** A property's setter or getter takes values only, so a node argument is refused before the call. */
export function valueArguments(args: readonly CallArgument[], name: string): SceneValue[] {
  return args.map((arg, index) => {
    if (!isNodeHandle(arg)) return arg;
    throw new Error(`${name}: expected a value for argument ${index + 1}, got the node at ${arg.path}`);
  });
}

// A bound Object takes a node or null, and refuses a value of any other type (measured in Godot 4.6.3).
function nodeArgument(value: CallArgument, name: string): NodeHandle | null {
  if (isNodeHandle(value)) return value;
  const { type } = valueOfSceneValue(value);
  if (type === T.NIL) return null;
  throw cannotConvert(name, variantTypeName(type) ?? 'Nil', 'Object');
}

function boolArgument(value: CallArgument, name: string): boolean {
  return Number(numberArgument(value, name, 'bool')) !== 0;
}

/** A float truncates, as Godot's cast to `int64_t` does. */
export function intArgument(value: CallArgument, name: string): number {
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
  // node.cpp:2696: null, or a node that is not below the caller, answers false.
  is_editable_instance: {
    minArguments: 1,
    maxArguments: 1,
    run: (target, [node], name) => {
      const instance = nodeArgument(node!, name);
      if (!instance) return false;
      const callerPath = target.livePath === null ? ROOT_WINDOW_PATH : absolutePathOf(target.livePath);
      const isBelow = instance.path.startsWith(`${callerPath}/`);
      return isBelow && target.isEditableInstance(instance);
    },
  },
};

const ANIMATION_MIXER_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_animation_library_list: {
    minArguments: 0,
    maxArguments: 0,
    run: async (target) => {
      const libraries = await animationLibrariesOf(await target.ownTexts());
      const elements = libraries.map(({ name }) => ({ type: T.STRING_NAME, value: name }) as const);
      return sceneValueOf({ type: T.ARRAY, elements, elementType: { builtin: T.STRING_NAME } });
    },
  },
  // animation_mixer.cpp:266-273: a name it does not hold answers a null Ref.
  get_animation_library: {
    minArguments: 1,
    maxArguments: 1,
    run: async (target, [name], methodName) => {
      const asked = stringArgument(name!, methodName);
      const libraries = await animationLibrariesOf(await target.ownTexts());
      const held = libraries.find((entry) => entry.name === asked);
      return held ? sceneValueOf(held.library) : null;
    },
  },
};

// animation_player.cpp:150-153: a running scene plays `autoplay` on ready where a library holds it.
const ANIMATION_PLAYER_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_current_animation: {
    accessor: { role: 'getter', property: 'current_animation' },
    minArguments: 0,
    maxArguments: 0,
    run: async (target) => {
      const autoplay = await target.readStored('autoplay');
      const asked = typeof autoplay === 'object' && autoplay !== null ? valueOfSceneValue(autoplay) : null;
      const name = asked?.type === T.STRING_NAME || asked?.type === T.STRING ? asked.value : '';
      const { texts, resourceClass } = await target.ownTexts();
      const libraries = await animationLibrariesOf({ texts, resourceClass });
      const isHeld =
        name !== '' && (await animationNamesOf(libraries, texts, target.resource)).includes(name);
      return sceneValueOf({ type: T.STRING_NAME, value: isHeld ? name : '' });
    },
  },
};

// audio_stream_player_internal.cpp:93-96: a running scene plays an autoplay stream as it enters the tree.
const AUDIO_STREAM_PLAYER_METHODS: Readonly<Record<string, PortedMethod>> = {
  is_playing: {
    accessor: { role: 'getter', property: 'playing' },
    minArguments: 0,
    maxArguments: 0,
    run: async (target) => {
      if ((await target.readStored('autoplay')) !== true) return false;
      const stream = await target.readStored('stream');
      const path = typeof stream === 'object' && stream !== null ? valueOfSceneValue(stream) : null;
      if (path?.type !== T.OBJECT || !path.resource) return false;
      return (
        (await target.ownTexts().then(({ resourceClass }) => resourceClass(path.resource!.path))) !== null
      );
    },
  },
};

const SKELETON_3D_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_bone_count: {
    minArguments: 0,
    maxArguments: 0,
    run: async (target) => boneCountOf(await target.fileTexts()),
  },
};

const TILE_MAP_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_layers_count: {
    minArguments: 0,
    maxArguments: 0,
    run: async (target) => tileMapLayerCount(await target.fileTexts()),
  },
  get_used_cells: {
    minArguments: 1,
    maxArguments: 1,
    run: async (target, [layer], name) =>
      sceneValueOf(usedCellsValue(tileMapUsedCells(await target.fileTexts(), intArgument(layer!, name)))),
  },
};

const TILE_MAP_LAYER_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_used_cells: {
    minArguments: 0,
    maxArguments: 0,
    run: async (target) => sceneValueOf(usedCellsValue(tileMapLayerCells(await target.fileTexts()))),
  },
};

const OBJECT_METHODS: Readonly<Record<string, PortedMethod>> = {
  get_class: { minArguments: 0, maxArguments: 0, run: (target) => classInTree(target.className) },
  // object.cpp:2220. The class table stops below `Object`, which every class inherits.
  is_class: {
    minArguments: 1,
    maxArguments: 1,
    run: (target, [className], name) => {
      const asked = stringArgument(className!, name);
      return asked === 'Object' || descendsFromClass(classInTree(target.className), asked);
    },
  },
};

const PORTED_METHODS: Readonly<Record<string, Readonly<Record<string, PortedMethod>>>> = {
  Node: NODE_METHODS,
  Camera3D: CAMERA_3D_METHODS,
  Camera2D: CAMERA_2D_METHODS,
  Viewport: VIEWPORT_METHODS,
  AnimationMixer: ANIMATION_MIXER_METHODS,
  AnimationPlayer: ANIMATION_PLAYER_METHODS,
  AudioStreamPlayer: AUDIO_STREAM_PLAYER_METHODS,
  AudioStreamPlayer2D: AUDIO_STREAM_PLAYER_METHODS,
  AudioStreamPlayer3D: AUDIO_STREAM_PLAYER_METHODS,
  Skeleton3D: SKELETON_3D_METHODS,
  TileMap: TILE_MAP_METHODS,
  TileMapLayer: TILE_MAP_LAYER_METHODS,
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

// packed_scene.cpp:331: Godot 4.6.3 makes a placeholder Node of a class it cannot make (measured).
function classInTree(className: string): string {
  return descendsFromClass(className, 'Node') ? className : 'Node';
}

/** Every method a call reaches without the property table, for the error that names them. */
export const PORTED_METHOD_NAMES: readonly string[] = [
  ...Object.keys(OBJECT_METHODS),
  ...Object.values(PORTED_METHODS).flatMap((methods) => Object.keys(methods)),
];

/** The nearest class's port of `method`, as a call resolves a method up the class chain. */
export function findPortedMethod(className: string, method: string): PortedMethod | undefined {
  const own = findInClassChain(classInTree(className), (type) =>
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
  args: readonly CallArgument[]
): CallResult | Promise<CallResult> {
  if (args.length > method.maxArguments) throw argumentCountError(name, method.maxArguments, args.length);
  if (args.length < method.minArguments) throw argumentCountError(name, method.minArguments, args.length);
  return method.run(target, args, name);
}
