/**
 * Ambient types for the core package's CSS Module imports: the import is a map of hashed class
 * names. Vite and esbuild-css-modules-plugin handle the runtime side.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
