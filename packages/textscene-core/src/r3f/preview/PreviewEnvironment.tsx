/** Godot's editor preview environment, applied through the same layer an authored one uses (ADR-0025). */

import { EnvironmentLayer } from '../environment/EnvironmentLayer';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { previewEnvironment } from './godotPreviewLighting';

export function PreviewEnvironment() {
  const { settings, sky } = previewEnvironment();
  // The preview sky holds no references.
  return <EnvironmentLayer settings={settings} sky={sky} skyResources={NO_RESOURCES} />;
}
