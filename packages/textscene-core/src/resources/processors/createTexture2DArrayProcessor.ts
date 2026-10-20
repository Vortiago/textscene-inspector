/**
 * Factory for creating texture array processors, the image2darray slice's loader-facing adapter
 * (`resources/formats/image2darray/`, ADR-0031). It cuts an OpenEXR image into the layers its
 * **Import sidecar** names, as Godot's layered importer does.
 */

import type * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import type { DependencyGraph } from '../dependencyGraph';
import { fileExtension } from '../fileExtension';
import { decodeExr } from '../formats/image2darray/exr';
import { dataArrayTexture } from '../textures/dataArrayTexture';
import { sliceImage } from '../textures/layeredTexels';
import { readImportSidecar } from './readImportSidecar';
import { importTexture2DArraySlices } from '../../parser/importParser';

const EXR_EXTENSION = '.exr';

export function createTexture2DArrayProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  dependencies: DependencyGraph
): ResourceProcessor<THREE.DataArrayTexture> {
  /** The layers the sidecar names, read first so a missing one costs no decode. */
  const slicesOf = async (path: string) => {
    const sidecar = await readImportSidecar({
      assetPath: path,
      dependent: { busType: 'texture2darray', key: path },
      fileEventBus,
      dependencies,
    });
    const slices = importTexture2DArraySlices(sidecar);
    if (!slices) throw new Error(`${path} has no sidecar that imports it as a texture array`);
    return slices;
  };

  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'texture2darray',
    readsFile: (path) => fileExtension(path) === EXR_EXTENSION,
    shouldProcess: (_path, data) => data instanceof ArrayBuffer,
    process: async (path, data) => {
      const slices = await slicesOf(path);
      const layers = sliceImage(await decodeExr(data as ArrayBuffer), slices);
      if (!layers) throw new Error(`${path} is too small for ${slices.horizontal}x${slices.vertical} layers`);
      return dataArrayTexture(layers.texels, layers.width, layers.height, layers.depth);
    },
    dispose: (texture) => texture.dispose(),
  });
}
