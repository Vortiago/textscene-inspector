export function isStringLess(left: string, right: string): boolean {
  return codePointDifference(left, right) < 0;
}

// str_compare (ustring.h:111): a string's end reads as code point 0.
function codePointDifference(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;
  for (;;) {
    const l = left.codePointAt(leftIndex) ?? 0;
    const r = right.codePointAt(rightIndex) ?? 0;
    if (l === 0 || l !== r) return l - r;
    leftIndex += l > 0xffff ? 2 : 1;
    rightIndex += r > 0xffff ? 2 : 1;
  }
}
