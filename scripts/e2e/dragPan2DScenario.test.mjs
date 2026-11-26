import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkDragPan2D, DRAG_PX } from './dragPan2DScenario.mjs';

function failuresOf(travels) {
  const gate = fakeGate();
  checkDragPan2D(gate, { travels, diagnostics: CLEAN_LOAD });
  return gate.failures;
}

describe('checkDragPan2D', () => {
  it('passes drags that each pan the full pointer travel', () => {
    expect(failuresOf([DRAG_PX, DRAG_PX, DRAG_PX])).toEqual([]);
  });

  it('fails a drag the browser cancelled after its first step', () => {
    expect(failuresOf([DRAG_PX, 10])).toEqual([`[drag pan 2D] drag 2 panned 10 px, expected ${DRAG_PX}`]);
  });

  it('fails a drag that panned nothing (edge case)', () => {
    expect(failuresOf([0])).toEqual([`[drag pan 2D] drag 1 panned 0 px, expected ${DRAG_PX}`]);
  });
});
