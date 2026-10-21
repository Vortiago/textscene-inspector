import { describe, expect, it } from 'vitest';
import { defineIndexedFamily } from './indexedFamily.js';
import { OPTION_BUTTON_ITEMS, PROPERTY_LIST_FAMILIES, TAB_CONTAINER_TABS } from './propertyListFamilies.js';

describe('defineIndexedFamily', () => {
  const complete = {
    owner: 'Example',
    prefix: 'row_',
    indexParse: 'is_valid_int',
    countKey: { key: 'row_count', cite: 'example.cpp:1' },
    leaves: ['text'],
    outOfBounds: { policy: 'dropped', cite: 'property_list_helper.cpp:58' },
  } as const;

  it('accepts a family that states every field', () => {
    expect(defineIndexedFamily(complete)).toBe(complete);
  });

  it('refuses a family with no out-of-bounds policy', () => {
    const { outOfBounds: _outOfBounds, ...unbounded } = complete;
    // @ts-expect-error every family states its out-of-bounds policy
    defineIndexedFamily(unbounded);
  });

  it('refuses a family with no count key declaration', () => {
    const { countKey: _countKey, ...uncounted } = complete;
    // @ts-expect-error every family states its count key, or an explicit none
    defineIndexedFamily(uncounted);
  });

  it('refuses a none count key without its engine cite', () => {
    // @ts-expect-error a none states the cite that shows the class serialises no count
    defineIndexedFamily({ ...complete, countKey: { key: null } });
  });
});

describe('the PropertyListHelper families', () => {
  it('pins OptionButton as dropped, cited from the forwarded write and the helper', () => {
    expect(OPTION_BUTTON_ITEMS.outOfBounds.policy).toBe('dropped');
    expect(OPTION_BUTTON_ITEMS.outOfBounds.cite).toContain('option_button.cpp:168');
    expect(OPTION_BUTTON_ITEMS.outOfBounds.cite).toContain('property_list_helper.cpp:58');
  });

  it('pins TabContainer as assigned, with no count key', () => {
    expect(TAB_CONTAINER_TABS.outOfBounds.policy).toBe('assigned');
    expect(TAB_CONTAINER_TABS.outOfBounds.cite).toContain('tab_container.cpp:1294');
    expect(TAB_CONTAINER_TABS.countKey.key).toBeNull();
  });

  it('declares each family once per owner and prefix', () => {
    const identities = PROPERTY_LIST_FAMILIES.map((family) => `${family.owner} ${family.prefix}`);
    expect(new Set(identities).size).toBe(7);
  });
});
