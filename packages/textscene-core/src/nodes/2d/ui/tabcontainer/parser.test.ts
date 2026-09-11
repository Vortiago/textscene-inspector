import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseTabContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseTabContainer', () => {
  it('parses the scalar properties', () => {
    const p = parseTabContainer(h({ name: 'Tabs', type: 'TabContainer' }), {
      current_tab: '1',
      tab_alignment: '1',
      tabs_position: '1',
      clip_tabs: 'false',
      tabs_visible: 'false',
      all_tabs_in_front: 'true',
    });
    expect(p.currentTab).toBe(1);
    expect(p.tabAlignment).toBe(1);
    expect(p.tabsPosition).toBe(1);
    expect(p.clipTabs).toBe(false);
    expect(p.tabsVisible).toBe(false);
    expect(p.allTabsInFront).toBe(true);
  });

  it('parses tab_<idx>/title,icon,disabled,hidden into a SPARSE override map, keyed by index', () => {
    const p = parseTabContainer(h({ name: 'Tabs', type: 'TabContainer' }), {
      'tab_0/title': '"General"',
      'tab_2/title': '"Advanced"',
      'tab_2/icon': 'ExtResource("1")',
      'tab_2/disabled': 'true',
      'tab_1/hidden': 'true',
    });
    expect(p.tabOverrides).toEqual({
      0: { title: 'General' },
      2: { title: 'Advanced', icon: 'ExtResource("1")', disabled: true },
      1: { hidden: true },
    });
  });

  it('leaves tabOverrides undefined when no tab_<idx>/* key is present', () => {
    const p = parseTabContainer(h({ name: 'Empty', type: 'TabContainer' }), {});
    expect(p.tabOverrides).toBeUndefined();
  });

  it('reads a tab index the way PropertyListHelper resolves it (is_valid_int), not sequentially', () => {
    // property_list_helper.cpp:53-55: the gate is is_valid_int(), so `tab_00`
    // and `tab_+0` both resolve to index 0 — a later duplicate wins.
    const p = parseTabContainer(h({ name: 'Menu', type: 'TabContainer' }), {
      'tab_00/title': '"First"',
      'tab_+0/title': '"Second"',
    });
    expect(p.tabOverrides).toEqual({ 0: { title: 'Second' } });
  });

  it('drops a negative tab index — PropertyListHelper::_get_property refuses it (property_list_helper.cpp:58)', () => {
    const p = parseTabContainer(h({ name: 'Neg', type: 'TabContainer' }), {
      'tab_-1/title': '"Ghost"',
      'tab_3/title': '"Real"',
    });
    expect(p.tabOverrides).toEqual({ 3: { title: 'Real' } });
  });

  it('accepts an index far past any small child count — set_array_length_getter does not bound a WRITE (tab_container.cpp:1294)', () => {
    const p = parseTabContainer(h({ name: 'Sparse', type: 'TabContainer' }), {
      'tab_500/title': '"Late"',
    });
    expect(p.tabOverrides).toEqual({ 500: { title: 'Late' } });
  });
});
