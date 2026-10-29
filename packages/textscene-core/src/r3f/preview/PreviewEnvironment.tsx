/** Godot's editor preview environment, applied through the same layer an authored one uses (ADR-0025). */

import { EnvironmentLayer, type EnvironmentLayerProps } from '../environment/EnvironmentLayer';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { previewEnvironment } from './godotPreviewLighting';

export function PreviewEnvironment() {
  return <EnvironmentLayer {...previewEnvironmentLayer()} />;
}

/** Written only by `previewEnvironmentLayer`. Never cleared, since the preview never changes. */
let previewLayer: EnvironmentLayerProps | undefined;

/**
 * The preview environment as its layer takes it. One object, so a pass that draws it publishes it
 * once. The preview environment and its sky hold no references.
 */
export function previewEnvironmentLayer(): EnvironmentLayerProps {
  return (previewLayer ??= { ...previewEnvironment(), resources: NO_RESOURCES, skyResources: NO_RESOURCES });
}
