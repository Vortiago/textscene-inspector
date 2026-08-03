/**
 * The routing claim (ADR-0031). Importing the slice entry point must be enough
 * for the registry to answer for `CanvasItemMaterial` — the fix for the
 * substring routing that sent it to the material processor, which refuses it.
 */

import { describe, expect, it } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('canvasitemmaterial slice registration', () => {
  it('claims CanvasItemMaterial on the generic resource bus', () => {
    expect(resourceSliceRegistry.byTypeName('CanvasItemMaterial')).toMatchObject({
      slice: 'canvasitemmaterial',
      kind: 'godot-text',
      typeNames: ['CanvasItemMaterial'],
      busType: 'resource',
      failureLabel: 'Resource',
    });
  });

  it('routes CanvasItemMaterial to the resource processor, never the material one', () => {
    expect(resourceSliceRegistry.busTypeFor('CanvasItemMaterial')).toBe('resource');
  });

  it('claims no file extension of its own — a .tres arrives as a ParsedResource', () => {
    expect(resourceSliceRegistry.byTypeName('CanvasItemMaterial')?.extensions).toBeUndefined();
  });
});
