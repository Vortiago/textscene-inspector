/** A long task under this is a frame's ordinary work, so neither a line nor the summary shows it. */
const NOTABLE_TASK_MS = 1000;

/** Whether `event` gets a line of its own: every event but an ordinary frame's long task. */
export function isPrinted(event) {
  return event.kind !== 'long-task' || event.ms >= NOTABLE_TASK_MS;
}

/** The line of one recorded event. */
export function eventLine(event) {
  switch (event.kind) {
    case 'navigate':
      return `${event.at} ms navigate ${event.search}`;
    case 'canvas':
      return `${event.at} ms canvas inserted`;
    case 'load':
      return `${event.at} ms load`;
    case 'first-draw':
      return `${event.at} ms first draw ${event.ms} ms, shader lengths ${event.shaderLengths.join(' + ')}`;
    case 'long-task':
      return `${event.at} ms main-thread task ${event.ms} ms from ${event.from} ms`;
    default:
      throw new Error(`expected a recorded load-timing event, got kind ${event.kind}`);
  }
}

/** The events since one navigation, which `summary` reads. A navigation starts a new load. */
export class LoadTimeline {
  #events = [];

  /** Adds `event`, and answers the summary of the load it ends when it is a navigation. */
  add(event) {
    if (event.kind !== 'navigate') {
      // An event before the first navigation belongs to no load this timeline sums up.
      if (this.#events.length > 0) this.#events.push(event);
      return null;
    }
    const ended = this.summary();
    this.#events = [event];
    return ended;
  }

  /** One line on the load so far, or null before the first navigation. */
  summary() {
    const [navigation, ...events] = this.#events;
    if (!navigation) return null;
    const canvas = events.find((event) => event.kind === 'canvas');
    const draws = events.filter((event) => event.kind === 'first-draw');
    const tasks = events.filter((event) => event.kind === 'long-task' && event.ms >= NOTABLE_TASK_MS);
    const longest = (list) => Math.max(0, ...list.map((event) => event.ms));
    return [
      `${navigation.search}:`,
      `canvas inserted at ${canvas ? `${canvas.at} ms` : 'no time'},`,
      `${draws.length} programs drawn, the slowest first draw ${longest(draws)} ms,`,
      `${tasks.length} main-thread tasks over ${NOTABLE_TASK_MS} ms, the longest ${longest(tasks)} ms`,
    ].join(' ');
  }
}
