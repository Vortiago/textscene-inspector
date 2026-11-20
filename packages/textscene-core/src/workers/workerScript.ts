import { installWorkerJobs, type WorkerJobScope } from './workerEntry';

installWorkerJobs(self as unknown as WorkerJobScope);
