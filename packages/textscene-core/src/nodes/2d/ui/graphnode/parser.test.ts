import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseGraphNode } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseGraphNode', () => {
  it('parses title, ignore_invalid_connection_type, slots_focus_mode and a slot', () => {
    const p = parseGraphNode(h({ name: 'N', type: 'GraphNode' }), {
      title: '"My Title"',
      ignore_invalid_connection_type: 'true',
      slots_focus_mode: '2',
      'slot/0/left_enabled': 'true',
      'slot/0/left_type': '1',
      'slot/0/left_color': 'Color(1, 0, 0, 1)',
      'slot/0/right_enabled': 'true',
    });
    expect(p.title).toBe('My Title');
    expect(p.ignoreInvalidConnectionType).toBe(true);
    expect(p.slotsFocusMode).toBe(2);
    expect(p.slots.get(0)).toEqual({
      leftEnabled: true,
      leftType: 1,
      leftColor: { r: 1, g: 0, b: 0, a: 1 },
      rightEnabled: true,
      rightType: 0,
      rightColor: { r: 1, g: 1, b: 1, a: 1 },
      drawStylebox: true,
    });
  });

  it('leaves title/ignore_invalid_connection_type/slots_focus_mode undefined and slots empty when absent', () => {
    const p = parseGraphNode(h({ name: 'N', type: 'GraphNode' }), {});
    expect(p.title).toBeUndefined();
    expect(p.ignoreInvalidConnectionType).toBeUndefined();
    expect(p.slotsFocusMode).toBeUndefined();
    expect(p.slots.size).toBe(0);
  });

  it('erases a slot authoring only draw_stylebox=false — graph_node.cpp:708-713 tests every leaf but draw_stylebox', () => {
    const p = parseGraphNode(h({ name: 'N', type: 'GraphNode' }), {
      'slot/0/draw_stylebox': 'false',
    });
    expect(p.slots.has(0)).toBe(false);
  });

  it('an index resolved via to_int (non-numeric text -> 0), matching graph_node.cpp:45', () => {
    const p = parseGraphNode(h({ name: 'N', type: 'GraphNode' }), {
      'slot/abc/left_enabled': 'true',
    });
    expect(p.slots.get(0)?.leftEnabled).toBe(true);
  });

  it('drops a negative slot index — set_slot refuses it (graph_node.cpp:706)', () => {
    const p = parseGraphNode(h({ name: 'N', type: 'GraphNode' }), {
      'slot/-1/left_enabled': 'true',
    });
    expect(p.slots.size).toBe(0);
  });

  it('a later write in file order re-creates an erased slot at Slot()s own defaults', () => {
    const p = parseGraphNode(h({ name: 'N', type: 'GraphNode' }), {
      // erases slot 0 (draw_stylebox is not tested by the erase condition)
      'slot/0/draw_stylebox': 'false',
      // then re-creates it from a fresh Slot() default: drawStylebox is true again
      'slot/0/left_enabled': 'true',
    });
    expect(p.slots.get(0)).toEqual({
      leftEnabled: true,
      leftType: 0,
      leftColor: { r: 1, g: 1, b: 1, a: 1 },
      rightEnabled: false,
      rightType: 0,
      rightColor: { r: 1, g: 1, b: 1, a: 1 },
      drawStylebox: true,
    });
  });

  it('stores a left_icon/right_icon resource-ref token raw', () => {
    const p = parseGraphNode(h({ name: 'N', type: 'GraphNode' }), {
      'slot/0/left_enabled': 'true',
      'slot/0/left_icon': 'ExtResource("1_abc")',
    });
    expect(p.slots.get(0)?.leftIcon).toBe('ExtResource("1_abc")');
  });
});
