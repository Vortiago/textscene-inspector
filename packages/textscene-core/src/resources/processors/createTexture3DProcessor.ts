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
import { sliceImage } from '../textures/layeredTexels';
import { dataTexture3D } from '../textures/dataTexture3D';
import { readLayeredSlices } from './readLayeredSlices';
import { importTexture3D } from '../../parser/importParser';
import { volumeMipChain, type VolumeLevel } from '../processing/volumeMipChain';

export function createTexture3DProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  dependencies: DependencyGraph
): ResourceProcessor<THREE.Data3DTexture> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'texture3d',
    readsFile: isTexturePath,
    shouldProcess: (_path, data) => data instanceof ArrayBuffer,
    process: async (path, data) => {
      const { slices, hasMipmaps } = await readLayeredSlices(
        { assetPath: path, dependent: { busType: 'texture3d', key: path }, fileEventBus, dependencies },
        importTexture3D,
        'a 3D texture'
      );
      const image = await decodeImagePixels(
        data as ArrayBuffer,
        getMimeType(path),
        eventBus.getThreeManager()
      );
      const volume = sliceImage(image, slices);
      if (!volume) throw new Error(`${path} is too small for ${slices.horizontal}x${slices.vertical} slices`);
      const { texels, width, height, depth } = volume;
      const texture = dataTexture3D(texels, width, height, depth, THREE.RGBAFormat);
      if (hasMipmaps) texture.mipmaps = withMipmaps({ data: texels, width, height, depth });
      return texture;
    },
    dispose: (texture) => texture.dispose(),
  });
}

/** `base` and the levels the layered importer generates below it, as three reads `Texture.mipmaps`. */
function withMipmaps(base: VolumeLevel): VolumeLevel[] {
  return [base, ...volumeMipChain(base)];
}
