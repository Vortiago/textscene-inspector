import { equalityFailure } from './mountFailures.mjs';

const MISSING_PATH = 'res://missing.png';

/** The one file the check scene reads, which the provider does not hold. */
const MISSING_FILE = {
  path: MISSING_PATH,
  type: 'Texture2D',
  state: 'missing',
  owners: ['res://main.tscn'],
  reason: { chain: [MISSING_PATH], cause: 'missing', addresses: [] },
  addresses: [],
  sceneFailure: null,
};

/** The same file, read by a section of the scene, so the game refuses the scene through it. */
const REFUSING_FILE = {
  ...MISSING_FILE,
  sceneFailure: {
    line: `res://main.tscn - Parse Error: [ext_resource] referenced non-existent resource at: ${MISSING_PATH}.`,
    chain: [MISSING_PATH],
    cause: 'missing',
  },
};

/** @param {import('./app/missingFileChecks').MissingFileCheckResults} results */
export function missingFileFailures({ beforeView, settledKeys, heard, afterWrite, refused }) {
  return [
    ...equalityFailure('scene.files() before a view', [MISSING_FILE], beforeView),
    ...equalityFailure('the keys of settled', ['scriptedNodeCount', 'hasCurrentCamera'], settledKeys),
    ...(heard.some((paths) => paths.includes(MISSING_PATH))
      ? []
      : [`subscribe: expected a notice that sees ${MISSING_PATH}, got ${JSON.stringify(heard)}`]),
    ...equalityFailure('scene.files() after texture = null', [], afterWrite),
    ...equalityFailure('the last subscribe notice', [], heard.at(-1) ?? null),
    ...equalityFailure('scene.files() of a refused scene', [REFUSING_FILE], refused),
  ].map((failure) => `missing files: ${failure}`);
}
