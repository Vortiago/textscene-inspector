const MISSING_PATH = 'res://missing.png';

function equalityFailure(name, expected, actual) {
  const [want, got] = [JSON.stringify(expected), JSON.stringify(actual)];
  return want === got ? [] : [`${name}: expected ${want}, got ${got}`];
}

/** @param {import('./app/missingFileChecks').MissingFileCheckResults} results */
export function missingFileFailures({ atSettled, ofScene, heard, afterWrite }) {
  const lastHeard = heard.at(-1) ?? null;
  return [
    ...equalityFailure('settled', [MISSING_PATH], atSettled),
    ...equalityFailure('scene.missingFiles()', [MISSING_PATH], ofScene),
    ...(heard.some((paths) => paths.includes(MISSING_PATH))
      ? []
      : [`subscribe: expected a notice that sees ${MISSING_PATH}, got ${JSON.stringify(heard)}`]),
    ...equalityFailure('settled after texture = null', [], afterWrite),
    ...equalityFailure('the last subscribe notice', [], lastHeard),
  ].map((failure) => `missing files: ${failure}`);
}
