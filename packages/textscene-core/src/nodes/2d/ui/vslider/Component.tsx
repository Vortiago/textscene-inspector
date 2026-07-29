/**
 * <VSlider> — a vertical track with the grabber at `value`'s position along it.
 * Godot measures a VSlider's travel from the BOTTOM, so `value = min_value`
 * (the default) puts the grabber at the bottom, not the top.
 */

import { createSliderComponent } from '../../../../r3f/controls/createSliderComponent';

export const VSlider = createSliderComponent({ typeName: 'VSlider', orientation: 'vertical' });
