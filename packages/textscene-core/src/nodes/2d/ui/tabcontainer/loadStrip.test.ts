import { describe, expect, it } from 'vitest';
import { TAB_ALIGNMENT_CENTER, TAB_ALIGNMENT_LEFT, TAB_ALIGNMENT_RIGHT } from '../tabbar/nativeSolver';
import { resolveTabContainerStrip } from './loadStrip';

// Godot 4.6.3 TabContainer, six pages (Inventory, Equipment, Journal, Settings, Map, Quests), 16 px
// arrows, `side_margin` 8, no tabbar margins. The expected values are what the headless scene reports.
const PAGE_WIDTHS = [95, 105, 76, 82, 54, 74];
const SIDE_MARGIN = 8;

function load(containerWidthPx: number, alignment: number, currentTab: number, hidden: number[] = []) {
  const tabs = PAGE_WIDTHS.map((naturalWidth, i) => ({
    disabled: false,
    hidden: hidden.includes(i),
    naturalWidth,
    naturalTextWidth: 40,
  }));
  return resolveTabContainerStrip(
    tabs,
    {
      alignment,
      clipTabs: true,
      maxTabWidthPx: 0,
      tabSeparation: 0,
      incrementIconWidth: 16,
      decrementIconWidth: 16,
      currentTab,
      scrollToSelected: true,
    },
    { containerWidthPx, leftMarginPx: 0, rightMarginPx: 0, sideMarginPx: SIDE_MARGIN, rtl: false }
  );
}

describe('resolveTabContainerStrip with hidden pages', () => {
  it.each([
    { hidden: [0], currentTab: 2, containerWidthPx: 200, alignment: TAB_ALIGNMENT_LEFT, offset: 2 },
    { hidden: [1], currentTab: 5, containerWidthPx: 292, alignment: TAB_ALIGNMENT_CENTER, offset: 3 },
    { hidden: [0, 1], currentTab: 4, containerWidthPx: 232, alignment: TAB_ALIGNMENT_CENTER, offset: 1 },
    { hidden: [2, 3], currentTab: 5, containerWidthPx: 200, alignment: TAB_ALIGNMENT_LEFT, offset: 2 },
    { hidden: [3], currentTab: 5, containerWidthPx: 192, alignment: TAB_ALIGNMENT_CENTER, offset: 3 },
  ])(
    'starts at tab $offset for hidden $hidden, current $currentTab, container $containerWidthPx',
    ({ hidden, currentTab, containerWidthPx, alignment, offset }) => {
      expect(load(containerWidthPx, alignment, currentTab, hidden).offset).toBe(offset);
    }
  );
});

describe('resolveTabContainerStrip with RIGHT alignment', () => {
  it('reclaims side_margin when the tabs overflow, so the bar is the container wide', () => {
    expect(load(150, TAB_ALIGNMENT_RIGHT, 2)).toMatchObject({ barWidthPx: 150, offset: 2, sideMarginPx: 0 });
  });

  it('keeps the reclaim when the first page is hidden', () => {
    expect(load(150, TAB_ALIGNMENT_RIGHT, 2, [0])).toMatchObject({
      barWidthPx: 150,
      offset: 2,
      sideMarginPx: 0,
    });
  });

  it('keeps side_margin when the visible tabs fit', () => {
    expect(load(400, TAB_ALIGNMENT_RIGHT, 0, [1])).toMatchObject({
      barWidthPx: 392,
      offset: 0,
      sideMarginPx: SIDE_MARGIN,
    });
  });

  it('keeps side_margin when the container is wider than every tab', () => {
    expect(load(520, TAB_ALIGNMENT_RIGHT, 0).barWidthPx).toBe(512);
  });
});
