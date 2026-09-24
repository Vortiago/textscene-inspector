import type { SplitContainerProperties as SharedSplitContainerProperties } from '../shared/splitContainer';

/**
 * The base `SplitContainer` type's properties: the shared base plus `vertical`, authorable here
 * (`split_container.cpp:1299`, `ADD_PROPERTY(PropertyInfo(Variant::BOOL, "vertical"), ...)`).
 * HSplitContainer and VSplitContainer hide it (`split_container.cpp:840-843`'s `_validate_property`,
 * `is_fixed`), since their constructors fix it.
 */
export interface SplitContainerProperties extends SharedSplitContainerProperties {
  /** `SplitContainer::vertical` (`split_container.h:96`). Godot default `false`. */
  vertical?: boolean;
}
