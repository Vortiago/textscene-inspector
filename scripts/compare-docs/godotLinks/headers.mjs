/** What a candidate header contains: one cached fetch, and the GDCLASS verification. */

const RAW_BASE = 'https://raw.githubusercontent.com/godotengine/godot/master/';

const MAX_ATTEMPTS = 3;

/**
 * Fetches a header once. The promise is cached, so concurrent resolvers share a
 * request. Only a 404 is final: a 429 or 5xx is retried a bounded number of
 * times with backoff, since evicting it would re-request in a loop under a limit.
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
 * The class is defined here, not only forward-declared or mentioned. Not
 * `GDSOFTCLASS(`: a class moved to that macro becomes a loud unresolved miss.
 */
export const defines = (text, name) =>
  text !== null && new RegExp(`GDCLASS\\(\\s*${name}\\s*,`).test(text);
