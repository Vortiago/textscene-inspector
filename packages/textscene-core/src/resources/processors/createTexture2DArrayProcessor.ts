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
import { resourceSliceRegistry } from '../sliceRegistration';
// The claim `readsFile` reads, registered with the processor that serves it.
import '../formats/image2darray/index';
import { decodeExr } from '../formats/image2darray/exr';
import { dataArrayTexture } from '../textures/dataArrayTexture';
import { sliceImage } from '../textures/layeredTexels';
import { readLayeredSlices } from './readLayeredSlices';
import { importTexture2DArraySlices } from '../../parser/importParser';

export function createTexture2DArrayProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  dependencies: DependencyGraph
): ResourceProcessor<THREE.DataArrayTexture> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'texture2darray',
    readsFile: (path) => resourceSliceRegistry.busTypeOfPath(path) === 'texture2darray',
    shouldProcess: (_path, data) => data instanceof ArrayBuffer,
    process: async (path, data) => {
      const slices = await readLayeredSlices(
        { assetPath: path, dependent: { busType: 'texture2darray', key: path }, fileEventBus, dependencies },
        importTexture2DArraySlices,
        'a texture array'
      );
      const layers = sliceImage(await decodeExr(data as ArrayBuffer), slices);
      if (!layers) throw new Error(`${path} is too small for ${slices.horizontal}x${slices.vertical} layers`);
      return dataArrayTexture(layers.texels, layers.width, layers.height, layers.depth);
    },
    dispose: (texture) => texture.dispose(),
  });
}
