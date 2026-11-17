import { PROJECT_FILE_PATH } from '../godot/project/project.js';
import { parseProjectSettings, type ProjectSettings } from '../parser/projectSettingsParser.js';
import * as logger from '../logger.js';
import type { FileEventBus } from './FileEventBus.js';

/** The settings of `res://project.godot`, or null where the project has none. */
export async function readProjectSettings(bus: FileEventBus): Promise<ProjectSettings | null> {
  const content = await bus.tryLoad(PROJECT_FILE_PATH, 'ProjectSettings');
  if (typeof content !== 'string') return null;
  const parsed = parseProjectSettings(content);
  if (parsed) {
    logger.info(`[ProjectSettings] Loaded ${Object.keys(parsed).length} settings from ${PROJECT_FILE_PATH}`);
  }
  return parsed;
}
