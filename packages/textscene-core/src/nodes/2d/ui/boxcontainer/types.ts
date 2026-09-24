import type { BoxContainerProperties as SharedBoxContainerProperties } from '../shared/boxContainer';

/**
 * `BoxContainer`'s properties: the shared Control and `alignment` base, plus `vertical`
 * (`box_container.cpp:380`). HBoxContainer and VBoxContainer hide `vertical`
 * (`box_container.cpp:293-297`'s `_validate_property`, `is_fixed`).
 */
export interface BoxContainerProperties extends SharedBoxContainerProperties {
  /** `BoxContainer::vertical` (`box_container.h:44`). Godot default `false`. */
  vertical?: boolean;
}
