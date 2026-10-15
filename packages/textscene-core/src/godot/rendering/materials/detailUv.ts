/** The UV set a BaseMaterial3D's detail layer samples. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::DetailUV` (`scene/resources/material.h:181-185`), as the integers a `.tscn`
 * stores for `detail_uv_layer`.
 */
export enum DetailUV {
  DETAIL_UV_1 = 0,
  DETAIL_UV_2 = 1,
}

/** Each layer's name by the integer a `.tscn` stores, as a validator names it. */
export const DETAIL_UV_NAMES = enumNamesByValue(DetailUV);
