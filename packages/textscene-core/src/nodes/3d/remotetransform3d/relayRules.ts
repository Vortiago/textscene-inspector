/**
 * What a RemoteTransform3D or RemoteTransform2D's class and flags decide about a push: the class
 * its target must be, the family a move of the target reaches, and whether a push moves or
 * notifies the target. The RemoteTransform pass and the relay cycle check both read it.
 */

/** The class a relay's target must descend from (`remote_transform_3d.cpp:54`). */
export type Space = 'Node3D' | 'Node2D';

/** What sets each relay class apart. */
export interface RelayClass {
  readonly space: Space;
  /**
   * The family a move of the target notifies: Node3D children (`node_3d.cpp:106-133`) or
   * CanvasItem children (`canvas_item.cpp:1069-1101`).
   */
  readonly reached: 'Node3D' | 'CanvasItem';
}

export const RELAY_CLASSES: Readonly<Record<string, RelayClass>> = {
  RemoteTransform3D: { space: 'Node3D', reached: 'Node3D' },
  RemoteTransform2D: { space: 'Node2D', reached: 'CanvasItem' },
};

export interface RemoteFlags {
  updatePosition: boolean;
  updateRotation: boolean;
  updateScale: boolean;
  useGlobal: boolean;
}

/** The flag properties as the parser stores them: absent, or a boolean. */
export interface RelayFlagProps {
  update_position?: boolean;
  update_rotation?: boolean;
  update_scale?: boolean;
  use_global_coordinates?: boolean;
}

/** A relay's flags, each defaulting to Godot's `true`. */
export function readFlags(props: RelayFlagProps): RemoteFlags {
  return {
    updatePosition: props.update_position !== false,
    updateRotation: props.update_rotation !== false,
    updateScale: props.update_scale !== false,
    useGlobal: props.use_global_coordinates !== false,
  };
}

export function flagsAnyPart({ updatePosition, updateRotation, updateScale }: RemoteFlags): boolean {
  return updatePosition || updateRotation || updateScale;
}

export function flagsEveryPart({ updatePosition, updateRotation, updateScale }: RemoteFlags): boolean {
  return updatePosition && updateRotation && updateScale;
}

/**
 * Whether a push sets the target's transform, which notifies the target's listeners. With no part
 * flagged, a 3D relay sets the target's own transform back (`remote_transform_3d.cpp:71-97`), and
 * a 2D relay returns before it sets anything (`remote_transform_2d.cpp:63-65`).
 */
export function pushSetsTarget(space: Space, flags: RemoteFlags): boolean {
  return space === 'Node3D' || flagsAnyPart(flags);
}
