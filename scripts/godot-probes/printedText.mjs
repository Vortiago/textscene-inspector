import { recordEntry } from './record.mjs';
import { godotRejection } from './rejection.mjs';
import { sourceServer } from '../sourceServer.mjs';

const LANGUAGE = '/packages/textscene-core/src/shaders/language/';

/** The tests' trees of a text, as parsed and as the emitter walks it, which this check reads too. */
const TREES = '/apps/textscene-three-godot-shaders/tests/verdicts/trees.testkit.mjs';

/**
 * The transpiler's printer as two functions from a probe to printed text: `print` of the parsed
 * tree, and `lower` of the tree the emitter walks (`emittedTree.ts`) where it differs. Both read
 * the tree after the preprocessor, with the probe's includes. Each gives nothing for a text the transpiler refuses. Vite compiles the TypeScript
 * sources, since this script runs in plain Node.
 */
export async function loadPrinter() {
  const server = await sourceServer();
  try {
    const load = (file) => server.ssrLoadModule(`${LANGUAGE}${file}`);
    const [{ printShader }, { ShadingLanguageError }, { treeOf, loweredTreeOf }] = await Promise.all([
      load('printer.ts'),
      load('shadingLanguageError.ts'),
      server.ssrLoadModule(TREES),
    ]);
    const unlessRefused = (print) => (probe) => {
      try {
        return print(probe.source, probe.includes);
      } catch (error) {
        if (error instanceof ShadingLanguageError) return undefined;
        throw error;
      }
    };
    return {
      print: unlessRefused((source, includes) => printShader(treeOf(source, includes))),
      lower: unlessRefused((source, includes) => {
        const lowered = printShader(loweredTreeOf(source, includes));
        return lowered === printShader(treeOf(source, includes)) ? undefined : lowered;
      }),
    };
  } finally {
    await server.close();
  }
}

/**
 * The printed form of each probe `print` prints, named `<form>-<name>`, with its `original`. A
 * probe that ends Godot has no tree, since the front end refuses it, so it has no printed form.
 */
export function printedProbes(probes, print, form = 'printed') {
  return probes.flatMap((original) => {
    const printed = original.endsGodot ? undefined : print(original);
    if (printed === undefined) return [];
    // The printed text is preprocessed already, so it reads no include and has no text to record.
    const name = `${form}-${original.name}`;
    return [
      { ...original, includes: undefined, recordsPreprocessed: false, name, source: printed, original },
    ];
  });
}

/**
 * Each probe whose printed form Godot answers otherwise than the original: another verdict, other
 * result bits, or another refusal. Both forms have the same inputs, so they answer as many rows. A refusal is compared without its line, since the printed text
 * puts each statement on a line of its own. `pixels` holds both forms' pixels and `rejections`
 * both forms' reasons, by name.
 */
export function printedTextFaults(printedForms, { pixels }, rejections) {
  const answer = (probe) => {
    const { results, rejected } = recordEntry(probe, pixels.get(probe.name), rejections.get(probe.name));
    return (results ?? [{ stage: rejected.stage, message: rejected.message }]).map((row) =>
      JSON.stringify(row)
    );
  };
  return printedForms.flatMap((printed) => {
    const [actual, expected] = [answer(printed), answer(printed.original)];
    const row = actual.findIndex((text, index) => text !== expected[index]);
    if (row === -1) return [];
    return [
      `${printed.original.name}: Godot answers ${actual[row]} to the printed text and ${expected[row]} to the original, input row ${row}\n  printed: ${printed.source}`,
    ];
  });
}

/**
 * Godot's reason for a printed text it draws nothing for. Godot may draw nothing and name no
 * error, as for `b * a = b`: that is the printer's fault, so the run reports it beside the others.
 */
export async function printedRejection(printed) {
  try {
    return await godotRejection(printed);
  } catch (error) {
    return { stage: 'no reason', message: error.message.split('\n')[0] };
  }
}
