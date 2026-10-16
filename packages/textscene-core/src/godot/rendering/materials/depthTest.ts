/** The depth comparison a BaseMaterial3D tests with. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::DepthTest` (`scene/resources/material.h:243-247`), as the integers a `.tscn`
 * stores for `depth_test`. The default is DEFAULT (`material.h:604`).
 */
export enum DepthTest {
  DEFAULT = 0,
  INVERTED = 1,
}

export const DEPTH_TEST_NAMES = enumNamesByValue(DepthTest);
