/**
 * The one way to read a resource that a property names, from a scene or from a file (ADR-0071):
 * a reader names a reference and a kind, and gets a decoded value or why there is none. The
 * reference tables stay inside this module.
 */

export type { Follow, HeldResource, Read, ResourceKind, ResourceSnapshot, UnavailableReason } from './read';
export type { ScopedReference } from './scopedReference';
export { useNodeResource, useSnapshotRead } from './useNodeResource';
