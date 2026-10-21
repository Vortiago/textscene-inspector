import { describe, expect, it } from 'vitest';
import { defineIndexedFamily } from './indexedFamily.js';
import * as declarations from './propertyListFamilies.js';
import { OPTION_BUTTON_ITEMS, TAB_CONTAINER_TABS } from './propertyListFamilies.js';

describe('defineIndexedFamily', () => {
  const complete = {
    owner: 'Example',
    prefix: 'row_',
    indexParse: 'is_valid_int',
    countKey: { key: 'row_count' },
    outOfBounds: { policy: 'dropped', at: 'property_list_helper.cpp:58' },
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
  it('pins OptionButton as dropped, grounded at the popup helper its write forwards to', () => {
    expect(OPTION_BUTTON_ITEMS.outOfBounds).toEqual({ policy: 'dropped', at: 'property_list_helper.cpp:58' });
  });

  it('pins TabContainer as assigned, with no count key', () => {
    expect(TAB_CONTAINER_TABS.outOfBounds).toEqual({ policy: 'assigned', at: 'tab_container.cpp:1294' });
    expect(TAB_CONTAINER_TABS.countKey.key).toBeNull();
  });

  it('declares each family once per owner and prefix', () => {
    const identities = Object.values(declarations).map((family) => `${family.owner} ${family.prefix}`);
    expect(new Set(identities).size).toBe(7);
  });
});
