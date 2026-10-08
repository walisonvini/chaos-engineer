import type { Difference } from '../diff/diff.js';
export declare class InvalidChangesDetectedError extends Error {
    constructor(message: string);
}
/**
 * Applies a set of differences to a document object.
 * The function traverses the document structure following the paths specified in the differences
 * and applies the corresponding changes (add, update, or delete) at each location.
 *
 * Paths that reach the prototype chain (`__proto__`, `constructor` or `prototype`) are rejected
 * before anything is written, so a hostile changeset cannot poison `Object.prototype`.
 *
 * A change with an empty path asks to replace the document itself, which is not supported: the
 * function writes through the parent container of each path and the root has no parent. `diff`
 * emits such a change whenever the two documents differ at the root, which covers a different
 * `typeof`, `null` against an object, and an array on one side against a plain object on the
 * other. Those changesets have to be handled by the caller instead of being applied.
 *
 * ⚠️ `document` is mutated in place and the result shares structure with the document the diff was
 * built from: every `add` and `update` writes the change into the document by reference, and those
 * changes are live references into the target document `diff` compared (see `diff`). A later write
 * into the result can therefore be seen through that document, and the other way around. Callers
 * that need an isolated result have to deep clone the document and the changes first.
 *
 * @param document - The original document to apply changes to, mutated in place
 * @param diff - Array of differences to apply, each containing a path and change type
 * @returns The modified document with all changes applied, structurally shared with the changes
 * @throws {InvalidChangesDetectedError} When a path is unusable, empty or reaches the prototype chain
 *
 * @example
 * const original = {
 *   paths: {
 *     '/users': {
 *       get: { responses: { '200': { description: 'OK' } } }
 *     }
 *   }
 * }
 *
 * const changes = [
 *   {
 *     path: ['paths', '/users', 'get', 'responses', '200', 'content'],
 *     type: 'add',
 *     changes: { 'application/json': { schema: { type: 'object' } } }
 *   }
 * ]
 *
 * const updated = apply(original, changes)
 * // Result: original document with content added to the 200 response
 */
export declare const apply: <T extends Record<string, unknown>>(document: Record<string, unknown>, diff: Difference<T>[]) => T;
//# sourceMappingURL=apply.d.ts.map