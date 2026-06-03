import { describe, expect, it } from 'vitest';
import { controlLayoutStyle } from './controlLayout';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';

function ctrl(p: Partial<ControlProperties>): ControlProperties {
  return { name: 'C', ...p };
}

describe('controlLayoutStyle — free / anchored', () => {
  it('FULL_RECT (preset 15) → absolute inset 0', () => {
    const s = controlLayoutStyle(ctrl({ anchorsPreset: 15 }), 'free');
    expect(s.position).toBe('absolute');
    expect(s.left).toBe('0px');
    expect(s.top).toBe('0px');
    expect(s.right).toBe('0px');
    expect(s.bottom).toBe('0px');
  });

  it('CENTER (preset 8) → 50% anchors on all edges', () => {
    const s = controlLayoutStyle(ctrl({ anchorsPreset: 8 }), 'free');
    expect(s.left).toBe('50%');
    expect(s.top).toBe('50%');
    expect(s.right).toBe('50%');
    expect(s.bottom).toBe('50%');
  });

  it('BOTTOM_WIDE (preset 12) → spans width, pinned to bottom', () => {
    const s = controlLayoutStyle(ctrl({ anchorsPreset: 12 }), 'free');
    expect(s.left).toBe('0px');
    expect(s.right).toBe('0px');
    expect(s.top).toBe('100%');
    expect(s.bottom).toBe('0px');
  });

  it('explicit right anchor + offset (right-docked panel)', () => {
    const s = controlLayoutStyle(
      ctrl({ anchorLeft: 1, anchorTop: 0, anchorRight: 1, anchorBottom: 1, offsetLeft: -220 }),
      'free'
    );
    // left edge at parent-width - 220px
    expect(s.left).toBe('calc(100% + -220px)');
    expect(s.right).toBe('0px');
  });

  it('custom_minimum_size → min-width/height', () => {
    const s = controlLayoutStyle(ctrl({ anchorsPreset: 0, customMinimumSize: { x: 120, y: 40 } }), 'free');
    expect(s.minWidth).toBe('120px');
    expect(s.minHeight).toBe('40px');
  });

  it('visible=false → display none', () => {
    const s = controlLayoutStyle(ctrl({ visible: false }), 'free');
    expect(s.display).toBe('none');
  });
});

describe('controlLayoutStyle — container child', () => {
  it('column parent: vertical EXPAND → flex-grow 1', () => {
    const s = controlLayoutStyle(ctrl({ sizeFlagsVertical: 3 }), 'column'); // FILL|EXPAND
    expect(s.position).toBe('relative');
    expect(s.flexGrow).toBe(1);
  });

  it('column parent: no expand → flex-grow 0', () => {
    const s = controlLayoutStyle(ctrl({ sizeFlagsVertical: 1 }), 'column'); // FILL only
    expect(s.flexGrow).toBe(0);
  });

  it('EXPAND child: flex-grow follows size_flags_stretch_ratio (#12/#29)', () => {
    const s = controlLayoutStyle(
      ctrl({ sizeFlagsVertical: 3, sizeFlagsStretchRatio: 2 }), // FILL|EXPAND, ratio 2
      'column'
    );
    expect(s.flexGrow).toBe(2);
  });

  it('EXPAND child without ratio defaults flex-grow to 1', () => {
    const s = controlLayoutStyle(ctrl({ sizeFlagsVertical: 3 }), 'column');
    expect(s.flexGrow).toBe(1);
  });

  it('row parent: horizontal EXPAND grows, vertical FILL stretches cross-axis', () => {
    const s = controlLayoutStyle(ctrl({ sizeFlagsHorizontal: 2, sizeFlagsVertical: 1 }), 'row');
    expect(s.flexGrow).toBe(1);
    expect(s.alignSelf).toBe('stretch');
  });

  it('row parent: SHRINK_CENTER cross-axis → align-self center', () => {
    const s = controlLayoutStyle(ctrl({ sizeFlagsVertical: 4 }), 'row');
    expect(s.alignSelf).toBe('center');
  });

  it('row parent: SHRINK_END cross-axis → align-self flex-end', () => {
    const s = controlLayoutStyle(ctrl({ sizeFlagsVertical: 8 }), 'row');
    expect(s.alignSelf).toBe('flex-end');
  });

  it('column parent: explicit 0 size-flags (SHRINK_BEGIN) → align-self flex-start (shrink to content)', () => {
    const s = controlLayoutStyle(ctrl({ sizeFlagsHorizontal: 0 }), 'column');
    expect(s.alignSelf).toBe('flex-start');
  });
});
