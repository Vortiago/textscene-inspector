/** A material bag's draw-specific forms, kept per bag so that a render that changes nothing hands R3F the same props. */

import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import { perObject } from '../../utils/perObject';

/** Builds a bag's form for one draw. Called once per bag and key. */
type BuildForm = () => StandardMaterialBag;

/**
 * A store of forms by bag and draw key, which hands back the form it built first for each pair.
 *
 * @canonical A cache of a material bag's draw forms
 */
export function bagForms(): (bag: StandardMaterialBag, key: string, build: BuildForm) => StandardMaterialBag {
  const formsOf = perObject<StandardMaterialBag, Map<string, StandardMaterialBag>>(() => new Map());
  return (bag, key, build) => {
    const forms = formsOf(bag);
    const known = forms.get(key);
    if (known) return known;
    const form = build();
    forms.set(key, form);
    return form;
  };
}
