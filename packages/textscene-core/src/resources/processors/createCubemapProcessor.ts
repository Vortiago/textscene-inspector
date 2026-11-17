import type * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import type { DependencyGraph } from '../dependencyGraph';
import { decodeImagePixels, getMimeType, isTexturePath } from '../formats/image/textureProcessing';
import { sliceImage } from '../textures/layeredTexels';
import { cubeTexture } from '../textures/cubemap/cubeTexture';
import { importCubemap } from '../../parser/importParser';
import { readImportSidecar } from './readImportSidecar';

/** Cuts an image into the six faces its **Import sidecar** arranges, as Godot's layered importer does. */
export function createCubemapProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  dependencies: DependencyGraph
): ResourceProcessor<THREE.CubeTexture> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'cubemap',
    readsFile: isTexturePath,
    shouldProcess: (_path, data) => data instanceof ArrayBuffer,
    process: async (path, data) => {
      const read = {
        assetPath: path,
        dependent: { busType: 'cubemap' as const, key: path },
        fileEventBus,
        dependencies,
      };
      const cubemap = importCubemap(await readImportSidecar(read));
      if (!cubemap) throw new Error(`${path} has no sidecar that imports it as a cubemap`);
      const image = await decodeImagePixels(
        data as ArrayBuffer,
        getMimeType(path),
        eventBus.getThreeManager()
      );
      const faces = sliceImage(image, cubemap.slices);
      const cube = faces && cubeTexture(faces, cubemap.hasMipmaps);
      if (!cube)
        throw new Error(
          `${path} is too small for six faces of ${cubemap.slices.horizontal}x${cubemap.slices.vertical}`
        );
      return cube;
    },
    dispose: (texture) => texture.dispose(),
  });
}
