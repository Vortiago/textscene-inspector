/**
 * The generic resource processor: a `.tres` or `.gdshader` file's text, or a binary resource's
 * bytes, through the FileEventBus into a `ParsedResource` (header type, ext/sub resources, raw
 * `[resource]` body) on the 'resource' bus slot. It is the one parse of a file: every slice that
 * decodes Godot text reads this slot's cache. An `.ogv` file reads to its picture size, not to RSRC.
 */

import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { GODOT_SHADER_EXTENSION } from '../../godot/project/resourceFormats';
import { parseShaderFile, parseTresFile, type ParsedResource } from '../../parser/parsedResource';
import { parseBinaryResource } from '../formats/binaryresource/parse';
import { parseTheoraVideo } from '../formats/theoravideo/parse';
import { fileExtension } from '../fileExtension';
import { THEORA_VIDEO_EXTENSION } from '../formats/theoravideo/parse';

export function createTresResourceProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus
): ResourceProcessor<ParsedResource> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'resource',
    // Every arrival, not `.tres` alone: a request this declines stays in flight, and a
    // peer waiting on it waits out its timeout. The parse fails other text at once.
    process: async (path, data) => {
      if (typeof data !== 'string') {
        return fileExtension(path) === THEORA_VIDEO_EXTENSION
          ? parseTheoraVideo(data)
          : parseBinaryResource(data);
      }
      return fileExtension(path) === GODOT_SHADER_EXTENSION ? parseShaderFile(data) : parseTresFile(data);
    },
  });
}
