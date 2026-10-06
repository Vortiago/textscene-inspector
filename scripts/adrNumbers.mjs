/**
 * The ADR numbers that more than one file in `docs/adr/` carries. A cite names an ADR by its
 * number alone, and the gallery links `ADR-NNNN` to the first file with that prefix, so a shared
 * number sends a reader to the wrong decision.
 */

const NUMBERED_ADR = /^(\d{4})-.*\.md$/;

/** Each number that two or more of `fileNames` carry, mapped to those names in input order. */
export function sharedAdrNumbers(fileNames) {
  const byNumber = Map.groupBy(
    fileNames.filter((name) => NUMBERED_ADR.test(name)),
    (name) => NUMBERED_ADR.exec(name)[1]
  );
  return new Map([...byNumber].filter(([, names]) => names.length > 1));
}
