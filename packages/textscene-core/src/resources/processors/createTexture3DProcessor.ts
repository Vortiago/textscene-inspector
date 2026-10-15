/**
 * Factory for creating 3D texture processors, the image3d slice's loader-facing adapter
 * (`resources/formats/image3d/`, ADR-0031). It cuts an image into the slices its **Import
 * sidecar** names, as Godot's layered importer does.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import type { DependencyGraph } from '../dependencyGraph';
import { decodeImagePixels, getMimeType, isTexturePath } from '../formats/image/textureProcessing';
import { sliceImage } from '../formats/image3d/texels';
import { dataTexture3D } from '../textures/dataTexture3D';
import { readImportSidecar } from './readImportSidecar';
import { importTexture3DSlices } from '../../parser/importParser';

export function createTexture3DProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  dependencies: DependencyGraph
): ResourceProcessor<THREE.Data3DTexture> {
  /** The slices the sidecar names, read first so a missing one costs no decode. */
  const slicesOf = async (path: string) => {
    const sidecar = await readImportSidecar(
      path,
      { busType: 'texture3d', key: path },
      fileEventBus,
      dependencies
    );
    const slices = importTexture3DSlices(sidecar);
    if (!slices) throw new Error(`${path} has no sidecar that imports it as a 3D texture`);
    return slices;
  };

  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'texture3d',
    readsFile: isTexturePath,
    shouldProcess: (_path, data) => data instanceof ArrayBuffer,
    process: async (path, data) => {
      const slices = await slicesOf(path);
      const image = await decodeImagePixels(
        data as ArrayBuffer,
        getMimeType(path),
        eventBus.getThreeManager()
      );
      const volume = sliceImage(image, slices);
      if (!volume) throw new Error(`${path} is too small for ${slices.horizontal}x${slices.vertical} slices`);
      const { texels, width, height, depth } = volume;
      return dataTexture3D(texels, width, height, depth, THREE.RGBAFormat);
    },
    dispose: (texture) => texture.dispose(),
  });
}
