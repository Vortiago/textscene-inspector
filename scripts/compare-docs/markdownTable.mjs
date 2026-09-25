/**
 * The sheets' pipe-table grammar: how a cell is escaped and how a row splits
 * back into cells. The generator and the gallery share one splitter, so
 * `tableLines` can refuse a row whose value ends its cell early, such as a
 * `maskedBitField` label joined with ` | `.
 */

/** `|` inside a cell, escaped so the cell survives the split. */
export const escapeCell = (text) => String(text).replaceAll('|', '\\|');

/**
 * A row's cells, honouring `\|`. The outer delimiters are dropped; an escaped
 * pipe at the end of the last cell is not one of them, hence the lookbehind.
 */
export function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replaceAll('\\|', '|'));
}

/** Whether a row is the `| --- | --- |` divider rather than content. */
export const isDivider = (line) => /^[\s|:-]+$/.test(line);

/**
 * A whole table: header, divider, and one line per row of cells. Each row is
 * checked by re-splitting the rendered line, since `cells.length` cannot see a
 * value that ends its cell early.
 *
 * @param header - column titles, already in their final text.
 * @param rows - arrays of cell values; each is escaped here.
 */
export function tableLines(header, rows) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const cells of rows) {
    const line = `| ${cells.map(escapeCell).join(' | ')} |`;
    const got = splitRow(line).length;
    if (got !== header.length) {
      throw new Error(
        `generated row renders ${got} cell(s) into a ${header.length}-column table: ${line}`
      );
    }
    lines.push(line);
  }
  return lines;
}
