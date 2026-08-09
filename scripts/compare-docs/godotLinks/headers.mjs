/** What a candidate header CONTAINS: one cached fetch, and the GDCLASS verification. */

const RAW_BASE = 'https://raw.githubusercontent.com/godotengine/godot/master/';

const MAX_ATTEMPTS = 3;

/**
 * Fetch a header once. The PROMISE is cached, not the text, so concurrent
 * resolvers asking for the same file share one request instead of racing.
 *
 * Only 404 is a durable answer: it really means "no such header". A 429 or 5xx
 * says nothing about the file, so caching it as `null` would turn one throttled
 * request into a permanent verification failure reported as an upstream rename.
 * Such a path is retried — but a BOUNDED number of times, with backoff. Simply
 * evicting the entry would drop memoisation exactly when the API is rate-limiting
 * and let the directory sweep re-request everything in a loop.
 */
export function makeFetcher() {
  const cache = new Map();

  const attempt = async (path, tries) => {
    try {
      const res = await fetch(RAW_BASE + path, {
        headers: { 'User-Agent': 'textscene-compare-docs' },
      });
      if (res.ok) return res.text();
      if (res.status === 404) return null;
      if (tries >= MAX_ATTEMPTS) {
        console.error(`[catalog] ${path}: giving up after ${tries} attempts (HTTP ${res.status})`);
        return null;
      }
    } catch (err) {
      if (tries >= MAX_ATTEMPTS) {
        console.error(`[catalog] ${path}: giving up after ${tries} attempts (${err.message})`);
        return null;
      }
    }
    await new Promise((r) => setTimeout(r, 250 * 2 ** (tries - 1)));
    return attempt(path, tries + 1);
  };

  return (path) => {
    let pending = cache.get(path);
    if (!pending) {
      pending = attempt(path, 1);
      cache.set(path, pending);
    }
    return pending;
  };
}

/**
 * The class is really DEFINED here, not merely forward-declared or mentioned.
 *
 * Deliberately does NOT match `GDSOFTCLASS(`: if Godot migrates a node to that
 * macro the class becomes a loud unresolved miss, which is the designed failure
 * mode — better than a link nobody re-verified.
 */
export const defines = (text, name) =>
  text !== null && new RegExp(`GDCLASS\\(\\s*${name}\\s*,`).test(text);
