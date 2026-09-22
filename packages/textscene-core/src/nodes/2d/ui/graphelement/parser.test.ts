import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseGraphElement } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseGraphElement', () => {
  it('parses the six own members', () => {
    const p = parseGraphElement(h({ name: 'G', type: 'GraphElement' }), {
      position_offset: 'Vector2(120, 40)',
      resizable: 'true',
      draggable: 'false',
      selectable: 'true',
      selected: 'true',
      scaling_menus: 'true',
    });
    expect(p.positionOffset).toEqual({ x: 120, y: 40 });
    expect(p.resizable).toBe(true);
    expect(p.draggable).toBe(false);
    expect(p.selectable).toBe(true);
    expect(p.selected).toBe(true);
    expect(p.scalingMenus).toBe(true);
  });

  it('leaves every member undefined when absent', () => {
    const p = parseGraphElement(h({ name: 'G', type: 'GraphElement' }), {});
    expect(p.positionOffset).toBeUndefined();
    expect(p.resizable).toBeUndefined();
    expect(p.draggable).toBeUndefined();
    expect(p.selectable).toBeUndefined();
    expect(p.selected).toBeUndefined();
    expect(p.scalingMenus).toBeUndefined();
  });

  it('forces selected=false when selectable=false, regardless of an authored selected=true', () => {
    // graph_element.cpp:205-210 — GraphElement::set_selectable(false) calls
    // set_selected(false) unconditionally, whatever load order gave `selected`.
    const p = parseGraphElement(h({ name: 'G', type: 'GraphElement' }), {
      selectable: 'false',
      selected: 'true',
    });
    expect(p.selectable).toBe(false);
    expect(p.selected).toBe(false);
  });
});
