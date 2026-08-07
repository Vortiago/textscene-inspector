/**
 * MultiplayerSynchronizer strict validators for linting.
 *
 * Declare only MultiplayerSynchronizer's OWN members — the ones doc/classes/MultiplayerSynchronizer.xml
 * lists without an `overrides=` attribute. Everything from Node up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MultiplayerSynchronizer', {
  // multiplayer_synchronizer.cpp:270, NODE_PATH, PROPERTY_HINT_NONE. Default
  // is NodePath("..") (XML default), not empty — see linter.ts for what that
  // means for the get_configuration_warnings mirror.
  root_path: v.nodePath('root_path'),
  // multiplayer_synchronizer.cpp:271, PROPERTY_HINT_RANGE "0,5,0.001,suffix:s"
  // (both ends closed). set_replication_interval (:312-315)
  // ERR_FAIL_COND_MSG(p_interval < 0, …) — the floor is setter-enforced, the
  // 5-second ceiling is only the hint's, so the two ends carry different
  // severities.
  replication_interval: v.float('replication_interval', {
    min: 0,
    max: 5,
    enforced: { min: 'multiplayer_synchronizer.cpp:313' },
    hinted: { max: 'multiplayer_synchronizer.cpp:271' },
  }),
  // multiplayer_synchronizer.cpp:272, same shape; set_delta_interval (:321-324)
  // ERR_FAIL_COND_MSG(p_interval < 0, …).
  delta_interval: v.float('delta_interval', {
    min: 0,
    max: 5,
    enforced: { min: 'multiplayer_synchronizer.cpp:322' },
    hinted: { max: 'multiplayer_synchronizer.cpp:272' },
  }),
  // multiplayer_synchronizer.cpp:273, OBJECT, PROPERTY_HINT_RESOURCE_TYPE
  // "SceneReplicationConfig" (PROPERTY_USAGE_NO_EDITOR keeps STORAGE — see
  // object.h:132 — so it is still serialised, just hidden from the inspector).
  replication_config: v.resourceReference('replication_config'),
  // multiplayer_synchronizer.cpp:274, PROPERTY_HINT_ENUM "Idle,Physics,None"
  // matching BIND_ENUM_CONSTANT VISIBILITY_PROCESS_IDLE/PHYSICS/NONE (:277-279).
  // set_visibility_update_mode (:236-239) is a bare assignment, so out-of-range
  // is a warning.
  visibility_update_mode: v.enumInt(
    'visibility_update_mode',
    0,
    2,
    {
      0: 'VISIBILITY_PROCESS_IDLE',
      1: 'VISIBILITY_PROCESS_PHYSICS',
      2: 'VISIBILITY_PROCESS_NONE',
    },
    { hinted: 'multiplayer_synchronizer.cpp:274' }
  ),
  // multiplayer_synchronizer.cpp:275, BOOL, no hint. set_visibility_public
  // (:189-191) forwards to set_visibility_for(0, p_visible), a bare set-insert/
  // erase with no rejection of either boolean value.
  public_visibility: v.boolean('public_visibility'),
});
