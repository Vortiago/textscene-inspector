/**
 * GenericNodeFallback is NOT registered in nodeComponentRegistry —
 * it is rendered explicitly by the recursive dispatcher when
 * nodeComponentRegistry.get(typeName) returns undefined. Exporting
 * here keeps the import path consistent with the other node folders.
 */

export { GenericNodeFallback } from './Component';
