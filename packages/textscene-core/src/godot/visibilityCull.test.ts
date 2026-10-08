import { describe, expect, it } from 'vitest';
import { cullVisibility, type VisibilityCullInstance } from './visibilityCull';
import { NO_VISIBILITY_RANGE, VisibilityRangeFadeMode, type VisibilityRange } from './visibilityRange';

function instance(
  fields: Partial<Omit<VisibilityCullInstance, 'range'>> & { range?: Partial<VisibilityRange> }
) {
  const { range, ...rest } = fields;
  return {
    parent: -1,
    distance: 10,
    isInView: true,
    wasVisible: false,
    ...rest,
    range: { ...NO_VISIBILITY_RANGE, ...range },
  };
}

/** An HLOD pair: a far proxy whose begin hands over to its near detail. */
function proxyAndDetail(distance: number, proxyRange: Partial<VisibilityRange> = { begin: 20 }) {
  return [instance({ range: proxyRange, distance }), instance({ parent: 0, distance })];
}

describe('cullVisibility: one instance', () => {
  it('draws a ranged instance inside its range', () => {
    expect(cullVisibility([instance({ range: { end: 20 } })])[0]).toEqual({
      isVisible: true,
      fade: 1,
      wasVisible: true,
    });
  });

  it('hides a ranged instance past its end', () => {
    expect(cullVisibility([instance({ range: { end: 5 } })])[0]!.isVisible).toBe(false);
  });

  it('leaves the state of an instance out of view, as Godot range-checks it only in view', () => {
    const [result] = cullVisibility([instance({ range: { end: 20 }, isInView: false, wasVisible: false })]);
    expect(result).toMatchObject({ isVisible: false, wasVisible: false });
  });

  it('gives a SELF instance its eased margin fade', () => {
    // smoothstep(1 - (11 - 8) / 4) = 0.15625.
    const selfRange = { end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    expect(cullVisibility([instance({ range: selfRange, distance: 11 })])[0]!.fade).toBe(0.15625);
  });
});

describe('cullVisibility: a visibility parent', () => {
  it('hides the dependant while the parent draws', () => {
    expect(cullVisibility(proxyAndDetail(30)).map((r) => r.isVisible)).toEqual([true, false]);
  });

  it('swaps to the dependant once the parent is short of its begin', () => {
    expect(cullVisibility(proxyAndDetail(10)).map((r) => r.isVisible)).toEqual([false, true]);
  });

  it('hides both once the parent is past its end', () => {
    expect(cullVisibility(proxyAndDetail(30, { end: 20 })).map((r) => r.isVisible)).toEqual([false, false]);
  });

  it('hides the dependant of a parent with no range', () => {
    expect(cullVisibility(proxyAndDetail(10, {}))[1]!.isVisible).toBe(false);
  });

  it("fades the dependant in across a DEPENDENCIES parent's begin margin while the parent draws", () => {
    // 1 - (21 - (20 - 2)) / (2 * 2) = 0.25.
    const parentRange = { begin: 20, beginMargin: 2, fadeMode: VisibilityRangeFadeMode.DEPENDENCIES };
    const results = cullVisibility(proxyAndDetail(21, parentRange));
    expect(results.map((r) => [r.isVisible, r.fade])).toEqual([
      [true, 1],
      [true, 0.25],
    ]);
  });

  it("shows the dependant at full alpha across a SELF parent's margin", () => {
    const parentRange = { begin: 20, beginMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    expect(cullVisibility(proxyAndDetail(21, parentRange))[1]).toMatchObject({ isVisible: true, fade: 1 });
  });

  it("multiplies the dependant's own SELF fade into the parent's fade", () => {
    // Parent: 1 - (21 - 18) / 4 = 0.25. Dependant: smoothstep(1 - (21 - 19) / 4) = 0.5.
    const parentRange = { begin: 20, beginMargin: 2, fadeMode: VisibilityRangeFadeMode.DEPENDENCIES };
    const detailRange = { end: 21, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    const [, detail] = cullVisibility([
      instance({ range: parentRange, distance: 21 }),
      instance({ parent: 0, range: detailRange, distance: 21 }),
    ]);
    expect(detail!.fade).toBe(0.25 * 0.5);
  });

  it('range-checks a parent out of view, as the dependency pass reads no frustum', () => {
    const [parent] = cullVisibility([
      instance({ range: { end: 20 }, distance: 10, isInView: false, wasVisible: false }),
      instance({ parent: 0 }),
    ]);
    expect(parent!.wasVisible).toBe(true);
  });

  it('hides a whole chain below a parent past its end', () => {
    const results = cullVisibility([
      instance({ range: { end: 20 }, distance: 30 }),
      instance({ parent: 0, range: { begin: 5 } }),
      instance({ parent: 1 }),
    ]);
    expect(results.map((r) => r.isVisible)).toEqual([false, false, false]);
  });

  it('walks a chain of handovers from the farthest proxy to the nearest detail', () => {
    const results = cullVisibility([
      instance({ range: { begin: 20 }, distance: 10 }),
      instance({ parent: 0, range: { begin: 15 }, distance: 10 }),
      instance({ parent: 1, distance: 10 }),
    ]);
    expect(results.map((r) => r.isVisible)).toEqual([false, false, true]);
  });

  it('drops the later link that closes a cycle, as Godot refuses the latest change', () => {
    const results = cullVisibility([
      instance({ parent: 1 }),
      instance({ parent: 0, range: { begin: 20 }, distance: 10 }),
    ]);
    expect(results.map((r) => r.isVisible)).toEqual([true, false]);
  });
});
