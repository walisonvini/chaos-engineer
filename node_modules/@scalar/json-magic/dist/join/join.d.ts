import type { UnknownObject } from '../types.js';
/** Controls how a value is combined with the value from earlier inputs. */
export type JoinStrategy = 'merge' | 'merge-by-index' | 'replace' | 'conflict' | 'skip' | {
    uniqueBy: string;
};
/** Context for choosing a strategy. Paths are segments, so keys containing slashes stay intact. */
export type JoinContext = {
    path: readonly string[];
    current: unknown;
    incoming: unknown;
};
/** Customize merging without coupling it to a document format. */
export type JoinOptions = {
    strategy?: (context: JoinContext) => JoinStrategy;
};
/** A duplicate value at a location marked as a conflict by the caller. */
export type JoinConflict = {
    path: string[];
};
/** Conflicts prevent returning a partially joined document. */
export type JoinResult = {
    ok: true;
    document: UnknownObject;
} | {
    ok: false;
    conflicts: JoinConflict[];
};
/**
 * Join JSON objects without interpreting any document standard or resolving references.
 * Objects merge recursively; arrays and other values are replaced by later inputs.
 * A strategy can instead replace an entire object, reject duplicate keys (even equal
 * values), or combine arrays by a property, retaining the first occurrence.
 * Inputs must be acyclic JSON objects and are never mutated or shared with the result.
 */
export declare const join: (inputs: readonly UnknownObject[], options?: JoinOptions) => JoinResult;
//# sourceMappingURL=join.d.ts.map