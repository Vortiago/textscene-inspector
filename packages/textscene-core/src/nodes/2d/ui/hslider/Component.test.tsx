/**
 * HSlider render + registration contract. The distinguishing render fact is
 * that all four painted parts exist as addressable boxes — a slider that draws
 * only its track is indistinguishable from a plain dark rectangle on screen.
 * Geometry itself is pinned in `r3f/controls/sliderChrome.test.ts`; happy-dom
 * has no layout (ADR-0024), so nothing here asserts a rendered rect.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import './index'; // parser registration side effect
import './index.r3f'; // DOM-overlay component registration side effect
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { parseHSlider } from './parser';
import { HSlider } from './Component';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'HSlider', name: 'S' } };
function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'S', type: 'HSlider', children: [], properties: parseHSlider(heading, raw) };
}

describe('HSlider registration', () => {
  it('registers the parser under its type name', () => {
    const reg = nodeRegistry.getRegistration('HSlider');
    expect(reg).not.toBeNull();
    expect(reg!.parser).toBe(parseHSlider);
  });

  it('registers the DOM-overlay component in the control registry', () => {
    expect(controlComponentRegistry.get('HSlider')).toBe(HSlider);
  });
});

describe('HSlider render contract', () => {
  it('paints a track, a fill and a grabber', () => {
    const { container } = render(<HSlider node={node()} />);
    expect(container.querySelector('[data-slider-part="track"]')).not.toBeNull();
    expect(container.querySelector('[data-slider-part="fill"]')).not.toBeNull();
    expect(container.querySelector('[data-slider-part="grabber"]')).not.toBeNull();
  });

  it('paints no ticks without a tick_count, and one per interior tick with one', () => {
    const bare = render(<HSlider node={node({ ticks_on_borders: 'true' })} />);
    expect(bare.container.querySelectorAll('[data-slider-part="tick"]')).toHaveLength(0);
    bare.unmount();

    const ticked = render(<HSlider node={node({ tick_count: '5' })} />);
    expect(ticked.container.querySelectorAll('[data-slider-part="tick"]')).toHaveLength(3);
  });

  it('keeps a hidden slider hidden — its own styles must not overwrite display:none', () => {
    const { container } = render(<HSlider node={node({ visible: 'false' })} />);
    const root = container.querySelector('[data-control-type="HSlider"]') as HTMLElement;
    expect(root.style.display).toBe('none');
  });
});
