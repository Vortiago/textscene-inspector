/**
 * The one answer to "does this resource property hold a resource", for the renderer's parsers and the
 * linter's rules alike.
 */

import { isNilLiteral } from '../variant/variantParser.js';

/**
 * Whether a resource property holds a resource. Absent, blank, `null` and `nil` all reach the `Ref<T>` setter
 * as an invalid Ref (`variant_parser.cpp:699`). Use this, not `!ref`: `'null'` is a truthy string.
 */
export function holdsResource(value: string | undefined): boolean {
  return !!value?.trim() && !isNilLiteral(value);
}
