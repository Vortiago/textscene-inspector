/** The previewer URL that opens one fixture: the one shape of `?fixture=` for every caller. */

/**
 * @param {string} site - the previewer's root, with or without a trailing slash.
 * @param {string} fixture - the filename exactly as in apps/textscene-web/src/fixtures.ts.
 * @param {Record<string, unknown>} [extraParams] - more query parameters. A null or undefined one is left out.
 */
export function fixtureUrl(site, fixture, extraParams = {}) {
  const params = Object.entries({ fixture, ...extraParams })
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${site.replace(/\/$/, '')}/?${params.join('&')}`;
}
