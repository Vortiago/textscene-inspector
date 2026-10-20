/**
 * Whether a GeometryInstance3D node gives its render instance a geometry base. Only an instance
 * with one enters the visibility-range list, and so tests a range for its visibility dependants
 * (`renderer_scene_cull.cpp:1457-1459`). A base-less instance holds no `array_index`, so the cull
 * links none of its dependants to it, and each draws by its own range (`:1502-1503`).
 */

import { descendsFromClass } from '../classdb/classBaseTypes.js';
import { holdsResource } from './resourceLiteral.js';

/**
 * The base rule of the node's nearest class that sets one. `parentType` is the type of the node's
 * parent, or null for a root.
 */
export function hasGeometryBase(
  type: string,
  raw: Readonly<Record<string, string>>,
  parentType: string | null
): boolean {
  // A CSG shape under another CSG shape hands its brush to that parent and drops its own base
  // (`modules/csg/csg_shape.cpp:852-858`). A root draws the combined mesh (`:729`).
  if (descendsFromClass(type, 'CSGShape3D'))
    return parentType === null || !descendsFromClass(parentType, 'CSGShape3D');
  // `mesh_instance_3d.cpp:126,132`. SoftBody3D is a MeshInstance3D.
  if (descendsFromClass(type, 'MeshInstance3D')) return holdsResource(raw['mesh']);
  // `multimesh_instance_3d.cpp:69,72`.
  if (descendsFromClass(type, 'MultiMeshInstance3D')) return holdsResource(raw['multimesh']);
  // `Sprite3D::_draw` drops the base without a texture (`sprite_3d.cpp:794-800`).
  if (descendsFromClass(type, 'Sprite3D')) return holdsResource(raw['texture']);
  // The constructors set a base for good: SpriteBase3D's mesh (`sprite_3d.cpp:783`), Label3D's
  // mesh (`label_3d.cpp:1095`), and the particles' multimesh or particles (`cpu_particles_3d.cpp:1778`,
  // `gpu_particles_3d.cpp:881`). AnimatedSprite3D drops it only for a frame with no texture
  // (`sprite_3d.cpp:1040-1043`), which its SpriteFrames resource decides.
  return (
    descendsFromClass(type, 'SpriteBase3D') ||
    descendsFromClass(type, 'Label3D') ||
    descendsFromClass(type, 'CPUParticles3D') ||
    descendsFromClass(type, 'GPUParticles3D')
  );
}
