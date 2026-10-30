/** The Skin slice's types. Pure data: a Skeleton3D turns the binds into the matrices a mesh skins by. */

import type { Transform3D } from '../../godot/math/transform3d';

/** One bind of a Skin (`scene/resources/3d/skin.h:38-42`): the bone it addresses and its bind pose. */
export interface SkinBind {
  /** The bone index, or -1 for none. Read only where `name` is empty. */
  bone: number;
  /** The bone name. It wins over `bone`, and an empty name defers to it. */
  name: string;
  /** The inverse of the rest the vertices were bound at, in the space of the mesh. */
  pose: Transform3D;
}
