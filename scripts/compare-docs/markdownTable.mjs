/**
 * The pipe-table grammar the sheets are written in: how a cell is escaped, and
 * how a row splits back into cells.
 *
 * One module because the generator and the gallery renderer are the two halves
 * of the same grammar. `maskedBitField` builds an `accepts` string by joining
 * the constant names with ` | `, and an unescaped one of those ends the cell
 * early: GFM drops the tail, so the severity column printed a mask label and
 * the last bits vanished, while `renderTable` emitted six `<td>` against three
 * `<th>`. Writing the row and reading it back through ONE splitter is what lets
 * `tableLines` refuse such a row instead of shipping it.
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
 * A whole table: header, divider, and one line per row of cells.
 *
 * Each row is checked by re-splitting the rendered line, never by counting the
 * inputs: the defect this exists for is a VALUE that ends its cell early, which
 * `cells.length` cannot see.
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
