import { storedReal as f } from '../../godot/math/real.js';

/** `20 / ln(10)` and its inverse, as `math_funcs.h:611-623` casts them to float. */
const DB_PER_NEPER = f(20 / Math.LN10);
const NEPERS_PER_DB = f(Math.LN10 / 20);

/** `Math::linear_to_db(float)` (`math_funcs.h:614-616`). */
export const linearToDb = (linear: number): number => f(f(Math.log(f(linear))) * DB_PER_NEPER);

/** `Math::db_to_linear(float)` (`math_funcs.h:621-623`). */
export const dbToLinear = (db: number): number => f(Math.exp(f(f(db) * NEPERS_PER_DB)));
