/**
 * MenuButton as a Button. `menu_button.cpp` overrides neither `get_minimum_size` nor
 * `NOTIFICATION_DRAW`, so it sizes and draws as a Button, with the items of its own theme type.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { BUTTON_CLASS, buttonMinimumSizeOf } from '../button/nativeSolver';

/** `menu_button.cpp` does not override `get_minimum_size`, so MenuButton sizes as its Button base does. */
export const menuButtonMinimumSize: MinimumSizeFn = buttonMinimumSizeOf(BUTTON_CLASS);
