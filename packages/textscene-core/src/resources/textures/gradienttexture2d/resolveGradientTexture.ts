/**
 * Resolve a Texture2D-valued property that references an inline
 * `GradientTexture2D` sub-resource to a rasterised `THREE.DataTexture`.
 *
 * Unlike an `ExtResource` texture (an image file loaded asynchronously through
 * the resource pipeline), a `GradientTexture2D` is fully described inside the
 * scene: the texture block plus the `Gradient` block it references. So it
 * resolves synchronously, right where the material's texture slots are read —
 * no `useResource`/host-file round trip. Returns `null` for any other reference
 * form (ExtResource, a different SubResource type, a missing gradient), leaving
 * the caller's async path untouched.
 */

import type { TscnInternalResource } from '../../../parser/types';
import {
  findSubResource,
  parseResourceReference,
  resolveSubResourceRef,
} from '../../SubResourceResolver';
import { parseGradient, parseGradientTexture2D } from './parser';
import { rasterizeGradientTexture2D } from './renderer';
import type * as THREE from 'three';

export function resolveGradientTexture2D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;

  const textureResource = findSubResource(internalResources, parsed.id);
  if (!textureResource || textureResource.type !== 'GradientTexture2D') return null;

  const data = textureResource.data as Record<string, string>;
  const gradientResource = resolveSubResourceRef(data.gradient, internalResources);
  if (!gradientResource || gradientResource.type !== 'Gradient') return null;

  const texture = parseGradientTexture2D(data);
  const gradient = parseGradient(gradientResource.data as Record<string, string>);
  return rasterizeGradientTexture2D(texture, gradient);
}
