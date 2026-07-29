/**
 * VSlider render + registration contract. The one fact that separates it from
 * HSlider is the axis its grabber travels along: Godot places a VSlider's
 * grabber at `size.height - ratio * areasize - grabber_height`, i.e. bottom-up,
 * so the CSS must anchor `bottom` and never `left`. Geometry values are pinned
 * in `r3f/controls/sliderChrome.test.ts`; happy-dom has no layout (ADR-0024).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import './index'; // parser registration side effect
import './index.r3f'; // DOM-overlay component registration side effect
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { parseVSlider } from './parser';
import { VSlider } from './Component';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'VSlider', name: 'S' } };
function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'S', type: 'VSlider', children: [], properties: parseVSlider(heading, raw) };
}

describe('VSlider registration', () => {
  it('registers the parser under its type name', () => {
    const reg = nodeRegistry.getRegistration('VSlider');
    expect(reg).not.toBeNull();
    expect(reg!.parser).toBe(parseVSlider);
  });

  it('registers the DOM-overlay component in the control registry', () => {
    expect(controlComponentRegistry.get('VSlider')).toBe(VSlider);
  });
});

describe('VSlider render contract', () => {
  it('paints a track, a fill and a grabber', () => {
    const { container } = render(<VSlider node={node()} />);
    expect(container.querySelector('[data-slider-part="track"]')).not.toBeNull();
    expect(container.querySelector('[data-slider-part="fill"]')).not.toBeNull();
    expect(container.querySelector('[data-slider-part="grabber"]')).not.toBeNull();
  });

  it('anchors the grabber from the BOTTOM, never the top', () => {
    // At the default value = min_value the offset is a plain length, which is
    // the most happy-dom's CSS value parser will keep — the `calc()` forms the
    // component emits at other ratios are pinned in sliderChrome.test.ts.
    const { container } = render(<VSlider node={node()} />);
    const grabber = container.querySelector('[data-slider-part="grabber"]') as HTMLElement;
    expect(grabber.style.bottom).toBe('1px');
    expect(grabber.style.top).toBe('');
  });

  it('keeps a hidden slider hidden — its own styles must not overwrite display:none', () => {
    const { container } = render(<VSlider node={node({ visible: 'false' })} />);
    const root = container.querySelector('[data-control-type="VSlider"]') as HTMLElement;
    expect(root.style.display).toBe('none');
  });
});
