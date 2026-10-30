/** Godot's editor preview environment, applied through the same layer an authored one uses (ADR-0025). */

import { EnvironmentLayer } from '../environment/EnvironmentLayer';
import { previewEnvironment } from './godotPreviewLighting';

export function PreviewEnvironment() {
  return <EnvironmentLayer {...previewEnvironment()} />;
}
