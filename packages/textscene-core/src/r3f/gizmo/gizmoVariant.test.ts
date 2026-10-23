import { describe, expect, it } from 'vitest';
import { gizmoAlpha } from './gizmoVariant';

describe('gizmoAlpha', () => {
  it('keeps the colour alpha of a selected gizmo', () => {
    expect(gizmoAlpha('selected', 0.9)).toBe(0.9);
  });

  it('multiplies the colour alpha of an unselected gizmo by 0.3', () => {
    expect(gizmoAlpha('unselected', 0.5)).toBeCloseTo(0.15, 10);
  });

  it('takes an opaque colour when no alpha is given', () => {
    expect([gizmoAlpha('selected'), gizmoAlpha('unselected')]).toEqual([1, 0.3]);
  });
});
