/**
 * AudioStreamPlayer3D format validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('AudioStreamPlayer3D', {
  /**
   * Validate stream property
   * Must be ExtResource or SubResource reference
   */
  'stream': (key, value, line) => {
    if (!value.startsWith('ExtResource(') && !value.startsWith('SubResource(')) {
      return {
        severity: 'error',
        message: `Property 'stream' must be a resource reference (ExtResource or SubResource), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_STREAM_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate volume_db property
   * Must be a float (typically -80 to +6 dB)
   */
  'volume_db': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'volume_db' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VOLUME_DB_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate pitch_scale property
   * Must be a float > 0
   */
  'pitch_scale': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'pitch_scale' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PITCH_SCALE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'pitch_scale' must be greater than 0 (got ${num}). Zero or negative pitch breaks audio playback.`,
        line,
        column: key.length + 3,
        code: 'INVALID_PITCH_SCALE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate playing property
   * Must be a boolean (true or false)
   */
  'playing': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'playing' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLAYING_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate autoplay property
   * Must be a boolean (true or false)
   */
  'autoplay': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'autoplay' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_AUTOPLAY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate stream_paused property
   * Must be a boolean (true or false)
   */
  'stream_paused': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'stream_paused' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_STREAM_PAUSED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate attenuation_model property
   * Must be 0-3: INVERSE_DISTANCE=0, INVERSE_SQUARE_DISTANCE=1, LOGARITHMIC=2, DISABLED=3
   */
  'attenuation_model': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'attenuation_model' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ATTENUATION_MODEL_FORMAT',
      };
    }
    if (num < 0 || num > 3) {
      return {
        severity: 'error',
        message: `Property 'attenuation_model' must be 0-3 (got ${num}). Valid values: 0=INVERSE_DISTANCE, 1=INVERSE_SQUARE_DISTANCE, 2=LOGARITHMIC, 3=DISABLED`,
        line,
        column: key.length + 3,
        code: 'INVALID_ATTENUATION_MODEL_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate unit_size property
   * Must be a float > 0
   */
  'unit_size': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'unit_size' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_UNIT_SIZE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'unit_size' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_UNIT_SIZE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate max_distance property
   * Must be a float >= 0 (0 means unlimited)
   */
  'max_distance': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'max_distance' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_DISTANCE_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'max_distance' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_DISTANCE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate max_db property
   * Must be a float (typically -24 to +6 dB)
   */
  'max_db': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'max_db' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_DB_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate attenuation_filter_cutoff_hz property
   * Must be a float >= 1
   */
  'attenuation_filter_cutoff_hz': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'attenuation_filter_cutoff_hz' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ATTENUATION_FILTER_CUTOFF_HZ_FORMAT',
      };
    }
    if (num < 1) {
      return {
        severity: 'error',
        message: `Property 'attenuation_filter_cutoff_hz' must be at least 1 Hz (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_ATTENUATION_FILTER_CUTOFF_HZ_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate attenuation_filter_db property
   * Must be a float (typically -80 to +6 dB)
   */
  'attenuation_filter_db': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'attenuation_filter_db' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ATTENUATION_FILTER_DB_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate doppler_tracking property
   * Must be 0-2: DISABLED=0, IDLE_STEP=1, PHYSICS_STEP=2
   */
  'doppler_tracking': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'doppler_tracking' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DOPPLER_TRACKING_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'doppler_tracking' must be 0-2 (got ${num}). Valid values: 0=DISABLED, 1=IDLE_STEP, 2=PHYSICS_STEP`,
        line,
        column: key.length + 3,
        code: 'INVALID_DOPPLER_TRACKING_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate panning_strength property
   * Must be a float 0-1
   */
  'panning_strength': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'panning_strength' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PANNING_STRENGTH_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'panning_strength' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_PANNING_STRENGTH_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate area_mask property
   * Must be a valid bitmask (0-1048575 for bits 1-20)
   */
  'area_mask': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'area_mask' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_AREA_MASK_FORMAT',
      };
    }
    if (num < 0 || num > 1048575) {
      return {
        severity: 'error',
        message: `Property 'area_mask' must be between 0 and 1048575 (got ${num}). Valid range: bits 0-20`,
        line,
        column: key.length + 3,
        code: 'INVALID_AREA_MASK_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate emission_angle_enabled property
   * Must be a boolean (true or false)
   */
  'emission_angle_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'emission_angle_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_EMISSION_ANGLE_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate emission_angle_degrees property
   * Must be a float 0-90
   */
  'emission_angle_degrees': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'emission_angle_degrees' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_EMISSION_ANGLE_DEGREES_FORMAT',
      };
    }
    if (num < 0 || num > 90) {
      return {
        severity: 'error',
        message: `Property 'emission_angle_degrees' must be between 0 and 90 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_EMISSION_ANGLE_DEGREES_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate emission_angle_filter_attenuation_db property
   * Must be a float (typically -24 to +6 dB)
   */
  'emission_angle_filter_attenuation_db': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'emission_angle_filter_attenuation_db' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_EMISSION_ANGLE_FILTER_ATTENUATION_DB_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate bus property
   * Must be a string (string name or StringName format)
   */
  'bus': (key, value, line) => {
    // Accept both regular string and StringName format (&"...")
    if (!value.startsWith('"') && !value.startsWith('&"')) {
      return {
        severity: 'error',
        message: `Property 'bus' must be a string, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_BUS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate max_polyphony property
   * Must be an integer >= 1
   */
  'max_polyphony': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'max_polyphony' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_POLYPHONY_FORMAT',
      };
    }
    if (num < 1) {
      return {
        severity: 'error',
        message: `Property 'max_polyphony' must be at least 1 (got ${num}). Values below 1 cause errors.`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_POLYPHONY_VALUE',
      };
    }
    return null;
  },
});
