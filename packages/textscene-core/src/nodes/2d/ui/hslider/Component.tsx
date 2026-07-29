/**
 * <HSlider> — a horizontal track with the grabber at `value`'s position along
 * it. `value = min_value` (the Godot default) puts the grabber at the LEFT and
 * leaves only the `grabber_area` stub filled behind it.
 */

import { createSliderComponent } from '../../../../r3f/controls/createSliderComponent';

export const HSlider = createSliderComponent({ typeName: 'HSlider', orientation: 'horizontal' });
