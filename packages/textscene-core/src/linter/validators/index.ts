/** Shared validator utilities for TSCN linting */

export * from './commonValidators.js';
export * from './vectorValidators.js';
export * from './physicsValidators.js';
export * from './resourceValidators.js';
export { propertyError } from './propertyError.js';
export { floatTupleValidator, makeFloatTupleRegex } from './floatTupleValidator.js';
export { v } from './v.js';
export type { FloatOpts, IntOpts, EnumOpts } from './v.js';
