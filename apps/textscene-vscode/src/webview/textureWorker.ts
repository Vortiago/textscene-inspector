/**
 * The webview's job worker script. `textureWorkerPlugin` bundles it, with the
 * jobs, into one string that the webview starts from a blob URL (ADR-0042).
 */
import { installWorkerJobs, type WorkerJobScope } from '@textscene/core/worker';

installWorkerJobs(self as unknown as WorkerJobScope);
