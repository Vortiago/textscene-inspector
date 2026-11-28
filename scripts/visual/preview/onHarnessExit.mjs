import { constants } from 'node:os';

const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const cleanups = new Set();

function onExit() {
  for (const cleanup of [...cleanups].reverse()) cleanup('exit');
}

async function onSignal(signal) {
  try {
    // The server closes before the lock allows another build to start.
    for (const cleanup of [...cleanups].reverse()) await cleanup(signal);
  } finally {
    process.exit(128 + constants.signals[signal]);
  }
}

/** @canonical Clean up harness resources in reverse acquisition order on exit or interruption */
export function onHarnessExit(cleanup) {
  if (!cleanups.size) {
    process.once('exit', onExit);
    for (const signal of signals) process.on(signal, onSignal);
  }
  cleanups.add(cleanup);
  return () => {
    if (!cleanups.delete(cleanup)) return false;
    if (!cleanups.size) {
      process.off('exit', onExit);
      for (const signal of signals) process.off(signal, onSignal);
    }
    return true;
  };
}
