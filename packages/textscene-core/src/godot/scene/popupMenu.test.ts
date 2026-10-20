import { describe, expect, it } from 'vitest';
import { OFFERED_SYSTEM_MENU_NAMES } from './popupMenu.js';

describe('OFFERED_SYSTEM_MENU_NAMES', () => {
  it('names the menus by their constants and skips MAIN_MENU_ID, which popup_menu.cpp:3262 leaves out (native_menu.h:59-66, 4.7.2 :61-68)', () => {
    expect(OFFERED_SYSTEM_MENU_NAMES).toEqual({
      0: 'INVALID_MENU_ID',
      2: 'APPLICATION_MENU_ID',
      3: 'WINDOW_MENU_ID',
      4: 'HELP_MENU_ID',
      5: 'DOCK_MENU_ID',
    });
  });
});
