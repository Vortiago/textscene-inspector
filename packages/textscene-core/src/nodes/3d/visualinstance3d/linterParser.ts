/**
 * VisualInstance3D strict validators for linting.
 *
 * Declare only VisualInstance3D's OWN members — the ones doc/classes/VisualInstance3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `sorting_offset` and `sorting_use_aabb_center` are also documented members, but
 * VisualInstance3D's own `ADD_PROPERTY` for both passes `PROPERTY_USAGE_NONE`
 * explicitly (no storage flag) — so on bare VisualInstance3D, and on any direct
 * subclass that never overrides `_validate_property` (Light3D, FogVolume, VoxelGI,
 * LightmapGI, ReflectionProbe, VisibleOnScreenNotifier3D), neither one serialises
 * and neither gets a validator here.
 *
 * Two subclasses re-enable them via their own `_validate_property`, and OWN the
 * resulting validator once their slice exists — not VisualInstance3D's, since the
 * serialisability is that subclass's decision, not this base's:
 * GeometryInstance3D re-enables BOTH for its whole hierarchy (MeshInstance3D,
 * GPUParticles3D, Label3D, MultiMeshInstance3D, the CSG shapes, …); Decal
 * re-enables `sorting_offset` alone.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('VisualInstance3D', {
  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "layers", PROPERTY_HINT_LAYERS_3D_RENDER)
  layers: layerBitmask('layers', { hinted: 'visual_instance_3d.cpp:182' }),
});
