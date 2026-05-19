/**
 * Ambient type declarations for CSS Module imports in the web app.
 * Vite handles the runtime side; this file teaches TypeScript that the
 * import returns a hashed class-name lookup map.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
