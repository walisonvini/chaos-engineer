/**
 * Resolves a reference path by combining a base path with a relative path.
 * Scheme-bearing references keep their identity, including non-fetchable URNs.
 * Hierarchical URI bases use URL resolution (query, fragment, and directory semantics);
 * an opaque base such as a URN cannot resolve a relative path and throws.
 * Scheme-less inputs retain filesystem resolution, including Windows drive paths.
 *
 * @param base - The base path (can be a URL or local file path)
 * @param relativePath - The relative path to resolve against the base
 * @returns The resolved absolute path
 * @example
 * // Resolve remote URL
 * resolveReferencePath('https://example.com/api/schema.json', 'user.json')
 * // Returns: 'https://example.com/api/user.json'
 *
 * // Resolve local path
 * resolveReferencePath('/path/to/schema.json', 'user.json')
 * // Returns: '/path/to/user.json'
 */
export declare const resolveReferencePath: (base: string, relativePath: string) => string;
//# sourceMappingURL=resolve-reference-path.d.ts.map