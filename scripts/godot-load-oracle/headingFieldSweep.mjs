import { fileWithField, writeCases } from './headingSweepScene.mjs';

/** Each field Godot requires, by heading kind (resource_format_text.cpp:311-331, :392, :466-560, :1155). */
const REQUIRED = {
  gd_resource: ['type'],
  ext_resource: ['path', 'type', 'id'],
  sub_resource: ['type', 'id'],
  connection: ['from', 'to', 'signal', 'method'],
  editable: ['path'],
};

/** The heading line of `kind` that the sweep scene marks, as `fileWithField` writes it. */
function markedLine(text, kind) {
  return text.split('\n').find((line) => line.startsWith(`[${kind} `) && line.endsWith(' ]'));
}

/** The file of `kind` without `fields` in its marked heading, the `]` on a new line if `isSplit`. */
function fileWithout(kind, fields, isSplit = false) {
  const { extension, text } = fileWithField(kind, '');
  const line = markedLine(text, kind);
  let heading = line.replace(/ \]$/, isSplit ? '\n]' : ']');
  for (const field of fields)
    heading = heading.replace(new RegExp(` ${field}=("[^"]*"|\\S+?)(?=[ \\]\\n])`), '');
  return { extension, text: text.replace(line, heading) };
}

const cases = [
  ...Object.entries(REQUIRED).flatMap(([kind, fields]) =>
    fields.map((field) => ({ name: `${kind}__no_${field}`, ...fileWithout(kind, [field]) }))
  ),
  ...Object.entries(REQUIRED)
    .filter(([, fields]) => fields.length > 1)
    .map(([kind, fields]) => ({ name: `${kind}__none`, ...fileWithout(kind, fields) })),
  ...Object.entries(REQUIRED).map(([kind, fields]) => ({
    name: `${kind}__no_${fields.at(-1)}__split`,
    ...fileWithout(kind, [fields.at(-1)], true),
  })),
];
console.log(writeCases(process.argv[2], cases));
