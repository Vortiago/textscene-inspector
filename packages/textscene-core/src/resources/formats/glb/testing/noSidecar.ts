/** The load options of a GLB that has no import sidecar and whose file name names nothing. */
import { importGltfNaming } from '../../../../parser/importParser';
import type { GlbLoadOptions } from '../glbProcessing';

export const NO_SIDECAR: GlbLoadOptions = { naming: { ...importGltfNaming(null), fileName: '' } };
