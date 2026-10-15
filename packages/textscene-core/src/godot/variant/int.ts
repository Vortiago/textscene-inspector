/**
 * Variant to fixed-width integer, as the engine converts on a property write (`variant.h:360-377`).
 * `case INT` (`:367-368`) wraps int64 alike on every platform, so a diagnostic can name the stored
 * number. `case FLOAT` (`:369-370`) is undefined out of range, so it cannot ({@link asStoredInt}). The
 * width is a per-slot {@link IntWidth}, and the render path narrows too, so previewer and linter agree.
 */

export { toInt32, toUint32, toUint8, toInt16, INT32_MAX, readerLimitedInt } from './intWidth.js';
export type { IntWidth } from './intWidth.js';
export { parseGodotInt, storedFromFloat } from './intReader.js';
export {
  ruleInt,
  ruleCount,
  storedInt,
  storedVector2i,
  slotComponents,
  slotComponentsAltered,
} from './intSlots.js';
