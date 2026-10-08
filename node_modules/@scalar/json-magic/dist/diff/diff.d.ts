/**
 * Represents the possible types of changes that can be made to a document.
 * - 'add': A new property is added
 * - 'update': An existing property's value is changed
 * - 'delete': A property is removed
 */
type ChangeType = 'add' | 'update' | 'delete';
/**
 * Represents a single difference between two documents.
 * @property path - Array of strings representing the path to the changed property
 * @property changes - The new value for the property (for add/update) or the old value (for delete)
 * @property type - The type of change that occurred
 */
export type Difference<_T> = {
    path: string[];
    changes: any;
    type: ChangeType;
};
/**
 * Get the difference between two objects.
 *
 * This function performs a breadth-first comparison between two objects and returns
 * a list of operations needed to transform the first object into the second.
 *
 * Keys that reach the prototype chain (`__proto__`, `constructor` and `prototype`) are skipped, so
 * an untrusted document cannot produce a diff that poisons `Object.prototype` once applied.
 *
 * ⚠️ The returned `changes` are live references into the documents, not clones. An `add` or an
 * `update` carries the very subtree `doc2` holds, and a `delete` carries the subtree from `doc1`,
 * so writing into a change writes into the document it came from. This matters downstream:
 * `merge` merges values into these objects, and `apply` writes them into its target document,
 * which leaves the result structurally shared with `doc2`. Callers that need isolation have to
 * deep clone the documents before diffing them, or the changes afterwards.
 *
 * @param doc1 - The source object to compare from
 * @param doc2 - The target object to compare to
 * @returns A list of operations (add/update/delete) with their paths and changes
 *
 * @example
 * // Compare two simple objects
 * const original = { name: 'John', age: 30 }
 * const updated = { name: 'John', age: 31, city: 'New York' }
 * const differences = diff(original, updated)
 * // Returns:
 * // [
 * //   { path: ['age'], changes: 31, type: 'update' },
 * //   { path: ['city'], changes: 'New York', type: 'add' }
 * // ]
 *
 * @example
 * // Compare nested objects
 * const original = {
 *   user: { name: 'John', settings: { theme: 'light' } }
 * }
 * const updated = {
 *   user: { name: 'John', settings: { theme: 'dark' } }
 * }
 * const differences = diff(original, updated)
 * // Returns:
 * // [
 * //   { path: ['user', 'settings', 'theme'], changes: 'dark', type: 'update' }
 * // ]
 */
export declare const diff: <T extends Record<string, unknown>>(doc1: Record<string, unknown>, doc2: T) => Difference<T>[];
export {};
//# sourceMappingURL=diff.d.ts.map