/**
 * Captures the warnings a call logs. Test-only: the `testing/` directories under `src` are excluded
 * from the build.
 */
import { setLogAdapter } from '../../logger';

/** The messages `run` logs at warn level. The logger has no adapter again afterwards. */
export function warningsOf(run: () => void): string[] {
  const warnings: string[] = [];
  const ignore = () => {};
  setLogAdapter({
    trace: ignore,
    debug: ignore,
    info: ignore,
    error: ignore,
    warn: (message) => {
      warnings.push(message);
    },
  });
  try {
    run();
  } finally {
    setLogAdapter(null);
  }
  return warnings;
}
