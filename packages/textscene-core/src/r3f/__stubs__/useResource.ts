/**
 * Temporary stub for useResource pending the resource-loading merge.
 * Always returns status: 'pending' so components render placeholder paths.
 *
 * When the real implementation lands, swap component imports from
 *   `../__stubs__/useResource`
 * to
 *   `../../resources/useResource`
 * (or whatever path impl-resource finalises).
 */

export type ResourceStatus = 'pending' | 'loaded' | 'missing' | 'error';

export type ResourceType = 'Texture2D' | 'StandardMaterial3D' | 'GLBMesh' | 'PackedScene';

export interface ResourceResult<T> {
  value: T | undefined;
  status: ResourceStatus;
  error?: string;
}

export function useResource<T>(_path: string, _type: ResourceType): ResourceResult<T> {
  return { value: undefined, status: 'pending' };
}
