/** A box outline of the unit cube draws a few hundred green pixels, and no other node draws green. */
export const OUTLINE_FLOOR = 100;

const CUBE_PATH = '/root/Root/Cube';

const isSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function picksFailure(label, { picks }, expected) {
  if (isSame(picks, expected)) return [];
  return [`${label}: expected onSelect to hear ${JSON.stringify(expected)}, got ${JSON.stringify(picks)}`];
}

function outlineFailure(label, outline, isOutlined) {
  if (isOutlined === outline >= OUTLINE_FLOOR) return [];
  const expected = isOutlined ? `at least ${OUTLINE_FLOOR}` : `under ${OUTLINE_FLOOR}`;
  return [`${label}: expected ${expected} outline pixels, got ${outline}`];
}

/** One line per click whose pick or outline differs from the 3D editor's, or none. */
export function pickFailures({ results, errors }) {
  const { unselected, onCube, onNothing, hostSelected, onNothingHostOwned, on2D, onInGame } = results;
  return [
    ...outlineFailure('before a click', unselected, false),
    ...picksFailure('a click on the cube', onCube, [CUBE_PATH]),
    ...outlineFailure('a click on the cube', onCube.outline, true),
    ...picksFailure('a click on nothing', onNothing, [null]),
    ...outlineFailure('a click on nothing', onNothing.outline, false),
    ...outlineFailure('the host’s selected cube', hostSelected, true),
    ...picksFailure('a click on nothing beside the host’s selected cube', onNothingHostOwned, [null]),
    ...outlineFailure('a click on nothing beside the host’s selected cube', onNothingHostOwned.outline, true),
    ...picksFailure('a click in the 2D mode', on2D, []),
    ...picksFailure('a click In-game', onInGame, []),
    ...errors.map((message) => `page error: ${message}`),
  ].map((failure) => `pick: ${failure}`);
}
