/**
 * The DOM shape a SplitContainer produces. happy-dom has no layout, so these
 * assert the inline styles that produce it, never measured geometry
 * (AGENTS.md); `verify:2d` measures the boxes in a real browser and
 * `unit-split-container.tscn` pins the numbers against Godot.
 *
 * A SplitContainer is the one container whose children are NOT sized by their
 * own size flags: Godot's `_resort` hands each child a rect it computed
 * (`fit_child_in_rect`), so the sizing must land on the TRACK.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import type { TscnNode } from '../../../../parser/types';
import { ControlOverlay } from '../../../../r3f/controls/index';

function node(name: string, type: string, properties: object, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

const EXPAND_FILL = 3;

/** An HSplitContainer with two children carrying `childProps`. */
function tree(splitProps: object, first: object = {}, second: object = {}): TscnNode[] {
  return [
    node('Split', 'HSplitContainer', splitProps, [
      node('Left', 'ColorRect', { color: 'Color(1, 0, 0, 1)', ...first }),
      node('Right', 'ColorRect', { color: 'Color(0, 1, 0, 1)', ...second }),
    ]),
  ];
}

function split(container: HTMLElement, type = 'HSplitContainer'): HTMLElement {
  return container.querySelector<HTMLElement>(`[data-control-type="${type}"]`)!;
}

const BOTH_EXPAND = [
  { sizeFlagsHorizontal: EXPAND_FILL },
  { sizeFlagsHorizontal: EXPAND_FILL },
] as const;

describe('<HSplitContainer>', () => {
  it('declares its two rects as grid tracks on the split axis', () => {
    const { container } = render(<ControlOverlay nodes={tree({}, ...BOTH_EXPAND)} />);
    const el = split(container);
    expect(el.style.display).toBe('grid');
    // `computed_split_offset` then "everything left" — Godot's `w - sofs`.
    expect(el.style.gridTemplateColumns).toBe('calc(50% + -6px) 1fr');
    // The cross axis is the container's whole extent, unconditionally.
    expect(el.style.gridTemplateRows).toBe('100%');
  });

  it('renders both children, in tree order', () => {
    const { container } = render(<ControlOverlay nodes={tree({}, ...BOTH_EXPAND)} />);
    const names = Array.from(split(container).querySelectorAll('[data-node-name]')).map((e) =>
      e.getAttribute('data-node-name')
    );
    expect(names).toEqual(['Left', 'Right']);
  });

  it('neither expanded: the offset IS the first track', () => {
    const { container } = render(<ControlOverlay nodes={tree({ splitOffset: 120 })} />);
    expect(split(container).style.gridTemplateColumns).toBe('120px 1fr');
  });

  it('puts the separation between the tracks as a gap', () => {
    const { container } = render(<ControlOverlay nodes={tree({})} />);
    expect(split(container).style.gap).toBe('12px');
  });

  it('drops the gap for a HIDDEN_COLLAPSED dragger', () => {
    const { container } = render(<ControlOverlay nodes={tree({ draggerVisibility: 2 })} />);
    expect(split(container).style.gap).toBe('0px');
  });

  describe('Godot’s two-child reach', () => {
    /**
     * `_resort` reads `_get_sortable_child(0)` and `(1)` and nothing else, so a
     * third child is never given a rect. The implicit track it lands in is
     * zero-sized, and the container clips.
     */
    it('gives a third child no track of its own', () => {
      const three: TscnNode[] = [
        node('Split', 'HSplitContainer', {}, [
          node('A', 'ColorRect', {}),
          node('B', 'ColorRect', {}),
          node('C', 'ColorRect', {}),
        ]),
      ];
      const { container } = render(<ControlOverlay nodes={three} />);
      const el = split(container);
      expect(el.style.gridTemplateColumns).toBe('0px 1fr');
      expect(el.style.gridAutoColumns).toBe('0px');
      expect(el.style.overflow).toBe('hidden');
    });

    /** With one child Godot fits it to the WHOLE container — one track, no gap. */
    it('a lone child fills the container', () => {
      const one: TscnNode[] = [
        node('Split', 'HSplitContainer', {}, [node('Only', 'ColorRect', {})]),
      ];
      const { container } = render(<ControlOverlay nodes={one} />);
      expect(split(container).style.gridTemplateColumns).toBe('1fr');
      expect(split(container).style.gap).toBe('');
    });

    /**
     * A hidden child is not sortable. It is also `display: none`, which grid
     * does not place — so the visible child takes the sole track rather than
     * the leftovers of an invisible one.
     */
    it('skips a hidden child', () => {
      const { container } = render(<ControlOverlay nodes={tree({}, { visible: false })} />);
      expect(split(container).style.gridTemplateColumns).toBe('1fr');
      expect(
        container.querySelector<HTMLElement>('[data-node-name="Left"]')?.style.display
      ).toBe('none');
    });

    it('renders as itself when it has no children at all', () => {
      const none: TscnNode[] = [node('Split', 'HSplitContainer', {}, [])];
      const { container } = render(<ControlOverlay nodes={none} />);
      expect(split(container).style.gridTemplateColumns).toBe('1fr');
    });
  });

  describe('the child sits in the rect it was handed', () => {
    it('SIZE_FILL stretches to the whole track', () => {
      const { container } = render(<ControlOverlay nodes={tree({}, ...BOTH_EXPAND)} />);
      const left = container.querySelector<HTMLElement>('[data-node-name="Left"]')!;
      expect(left.style.justifySelf).toBe('stretch');
      expect(left.style.alignSelf).toBe('stretch');
    });

    it('a shrink flag places it instead of stretching it', () => {
      const { container } = render(
        <ControlOverlay
          nodes={tree({}, { sizeFlagsHorizontal: 4, sizeFlagsVertical: 8 })}
        />
      );
      const left = container.querySelector<HTMLElement>('[data-node-name="Left"]')!;
      expect(left.style.justifySelf).toBe('center');
      expect(left.style.alignSelf).toBe('end');
    });
  });
});

describe('<VSplitContainer>', () => {
  it('splits the ROW axis and reads the VERTICAL size flags', () => {
    const nodes: TscnNode[] = [
      node('Split', 'VSplitContainer', {}, [
        node('Top', 'ColorRect', { sizeFlagsVertical: EXPAND_FILL }),
        node('Bottom', 'ColorRect', { sizeFlagsVertical: EXPAND_FILL }),
      ]),
    ];
    const { container } = render(<ControlOverlay nodes={nodes} />);
    const el = split(container, 'VSplitContainer');
    expect(el.style.gridTemplateRows).toBe('calc(50% + -6px) 1fr');
    expect(el.style.gridTemplateColumns).toBe('100%');
  });

  it('ignores the HORIZONTAL flags — they do not claim the split axis', () => {
    const nodes: TscnNode[] = [
      node('Split', 'VSplitContainer', {}, [
        node('Top', 'ColorRect', { sizeFlagsHorizontal: EXPAND_FILL }),
        node('Bottom', 'ColorRect', { sizeFlagsHorizontal: EXPAND_FILL }),
      ]),
    ];
    const { container } = render(<ControlOverlay nodes={nodes} />);
    expect(split(container, 'VSplitContainer').style.gridTemplateRows).toBe('0px 1fr');
  });
});
