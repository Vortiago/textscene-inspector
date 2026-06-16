/**
 * Factory for the generic `.tres` resource processor — fetches a Godot
 * resource file's text through the FileEventBus and parses it into a
 * `ParsedTresFile` (header type + ext/sub resources + [resource] body, raw
 * strings) on the previously-unused 'resource' bus slot. Consumers give the
 * parsed file meaning (e.g. the TileSet resolver); the pipeline only fetches
 * and parses the format. Coexists with the material processor on .tres paths:
 * each processor only handles paths it has in flight.
 */

import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { parseTresFile, type ParsedTresFile } from '../../parser/tresParser';

export function createTresResourceProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus
): ResourceProcessor<ParsedTresFile> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'resource',
    shouldProcess: (path, data) => path.endsWith('.tres') && typeof data === 'string',
    process: async (_path, data) => parseTresFile(data as string),
  });
}
