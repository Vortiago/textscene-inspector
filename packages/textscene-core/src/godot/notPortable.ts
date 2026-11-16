/** A Godot behaviour the port cannot repeat: `owner` is the issue that owns its port, where one does. */
export class NotPortable extends Error {
  constructor(
    message: string,
    readonly owner?: string
  ) {
    super(message);
  }
}
