/**
 * Global setup of the real-Godot tests: fails the run on a host without the engine, so a host that
 * cannot render never reports the tests as skipped.
 */

import { engineMissingMessage, missingEngineTools } from './engineTools.mjs';

export default function requireEngine() {
  const missing = missingEngineTools();
  if (missing.length > 0) throw new Error(engineMissingMessage(missing));
}
