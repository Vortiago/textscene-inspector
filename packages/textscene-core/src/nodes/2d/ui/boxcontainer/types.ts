import type { BoxContainerProperties as SharedBoxContainerProperties } from '../shared/boxContainer';

/**
 * The base `BoxContainer` type's own properties: the shared Control +
 * `alignment` base, plus `vertical` itself — a real, authorable property on
 * this class (`box_container.cpp:380`, `ADD_PROPERTY(PropertyInfo(Variant::BOOL,
 * "vertical"), ...)`), unlike HBoxContainer/VBoxContainer, which hide it
 * (`box_container.cpp:293-297`'s `_validate_property`, `is_fixed`) because
 * their constructor already fixed it.
 */
export interface BoxContainerProperties extends SharedBoxContainerProperties {
  /** `BoxContainer::vertical` (`box_container.h:44`). Godot default `false`. */
  vertical?: boolean;
}
