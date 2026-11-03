/**
 * Watches a procedural texture build from outside the app (ADR-0042): the long tasks
 * the page runs, the job workers it starts and their replies, and when the shell's
 * texture work status attaches and detaches. Everything installs through
 * `context.addInitScript`, as `cameraProbe.mjs` does, so no production file carries a hook.
 */

/* global window, document, MutationObserver */
// These globals exist only in the browser the init scripts are serialised into.

/** How often the wait for the status reads the probe. */
const STATE_POLL_MS = 100;

/**
 * Installed before the app's scripts run. Self-contained, since no closure over this
 * module survives `Function.prototype.toString` serialisation.
 */
export function installTextureWorkProbe(statusTestId) {
  const probe = {
    longTasks: [],
    statusAttached: [],
    statusDetached: [],
    workers: 0,
    replies: 0,
    replyTimes: [],
  };
  window.__textureWorkProbe = probe;

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      probe.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    }
  }).observe({ type: 'longtask', buffered: true });

  const NativeWorker = window.Worker;
  window.Worker = class ProbedWorker extends NativeWorker {
    constructor(...args) {
      super(...args);
      probe.workers += 1;
      // A reply that carries levels is a job the worker ran, not only one it was sent.
      this.addEventListener('message', (event) => {
        if (!event.data?.output?.levels) return;
        probe.replies += 1;
        probe.replyTimes.push(performance.now());
      });
    }
  };

  const selector = `[data-testid="${statusTestId}"]`;
  const isStatus = (node) =>
    node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector) !== null);
  // Each record, not the page's state after the batch: a status that attaches and detaches in
  // one batch leaves the page as it was, and a net-state probe would never see it.
  const observe = () => {
    new MutationObserver((records) => {
      for (const { addedNodes, removedNodes } of records) {
        for (const node of addedNodes) if (isStatus(node)) probe.statusAttached.push(performance.now());
        for (const node of removedNodes) if (isStatus(node)) probe.statusDetached.push(performance.now());
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) observe();
  else document.addEventListener('DOMContentLoaded', observe);
}

/** Holds the first job message a worker is sent for `delayMs`, as a slow build would. */
export function installWorkerDelay(delayMs) {
  const post = window.Worker.prototype.postMessage;
  let delayed = false;
  window.Worker.prototype.postMessage = function delayedPostMessage(...args) {
    if (delayed) return post.apply(this, args);
    delayed = true;
    setTimeout(() => post.apply(this, args), delayMs);
    return undefined;
  };
}

/**
 * Blocks the main thread for `stallMs` in the task that receives the first job reply, as
 * a main-thread build step after the reply would. Installed after the probe, so the probe
 * has seen the reply first.
 */
export function installReplyStall(stallMs) {
  const ProbedWorker = window.Worker;
  let stalled = false;
  window.Worker = class StallingWorker extends ProbedWorker {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', (event) => {
        if (stalled || !event.data?.output?.levels) return;
        stalled = true;
        const until = performance.now() + stallMs;
        while (performance.now() < until) {
          // Busy, on purpose: the stall is the point.
        }
      });
    }
  };
}

/** Refuses every worker, as a CSP without `worker-src` would, so jobs fall back in-thread. */
export function installWorkerBlock() {
  window.Worker = class BlockedWorker {
    constructor() {
      throw new Error('worker blocked by the long-task control');
    }
  };
}

/**
 * One line for a failed wait: what the status did, and whether a worker started and replied.
 * The three show a build that never started, one that never answered, and a status that stuck.
 */
export function describeTextureWorkState({ isShowing, probe }) {
  const { statusAttached, statusDetached, workers, replies, longTasks } = probe;
  const seen = `${workers} job worker${workers === 1 ? '' : 's'}, ${replies} replies, ${longTasks.length} long tasks`;
  if (statusAttached.length === 0) return `the status never attached (${seen})`;
  const counts = `the status attached ${statusAttached.length} time(s) and detached ${statusDetached.length}`;
  return `${counts}, and ${isShowing ? 'it still shows' : 'it is gone'} (${seen})`;
}

/**
 * Waits until the status has attached and detached the same number of times, at least once.
 * It polls on a timer, not on animation frames: the check reads recorded state and needs no
 * frame, and a frame waits on the GPU process. A timeout throws what the page saw
 * (`describeTextureWorkState`) and its load errors, not only that the time ran out.
 */
export async function waitForTextureWorkToClear(page, { statusTestId, timeoutMs, diagnostics }) {
  try {
    await page.waitForFunction(
      () => {
        const { statusAttached, statusDetached } = window.__textureWorkProbe;
        return statusAttached.length > 0 && statusDetached.length === statusAttached.length;
      },
      undefined,
      { timeout: timeoutMs, polling: STATE_POLL_MS }
    );
  } catch (error) {
    const state = await page.evaluate(
      (testId) => ({
        probe: window.__textureWorkProbe,
        isShowing: document.querySelector(`[data-testid="${testId}"]`) !== null,
      }),
      statusTestId
    );
    const loadErrors = [...diagnostics.consoleErrors, ...diagnostics.pageErrors].slice(0, 3);
    throw new Error(
      `texture work did not clear within ${timeoutMs} ms: ${describeTextureWorkState(state)}` +
        (loadErrors.length > 0 ? `; load errors: ${loadErrors.join(' | ')}` : ''),
      { cause: error }
    );
  }
}

/**
 * From the first time the status attached to the last time it detached, in page
 * milliseconds. Null when the status never showed or still shows: nothing to measure.
 */
function textureWorkWindow({ statusAttached, statusDetached }) {
  if (statusAttached.length === 0 || statusDetached.length < statusAttached.length) return null;
  return { start: Math.min(...statusAttached), end: Math.max(...statusDetached) };
}

/**
 * The long tasks over `limitMs` that start inside the texture work window, or null when
 * there is no window, so a gate cannot pass on a build it never saw. The task that
 * attaches the status starts before it: that task mounts the scene and only queues the
 * build, and every scene's boot runs such tasks, texture or not.
 */
export function longTasksDuringTextureWork(probe, limitMs) {
  const span = textureWorkWindow(probe);
  if (!span) return null;
  return probe.longTasks.filter(
    ({ startTime, duration }) => duration > limitMs && startTime >= span.start && startTime < span.end
  );
}

/**
 * The long tasks over `limitMs` that run from the first job reply until the status
 * clears, or null when no worker replied or there is no window. For a material that
 * arrives in its own file: it links its program in the moment its build starts, which
 * is the material showing, not the texture. Before the reply, the build is the worker's.
 * A task counts when it ends after the reply, so the task that received it counts too.
 */
export function longTasksAfterFirstReply(probe, limitMs) {
  const span = textureWorkWindow(probe);
  if (!span || probe.replyTimes.length === 0) return null;
  const firstReply = Math.min(...probe.replyTimes);
  return probe.longTasks.filter(
    ({ startTime, duration }) =>
      duration > limitMs && startTime + duration > firstReply && startTime < span.end
  );
}

/**
 * Runs `run` once, and once more when `isStalled` finds a stall in the first result;
 * returns the last result. A stall that comes twice is not runner noise.
 */
export async function runAgainIfStalled(run, isStalled) {
  const first = await run();
  return isStalled(first) ? run() : first;
}
