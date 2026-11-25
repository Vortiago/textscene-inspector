import type { InspectedNode, PropertyItem } from './inspectedNode';

/** Each row that shows only where the file sets its property, with its label and its text. */
export interface SetRow {
  readonly property: string;
  readonly label: string;
  readonly text: (value: number) => string;
}

/** The rows of `rows` whose property the file sets, in their order. */
export async function setRows(node: InspectedNode, rows: readonly SetRow[]): Promise<PropertyItem[]> {
  const shown = rows.filter((row) => node.fileProperties.has(row.property));
  const values = await node.read(shown.map((row) => row.property));
  return shown.map((row) => ({ label: row.label, value: row.text(values.number(row.property)) }));
}
