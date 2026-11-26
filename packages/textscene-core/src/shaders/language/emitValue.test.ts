import { describe, expect, it } from 'vitest';
import { uniformView, uniformViewId, type StructValue } from './emitValue.js';

const struct = (): StructValue => ({ kind: 'struct', members: new Map() });

describe('uniformView', () => {
  it('marks the view with an id that uniformViewId reads back', () => {
    expect(uniformViewId(uniformView(struct()))).toEqual(expect.any(Number));
  });

  it('gives each view its own id, so two views never share a function', () => {
    const view = struct();

    expect(uniformViewId(uniformView(view))).not.toBe(uniformViewId(uniformView(view)));
  });

  it('leaves the view it marks unmarked (edge case)', () => {
    const view = struct();
    uniformView(view);

    expect(uniformViewId(view)).toBeUndefined();
  });
});
