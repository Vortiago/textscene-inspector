/**
 * GridContainer strict validators: `doc/classes/GridContainer.xml` lists one
 * member, `columns`. The NODE_BASE_TYPES walk delivers Container and Control.
 */

// Container registers nothing of its own, so the chain is pulled in at Control,
// matching BoxContainer and the other Container children.
import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('GridContainer', {
  // grid_container.cpp:267 hints "1,1024,1", both ends closed. The two ends are
  // grounded differently: set_columns opens with ERR_FAIL_COND(p_columns < 1)
  // (grid_container.cpp:244), so the floor is refused outright, while nothing
  // in the setter looks at 1024 and a wider grid simply lays out.
  columns: v.int('columns', {
    min: 1,
    max: 1024,
    enforced: { min: 'grid_container.cpp:244' },
    hinted: { max: 'grid_container.cpp:267' },
  }),
});
