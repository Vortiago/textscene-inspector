/** The scene fact a test that builds a `TscnScene` by hand states once, instead of per literal. */

/**
 * The refusal fact of a hand-built scene that Godot instantiates, spread into its literal.
 *
 * @canonical In tests, the refusal fact of a hand-built scene
 */
export const INSTANTIABLE_SCENE = { refusesToInstantiate: false } as const;
