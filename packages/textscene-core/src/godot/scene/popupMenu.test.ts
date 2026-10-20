import { describe, expect, it } from 'vitest';
import { OFFERED_SYSTEM_MENU_NAMES, SYSTEM_MENU_NAMES } from './popupMenu.js';

describe('SYSTEM_MENU_NAMES', () => {
  it('names the six menus by their constants (native_menu.h:59-66, 4.7.2 :61-68)', () => {
    expect(SYSTEM_MENU_NAMES).toEqual({
      0: 'INVALID_MENU_ID',
      1: 'MAIN_MENU_ID',
      2: 'APPLICATION_MENU_ID',
      3: 'WINDOW_MENU_ID',
      4: 'HELP_MENU_ID',
      5: 'DOCK_MENU_ID',
    });
  });
});

describe('OFFERED_SYSTEM_MENU_NAMES', () => {
  it('skips MAIN_MENU_ID, which the popup_menu.cpp:3262 hint leaves out', () => {
    expect(OFFERED_SYSTEM_MENU_NAMES).toEqual({
      0: 'INVALID_MENU_ID',
      2: 'APPLICATION_MENU_ID',
      3: 'WINDOW_MENU_ID',
      4: 'HELP_MENU_ID',
      5: 'DOCK_MENU_ID',
    });
  });
});
