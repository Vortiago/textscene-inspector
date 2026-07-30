/**
 * The Viewport-level validators must reach BOTH instantiable Viewports.
 *
 * They used to be registered on `SubViewport` alone, so when `Window` arrived
 * it inherited none of them: the same property on the same base class errored
 * on one node type and was silently accepted on the other. These assertions
 * pin the shared registration and the two base-walk links that deliver it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/** Every member `doc/classes/Viewport.xml` owns that this repo validates. */
const VIEWPORT_KEYS = [
  'own_world_3d',
  'disable_3d',
  'transparent_bg',
  'handle_input_locally',
  'use_debanding',
  'audio_listener_enable_2d',
  'gui_embed_subwindows',
  'msaa_3d',
  'canvas_item_default_texture_filter',
] as const;

describe('Viewport shared validators', () => {
  it('registers under the abstract Viewport key', () => {
    expect(validatorRegistry.getOwnKeys('Viewport').sort()).toEqual([...VIEWPORT_KEYS].sort());
  });

  it.each(['SubViewport', 'Window'])('delivers every Viewport key to %s', (nodeType) => {
    const missing = VIEWPORT_KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it.each(['SubViewport', 'Window'])('rejects a malformed own_world_3d on %s', (nodeType) => {
    const validator = validatorRegistry.findValidator(nodeType, 'own_world_3d');
    expect(validator).not.toBeNull();
    expect(validator!('own_world_3d', 'garbage', 1)).not.toBeNull();
    expect(validator!('own_world_3d', 'true', 1)).toBeNull();
  });

  it.each(['SubViewport', 'Window'])('bounds msaa_3d to the four Godot modes on %s', (nodeType) => {
    const validator = validatorRegistry.findValidator(nodeType, 'msaa_3d')!;
    for (const value of ['0', '1', '2', '3']) expect(validator('msaa_3d', value, 1)).toBeNull();
    expect(validator('msaa_3d', '4', 1)).not.toBeNull();
  });

  it('leaves SubViewport-only members off the shared set', () => {
    // `size`, `size_2d_override*` and `render_target_*` are SubViewport's own
    // (doc/classes/SubViewport.xml); a Window has none of them.
    for (const key of ['size', 'size_2d_override', 'render_target_update_mode']) {
      expect(validatorRegistry.getOwnKeys('Viewport')).not.toContain(key);
    }
  });
});
