/**
 * Factory for creating texture processors, the image slice's loader-facing
 * adapter (`resources/formats/image/`, ADR-0031). Stays here because the
 * `ResourceLoader` constructs it alongside its peer factories. It records on each
 * texture the texels, the format and the mip chain Godot's importer gives it, from the image's
 * **Import sidecar**.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import type { DependencyGraph } from '../dependencyGraph';
import { createTextureFromBuffer, getMimeType, isTexturePath } from '../formats/image/textureProcessing';
import { recordGodotFormat } from '../textures/sourceColorSpace';
import { dropMipChain } from '../textures/godotTextureFilter';
import { readImportSidecar } from './readImportSidecar';
import { importTextureOptions } from '../../parser/importParser';
import { imageSourceFormat } from '../../godot/import/imageSourceFormat.js';
import { textureImportFormat } from '../../godot/import/textureImport.js';

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
      const sidecar = await readImportSidecar(
        path,
        { busType: 'texture', key: path },
        fileEventBus,
        dependencies
      );
      const options = importTextureOptions(sidecar);
      const texture = await createTextureFromBuffer(
        bytes,
        mimeType,
        { source, options },
        eventBus.getThreeManager()
      );
      if (!options.mipmaps) dropMipChain(texture);
      return source === null ? texture : recordGodotFormat(texture, textureImportFormat(source, options));
    },
    dispose: (texture) => texture.dispose(),
  });
}
