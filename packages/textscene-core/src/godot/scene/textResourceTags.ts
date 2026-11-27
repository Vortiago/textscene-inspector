/** Required fields by tag, in check order (resource_format_text.cpp:311-331, :392, :466-560, :1155). */
const REQUIRED_FIELDS: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries({
    gd_resource: ['type'],
    ext_resource: ['path', 'type', 'id'],
    sub_resource: ['type', 'id'],
    connection: ['from', 'to', 'signal', 'method'],
    editable: ['path'],
  })
);

/** The first field the loader requires of a `type` tag that `keys` lacks, or undefined. */
export function missingField(type: string, keys: readonly string[]): string | undefined {
  return REQUIRED_FIELDS.get(type)?.find((field) => !keys.includes(field));
}

/** Whether the loader reads a body after a `type` tag (resource_format_text.cpp:40, :1185). */
export function hasBody(type: string): boolean {
  return type === 'node' || type === 'sub_resource' || type === 'resource';
}
