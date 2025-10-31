/**
 * AnimationTree strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Constants for validation
const MIN_AUDIO_POLYPHONY = 1;
const MAX_AUDIO_POLYPHONY = 512;

validatorRegistry.registerAll('AnimationTree', {
  /**
   * Validate tree_root property
   * Must be SubResource("id") or ExtResource("id") format
   */
  'tree_root': (key, value, line) => {
    const trimmed = value.trim();

    // Check if it's a valid resource reference format
    const resourcePattern = /^(SubResource|ExtResource)\("([^"]+)"\)$/;
    if (!resourcePattern.test(trimmed)) {
      return {
        severity: 'error',
        message: `Property 'tree_root' must be a SubResource or ExtResource reference, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TREE_ROOT_FORMAT',
      };
    }

    return null;
  },

  /**
   * Validate anim_player property
   * Must be NodePath format
   */
  'anim_player': (key, value, line) => {
    const trimmed = value.trim();

    // Check if it's a NodePath format
    const nodePathPattern = /^NodePath\("([^"]*)"\)$/;
    if (!nodePathPattern.test(trimmed)) {
      return {
        severity: 'error',
        message: `Property 'anim_player' must be a NodePath reference, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANIM_PLAYER_FORMAT',
      };
    }

    return null;
  },

  /**
   * Validate active property
   * Must be a boolean (true or false)
   */
  'active': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'active' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ACTIVE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate process_callback property
   * Must be 0-2: PHYSICS=0, IDLE=1, MANUAL=2
   * Note: Godot 4.x uses AnimationCallbackModeProcess enum (0-2)
   */
  'process_callback': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'process_callback' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROCESS_CALLBACK_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'process_callback' must be 0-2 (got ${num}). Valid values: 0=PHYSICS, 1=IDLE, 2=MANUAL`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROCESS_CALLBACK_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate callback_mode_process property (AnimationMixer base class)
   * Must be 0-2: PHYSICS=0, IDLE=1, MANUAL=2
   */
  'callback_mode_process': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'callback_mode_process' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CALLBACK_MODE_PROCESS_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'callback_mode_process' must be 0-2 (got ${num}). Valid values: 0=PHYSICS, 1=IDLE, 2=MANUAL`,
        line,
        column: key.length + 3,
        code: 'INVALID_CALLBACK_MODE_PROCESS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate callback_mode_method property (AnimationMixer base class)
   * Must be 0-1: DEFERRED=0, IMMEDIATE=1
   */
  'callback_mode_method': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'callback_mode_method' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CALLBACK_MODE_METHOD_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'callback_mode_method' must be 0-1 (got ${num}). Valid values: 0=DEFERRED, 1=IMMEDIATE`,
        line,
        column: key.length + 3,
        code: 'INVALID_CALLBACK_MODE_METHOD_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate callback_mode_discrete property (AnimationMixer base class)
   * Must be 0-2: DOMINANT=0, RECESSIVE=1, FORCE_CONTINUOUS=2
   */
  'callback_mode_discrete': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'callback_mode_discrete' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CALLBACK_MODE_DISCRETE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'callback_mode_discrete' must be 0-2 (got ${num}). Valid values: 0=DOMINANT, 1=RECESSIVE, 2=FORCE_CONTINUOUS`,
        line,
        column: key.length + 3,
        code: 'INVALID_CALLBACK_MODE_DISCRETE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate root_motion_track property
   * Must be NodePath format (can be empty)
   */
  'root_motion_track': (key, value, line) => {
    const trimmed = value.trim();

    // Check if it's a NodePath format (empty NodePath is valid)
    const nodePathPattern = /^NodePath\("([^"]*)"\)$/;
    if (!nodePathPattern.test(trimmed)) {
      return {
        severity: 'error',
        message: `Property 'root_motion_track' must be a NodePath reference, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROOT_MOTION_TRACK_FORMAT',
      };
    }

    return null;
  },

  /**
   * Validate advance_expression_base_node property
   * Must be NodePath format
   */
  'advance_expression_base_node': (key, value, line) => {
    const trimmed = value.trim();

    // Check if it's a NodePath format
    const nodePathPattern = /^NodePath\("([^"]*)"\)$/;
    if (!nodePathPattern.test(trimmed)) {
      return {
        severity: 'error',
        message: `Property 'advance_expression_base_node' must be a NodePath reference, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ADVANCE_EXPRESSION_BASE_NODE_FORMAT',
      };
    }

    return null;
  },

  /**
   * Validate audio_max_polyphony property
   * Must be integer >= 1 (default is 32)
   */
  'audio_max_polyphony': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'audio_max_polyphony' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_AUDIO_MAX_POLYPHONY_FORMAT',
      };
    }
    if (num < MIN_AUDIO_POLYPHONY) {
      return {
        severity: 'error',
        message: `Property 'audio_max_polyphony' must be >= ${MIN_AUDIO_POLYPHONY} (got ${num}). Values below 1 cause runtime errors.`,
        line,
        column: key.length + 3,
        code: 'INVALID_AUDIO_MAX_POLYPHONY_TOO_SMALL',
      };
    }
    if (num > MAX_AUDIO_POLYPHONY) {
      return {
        severity: 'error',
        message: `Property 'audio_max_polyphony' is impractically large (${num}). Consider values below ${MAX_AUDIO_POLYPHONY}.`,
        line,
        column: key.length + 3,
        code: 'INVALID_AUDIO_MAX_POLYPHONY_TOO_LARGE',
      };
    }
    return null;
  },

  /**
   * Validate root_node property (AnimationMixer base class)
   * Must be NodePath format
   */
  'root_node': (key, value, line) => {
    const trimmed = value.trim();

    // Check if it's a NodePath format
    const nodePathPattern = /^NodePath\("([^"]*)"\)$/;
    if (!nodePathPattern.test(trimmed)) {
      return {
        severity: 'error',
        message: `Property 'root_node' must be a NodePath reference, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROOT_NODE_FORMAT',
      };
    }

    return null;
  },

  /**
   * Validate deterministic property (AnimationMixer base class)
   * Must be a boolean
   */
  'deterministic': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'deterministic' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DETERMINISTIC_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate reset_on_save property (AnimationMixer base class)
   * Must be a boolean
   */
  'reset_on_save': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'reset_on_save' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_RESET_ON_SAVE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate root_motion_local property (AnimationMixer base class)
   * Must be a boolean
   */
  'root_motion_local': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'root_motion_local' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROOT_MOTION_LOCAL_FORMAT',
      };
    }
    return null;
  },
});
