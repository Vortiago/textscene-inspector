/**
 * The web previewer's job worker script. Vite bundles it, with the jobs, into one
 * inline blob (`?worker&inline`), so starting it fetches nothing (ADR-0042).
 */
import { installWorkerJobs, type WorkerJobScope } from '@textscene/core/worker';

installWorkerJobs(self as unknown as WorkerJobScope);
