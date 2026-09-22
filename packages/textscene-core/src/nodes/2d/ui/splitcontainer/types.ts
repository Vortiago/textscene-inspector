import type { SplitContainerProperties as SharedSplitContainerProperties } from '../shared/splitContainer';

/**
 * The base `SplitContainer` type's own properties: the shared Control +
 * `split_offset`/`collapsed`/`dragger_visibility` base, plus `vertical`
 * itself — a real, authorable property on this class
 * (`split_container.cpp:1299`, `ADD_PROPERTY(PropertyInfo(Variant::BOOL,
 * "vertical"), ...)`), unlike HSplitContainer/VSplitContainer, which hide it
 * (`split_container.cpp:840-843`'s `_validate_property`, `is_fixed`) because
 * their constructor already fixed it.
 */
export interface SplitContainerProperties extends SharedSplitContainerProperties {
  /** `SplitContainer::vertical` (`split_container.h:96`). Godot default `false`. */
  vertical?: boolean;
}
