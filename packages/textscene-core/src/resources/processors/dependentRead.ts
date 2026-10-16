/** The read every processor makes of a file its asset's import needs, such as an **Import sidecar**. */

import type { FileEventBus } from '../FileEventBus';
import type { DependencyGraph, Dependent } from '../dependencyGraph';

/**
 * A read for the import of `assetPath`. `dependent` is recorded in `dependencies` as the file's
 * reader before the read, so a file created, edited or deleted later reloads it. With no file bus,
 * nothing is read.
 */
export interface DependentRead {
  assetPath: string;
  dependent: Dependent;
  fileEventBus: FileEventBus | undefined;
  dependencies: DependencyGraph;
}
