import { isObject } from '@scalar/helpers/object/is-object';
import { escapeJsonPointer } from '../helpers/escape-json-pointer.js';
import { getId } from '../helpers/get-schemas.js';
import { getSegmentsFromPath } from '../helpers/get-segments-from-path.js';
import { getValueByPath } from '../helpers/get-value-by-path.js';
import { resolveReferencePath } from '../helpers/resolve-reference-path.js';
/**
 * Indexes complete documents before following their references. A declared identity
 * can point to content already in memory even when that URI cannot be fetched.
 */
export const documentReferences = (externalDocumentsKey, resolveDocument) => {
    const identities = new Map();
    const resources = new Map();
    const origins = new WeakMap();
    const bundledResources = new Map();
    const register = (document, retrievalUri, path = []) => {
        const identity = resolveDocument?.(document, retrievalUri);
        const base = identity === undefined ? retrievalUri : resolveReferencePath(retrievalUri, identity.baseUri);
        if (identity !== undefined) {
            identities.set(document, { ...identity, baseUri: base });
        }
        const resource = { value: document, path, schema: false, embedded: path.length > 0, document, documentPath: path };
        // Retrieval aliases retain compatibility with callers that supply local copies.
        resources.set(retrievalUri, resource);
        resources.set(base, resource);
        if (path.length > 1) {
            bundledResources.set(path[1], resource);
        }
        // Shared nodes use the first traversal path and base, including for $id and $anchor
        // registration. This also prevents cycles from being indexed repeatedly.
        const visited = new WeakSet();
        const visit = (value, origin, location, inheritedIdentifier = '') => {
            if (value === null || typeof value !== 'object' || visited.has(value)) {
                return;
            }
            visited.add(value);
            const id = getId(value);
            const identifier = id ?? inheritedIdentifier;
            const current = id === undefined ? origin : resolveReferencePath(origin, id);
            origins.set(value, current);
            const anchor = isObject(value) && typeof value.$anchor === 'string' ? value.$anchor : undefined;
            if (id !== undefined || anchor !== undefined) {
                const schemaResource = {
                    value,
                    path: location,
                    schema: true,
                    identifier,
                    embedded: path.length > 0,
                    document,
                    documentPath: path,
                };
                if (id !== undefined) {
                    resources.set(current, schemaResource);
                }
                if (anchor !== undefined) {
                    resources.set(`${current}#${anchor}`, schemaResource);
                }
            }
            for (const [key, child] of Object.entries(value)) {
                if (key !== externalDocumentsKey) {
                    visit(child, current, [...location, key], identifier);
                }
            }
        };
        visit(document, base, path);
    };
    return {
        identity: (document) => identities.get(document),
        register,
        isSchemaResource: (uri) => resources.get(uri)?.schema === true,
        origin: (node) => origins.get(node),
        resolve: (ref, base) => {
            const [prefix, fragment = ''] = ref.split('#', 2);
            const uri = prefix ? resolveReferencePath(base, prefix) : base;
            const pointer = fragment.startsWith('/') ? getSegmentsFromPath(fragment) : [];
            const bundled = (!prefix || resources.get(uri)?.path.length === 0) && pointer[0] === externalDocumentsKey
                ? bundledResources.get(pointer[1])
                : undefined;
            const resource = bundled ?? resources.get(fragment && !fragment.startsWith('/') ? `${uri}#${fragment}` : uri);
            if (!resource) {
                return undefined;
            }
            const segments = bundled ? pointer.slice(2) : pointer;
            const location = [...resource.path, ...segments];
            const value = getValueByPath(resource.value, segments).value;
            // Missing targets must stay unresolved instead of becoming pointers to absent values.
            const isUnresolved = value === undefined;
            // Fragment-only schema references are relative to their own resource, even when embedded.
            const isLocalSchemaReference = resource.schema && !prefix;
            // References matching an authored root schema identifier remain usable by downstream consumers.
            // Preserve relative identifiers too: rewriting them changes schema names shown by renderers.
            const isDeclaredRootSchemaReference = !resource.embedded && resource.schema && Boolean(prefix) && prefix === resource.identifier;
            // Fragment-only document references already address the root without relocation.
            const isLocalRootDocumentReference = !resource.embedded && !resource.schema && !prefix;
            return {
                path: location.map(escapeJsonPointer).join('/'),
                value,
                document: resource.document,
                documentPath: resource.documentPath,
                preserveReference: isUnresolved || isLocalSchemaReference || isDeclaredRootSchemaReference || isLocalRootDocumentReference,
            };
        },
    };
};
