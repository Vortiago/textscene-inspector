/**
 * The messages between a page and a job worker. A request carries an id the
 * page chooses, and the reply echoes it, so one worker can serve jobs in turn.
 */

export interface WorkerJobRequest {
  id: number;
  job: string;
  input: unknown;
}

/** An error crosses as its name and message: a structured clone keeps no class. */
export interface WorkerJobError {
  name: string;
  message: string;
}

export type WorkerJobReply =
  { id: number; ok: true; output: unknown } | { id: number; ok: false; error: WorkerJobError };

/** The request in `data`, or null for a message that is not one. */
export function readJobRequest(data: unknown): WorkerJobRequest | null {
  if (typeof data !== 'object' || data === null) return null;
  const { id, job, input } = data as Record<string, unknown>;
  if (typeof id !== 'number' || typeof job !== 'string') return null;
  return { id, job, input };
}

export function toJobError(error: unknown): WorkerJobError {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'Error', message: String(error) };
}

/** The error a reply describes, rebuilt with its original class where it is a built-in one. */
export function fromJobError({ name, message }: WorkerJobError): Error {
  const error = name === 'RangeError' ? new RangeError(message) : new Error(message);
  error.name = name;
  return error;
}
