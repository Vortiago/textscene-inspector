/**
 * Factory for creating texture array processors, the image2darray slice's loader-facing adapter
 * (`resources/formats/image2darray/`, ADR-0031). It cuts an OpenEXR or PNG image into the layers
 * its **Import sidecar** names, as Godot's layered importer does: the lightmap atlas is an
 * OpenEXR, and the shadowmask atlas a PNG (`lightmap_gi.cpp:857`).
 */

import type * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import type { DependencyGraph } from '../dependencyGraph';
import { resourceSliceRegistry } from '../sliceRegistration';
// The `.exr` claim `isOpenExr` reads, registered with the processor that serves it.
import '../formats/image2darray/index';
import { decodeExr } from '../formats/image2darray/exr';
import { decodeImagePixels, getMimeType, isTexturePath } from '../formats/image/textureProcessing';
import { dataArrayTexture } from '../textures/dataArrayTexture';
import { redOnly, sliceImage, type LayeredTexels } from '../textures/layeredTexels';
import type { ImportSlices } from '../../godot/import/layeredTextureImport';
import { readLayeredSlices } from './readLayeredSlices';
import { importTexture2DArraySlices } from '../../parser/importParser';

const isOpenExr = (path: string): boolean => resourceSliceRegistry.busTypeOfPath(path) === 'texture2darray';

/**
 * The layers of the image at `path`: RGBA half-float bits for an OpenEXR, else the red bytes of
 * its decoder, which is all a shadowmask reads. Null when a layer is empty.
 */
async function decodeLayers(
  path: string,
  data: ArrayBuffer,
  slices: ImportSlices,
  manager: THREE.LoadingManager
): Promise<LayeredTexels<Uint16Array | Uint8Array> | null> {
  if (isOpenExr(path)) return sliceImage(await decodeExr(data), slices);
  const layers = sliceImage(await decodeImagePixels(data, getMimeType(path), manager), slices);
  return layers && redOnly(layers);
}

export function createTexture2DArrayProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  dependencies: DependencyGraph
): ResourceProcessor<THREE.DataArrayTexture> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'texture2darray',
    readsFile: (path) => isOpenExr(path) || isTexturePath(path),
    shouldProcess: (_path, data) => data instanceof ArrayBuffer,
    process: async (path, data) => {
      const slices = await readLayeredSlices(
        { assetPath: path, dependent: { busType: 'texture2darray', key: path }, fileEventBus, dependencies },
        importTexture2DArraySlices,
        'a texture array'
      );
      const layers = await decodeLayers(path, data as ArrayBuffer, slices, eventBus.getThreeManager());
      if (!layers) throw new Error(`${path} is too small for ${slices.horizontal}x${slices.vertical} layers`);
      return dataArrayTexture(layers.texels, layers.width, layers.height, layers.depth);
    },
    dispose: (texture) => texture.dispose(),
  });
}
