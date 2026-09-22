import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseTabBar } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseTabBar', () => {
  it('parses tab_count + tab_N/title,icon,disabled and the scalar properties', () => {
    const p = parseTabBar(h({ name: 'Tabs', type: 'TabBar' }), {
      tab_count: '3',
      'tab_0/title': '"General"',
      'tab_1/title': '"Advanced"',
      'tab_1/icon': 'ExtResource("1")',
      'tab_2/title': '"Locked"',
      'tab_2/disabled': 'true',
      current_tab: '1',
      tab_alignment: '1',
      clip_tabs: 'false',
    });
    expect(p.tabs?.map((t) => t.title)).toEqual(['General', 'Advanced', 'Locked']);
    expect(p.tabs?.[1]?.icon).toBe('ExtResource("1")');
    expect(p.tabs?.[2]?.disabled).toBe(true);
    expect(p.currentTab).toBe(1);
    expect(p.tabAlignment).toBe(1);
    expect(p.clipTabs).toBe(false);
  });

  it('leaves scalars and tabs undefined when absent (drawing side applies Godot defaults)', () => {
    const p = parseTabBar(h({ name: 'Empty', type: 'TabBar' }), {});
    expect(p.tabs).toBeUndefined();
    expect(p.currentTab).toBeUndefined();
    expect(p.clipTabs).toBeUndefined();
  });

  it('keeps tabs DENSE when a tab omits its title, so current_tab stays aligned', () => {
    const p = parseTabBar(h({ name: 'Sparse', type: 'TabBar' }), {
      tab_count: '2',
      // tab 0 omits title/tooltip (blank leaf defaults)
      'tab_1/title': '"Second"',
      current_tab: '1',
    });
    expect(p.tabs).toHaveLength(2);
    expect(p.tabs?.[0]).toEqual({ title: '', tooltip: '', disabled: false });
    expect(p.tabs?.[p.currentTab!]?.title).toBe('Second');
  });

  it('reads a tab index the way PropertyListHelper resolves it (is_valid_int, not left-to-right)', () => {
    // property_list_helper.cpp:53-55: the gate is is_valid_int(), so `tab_00`
    // and `tab_+0` both resolve to index 0.
    const p = parseTabBar(h({ name: 'Menu', type: 'TabBar' }), {
      tab_count: '1',
      'tab_00/title': '"Only"',
    });
    expect(p.tabs?.[0]?.title).toBe('Only');
  });

  it('drops a negative tab index — PropertyListHelper::_get_property refuses it (property_list_helper.cpp:58)', () => {
    const p = parseTabBar(h({ name: 'Neg', type: 'TabBar' }), {
      tab_count: '1',
      'tab_-1/title': '"Ghost"',
      'tab_0/title': '"Real"',
    });
    expect(p.tabs).toHaveLength(1);
    expect(p.tabs?.[0]?.title).toBe('Real');
  });
});
