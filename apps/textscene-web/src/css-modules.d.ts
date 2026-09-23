/**
 * Ambient types for CSS Module imports: Vite handles the runtime, and the import
 * returns a map of hashed class names.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
