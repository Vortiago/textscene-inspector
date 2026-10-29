/** `LoadedFile` and `LoadedFont` lookups for a test: a scene whose files none has loaded, and one with a record of them. */
import type { TscnInternalResource } from '../../parser/types';
import type { SceneResources } from '../../r3f/SceneResourcesContext';
import type { LoadedFile, LoadedFont } from '../scopedResource';

export const NO_FILES: LoadedFile = () => undefined;

export const NO_FONTS: LoadedFont = () => undefined;

export const loadedFilesOf =
  <T extends object>(files: Readonly<Record<string, T>>) =>
  (path: string): T | undefined =>
    files[path];

/** The pools of a scene that holds these sub-resources and no ext resources. */
export const poolsOf = (internalResources: readonly TscnInternalResource[]): SceneResources => ({
  internalResources,
  externalResources: [],
});
