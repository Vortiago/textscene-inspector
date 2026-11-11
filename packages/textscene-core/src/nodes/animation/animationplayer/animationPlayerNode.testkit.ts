/** An AnimationPlayer `TscnNode` at Godot's defaults, for a test that mounts the component by hand. */

import { AnimationCallbackModeMethod, AnimationCallbackModeProcess } from '../../../godot/scene/animation';
import type { TscnNode } from '../../../parser/types';
import type { AnimationLibraryRef, AnimationPlayerProperties } from './types';

/** The default library, as a scene whose AnimationLibrary sub-resource has the id `Lib` references it. */
export const LIB_LIBRARY: AnimationLibraryRef[] = [{ name: '', subResourceId: 'Lib' }];

export function animationPlayerNode(overrides: Partial<AnimationPlayerProperties> = {}): TscnNode {
  const properties: AnimationPlayerProperties = {
    name: 'AnimationPlayer',
    speed_scale: 1.0,
    playback_default_blend_time: 0.0,
    callback_mode_process: AnimationCallbackModeProcess.IDLE,
    callback_mode_method: AnimationCallbackModeMethod.DEFERRED,
    active: true,
    autoplay: '',
    current_animation: '',
    current_animation_length: 0.0,
    current_animation_position: 0.0,
    root_node: 'NodePath("..")',
    libraries: [],
    ...overrides,
  };
  return {
    rawProperties: {},
    name: properties.name ?? 'AnimationPlayer',
    type: 'AnimationPlayer',
    children: [],
    properties,
  };
}
