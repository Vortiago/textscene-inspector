/**
 * Factory for creating texture processors, the image slice's loader-facing
 * adapter (`resources/formats/image/`, ADR-0031). Stays here because the
 * `ResourceLoader` constructs it alongside its peer factories. It hands the slice the image's
 * **Import sidecar**, which decides the texels, the format and the mip chain.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import type { DependencyGraph } from '../dependencyGraph';
import { createTextureFromBuffer, getMimeType, isTexturePath } from '../formats/image/textureProcessing';
import { readImportSidecar } from './readImportSidecar';
import { readRoughnessNormal } from './readRoughnessNormal';
import type { DependentRead } from './dependentRead';
import { importTextureOptions } from '../../parser/importParser';
import { imageSourceFormat } from '../../godot/import/imageSourceFormat.js';

export function createTextureProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  /** Records the texture's read of its sidecar, so a sidecar edit reloads the texture. */
  dependencies: DependencyGraph
): ResourceProcessor<THREE.Texture> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'texture',
    readsFile: isTexturePath,
    shouldProcess: (_path, data) => data instanceof ArrayBuffer,
    process: async (path, data) => {
      const bytes = data as ArrayBuffer;
      const mimeType = getMimeType(path);
      const source = imageSourceFormat(new Uint8Array(bytes), mimeType);
      const read: DependentRead = {
        assetPath: path,
        dependent: { busType: 'texture', key: path },
        fileEventBus,
        dependencies,
      };
      const options = importTextureOptions(await readImportSidecar(read));
      const manager = eventBus.getThreeManager();
      const roughnessNormal = await readRoughnessNormal({ ...read, options, manager });
      return createTextureFromBuffer(bytes, mimeType, { source, options, roughnessNormal }, manager);
    },
    dispose: (texture) => texture.dispose(),
  });
}
