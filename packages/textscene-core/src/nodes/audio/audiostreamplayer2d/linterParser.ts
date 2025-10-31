/**
 * AudioStreamPlayer2D format validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('AudioStreamPlayer2D', {
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
   * Must be a float (typically -80 to +24 dB)
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
   * Validate max_distance property
   * Must be a float > 0
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
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'max_distance' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_DISTANCE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate attenuation property
   * Must be a float > 0
   */
  'attenuation': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'attenuation' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ATTENUATION_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'attenuation' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_ATTENUATION_VALUE',
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
   * Must be a valid 20-bit bitmask (0-1048575)
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
        message: `Property 'area_mask' must be between 0 and 1048575 (got ${num}). Valid range: 20-bit bitmask`,
        line,
        column: key.length + 3,
        code: 'INVALID_AREA_MASK_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate playback_type property
   * Must be 0-2: STREAM=0, SAMPLE=1, MAX=2
   */
  'playback_type': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'playback_type' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLAYBACK_TYPE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'playback_type' must be 0-2 (got ${num}). Valid values: 0=STREAM, 1=SAMPLE, 2=MAX`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLAYBACK_TYPE_VALUE',
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
