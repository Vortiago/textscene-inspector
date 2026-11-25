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
};

/** The scene's failure where a section reads the missing file, so the game refuses the scene through it. */
const REFUSED = {
  line: `res://main.tscn:6 - Parse Error: [ext_resource] referenced non-existent resource at: ${MISSING_PATH}.`,
  chain: [MISSING_PATH],
  cause: 'missing',
};

/** The scene's failure at an undeclared id, measured in Godot 4.6.3: no file is in the chain. */
const UNPARSED = {
  line: "res://main.tscn:4 - Parse Error: Can't load cached ext-resource id: 99.",
  chain: [],
  cause: 'unparsed',
};

/** @param {import('./app/missingFileChecks').MissingFileCheckResults} results */
export function missingFileFailures({ beforeView, settledKeys, heard, afterWrite, refused, unparsed }) {
  return [
    ...equalityFailure('scene.files() before a view', [MISSING_FILE], beforeView),
    ...equalityFailure('the keys of settled', ['scriptedNodeCount', 'hasCurrentCamera'], settledKeys),
    ...(heard.some((paths) => paths.includes(MISSING_PATH))
      ? []
      : [`subscribe: expected a notice that sees ${MISSING_PATH}, got ${JSON.stringify(heard)}`]),
    ...equalityFailure('scene.files() after texture = null', [], afterWrite),
    ...equalityFailure('the last subscribe notice', [], heard.at(-1) ?? null),
    ...equalityFailure('scene.sceneFailure() through a missing file', REFUSED, refused),
    ...equalityFailure('scene.sceneFailure() at an undeclared id', UNPARSED, unparsed),
  ].map((failure) => `missing files: ${failure}`);
}
