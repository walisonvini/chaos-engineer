import { isObject } from '@scalar/helpers/object/is-object';
import { getId } from '../helpers/get-schemas.js';
import { getValueByPath } from '../helpers/get-value-by-path.js';
import { isFilePath } from '../helpers/is-file-path.js';
import { isHttpUrl } from '../helpers/is-http-url.js';
import { resolveReferencePath } from '../helpers/resolve-reference-path.js';
import { setValueAtPath } from '../helpers/set-value-at-path.js';
import { toRelativePath } from '../helpers/to-relative-path.js';
import { escapeJsonPointer } from '../helpers/escape-json-pointer.js';
import { getSegmentsFromPath } from '../helpers/get-segments-from-path.js';
import { documentReferences } from './document-references.js';
import { getHash, uniqueValueGeneratorFactory } from './value-generator.js';
/** Type guard to check if a value is an object with a $ref property */
const hasRef = (value) => isObject(value) && '$ref' in value && typeof value['$ref'] === 'string';
/**
 * Checks if a string is a local reference (starts with #)
 * @param value - The reference string to check
 * @returns true if the string is a local reference, false otherwise
 * @example
 * ```ts
 * isLocalRef('#/components/schemas/User') // true
 * isLocalRef('https://example.com/schema.json') // false
 * isLocalRef('./local-schema.json') // false
 * ```
 */
export function isLocalRef(value) {
    return value.startsWith('#');
}
/**
 * Resolves a string by finding and executing the appropriate plugin.
 * @param value - The string to resolve (URL, file path, etc)
 * @param plugins - Array of plugins that can handle different types of strings
 * @returns A promise that resolves to either the content or an error result
 * @example
 * // Using a URL plugin
 * await resolveContents('https://example.com/schema.json', [urlPlugin])
 * // Using a file plugin
 * await resolveContents('./schemas/user.json', [filePlugin])
 * // No matching plugin returns { ok: false }
 * await resolveContents('#/components/schemas/User', [urlPlugin, filePlugin])
 */
function resolveContents(value, plugins) {
    const plugin = plugins.find((p) => p.validate(value));
    if (plugin) {
        return plugin.exec(value);
    }
    return Promise.resolve({
        ok: false,
    });
}
/**
 * Prefixes an internal JSON reference with a given path prefix.
 * Takes a local reference (starting with #) and prepends the provided prefix segments.
 *
 * @param input - The internal reference string to prefix (must start with #)
 * @param prefix - Array of path segments to prepend to the reference
 * @returns The prefixed reference string
 * @throws Error if input is not a local reference
 * @example
 * prefixInternalRef('#/components/schemas/User', ['definitions'])
 * // Returns: '#/definitions/components/schemas/User'
 */
export function prefixInternalRef(input, prefix) {
    if (!isLocalRef(input)) {
        throw 'Please provide an internal ref';
    }
    return `#/${prefix.map(escapeJsonPointer).join('/')}${input.substring(1)}`;
}
/**
 * Updates internal references in an object by adding a prefix to their paths.
 * Recursively traverses the input object and modifies any local $ref references
 * by prepending the given prefix to their paths. This is used when embedding external
 * documents to maintain correct reference paths relative to the main document.
 *
 * @param input - The object to update references in
 * @param prefix - Array of path segments to prepend to internal reference paths
 * @returns void
 * @example
 * ```ts
 * const input = {
 *   foo: {
 *     $ref: '#/components/schemas/User'
 *   }
 * }
 * prefixInternalRefRecursive(input, ['definitions'])
 * // Result:
 * // {
 * //   foo: {
 * //     $ref: '#/definitions/components/schemas/User'
 * //   }
 * // }
 * ```
 */
export function prefixInternalRefRecursive(input, prefix) {
    if (Array.isArray(input)) {
        input.forEach((el) => prefixInternalRefRecursive(el, prefix));
        return;
    }
    if (!isObject(input)) {
        return;
    }
    Object.values(input).forEach((el) => prefixInternalRefRecursive(el, prefix));
    if (typeof input === 'object' && '$ref' in input && typeof input['$ref'] === 'string') {
        const ref = input['$ref'];
        if (!isLocalRef(ref)) {
            return;
        }
        input['$ref'] = prefixInternalRef(ref, prefix);
    }
}
/**
 * Resolves and copies referenced values from a source document to a target document.
 * This function traverses the document and copies referenced values to the target document,
 * while tracking processed references to avoid duplicates. It only processes references
 * that belong to the same external document.
 *
 * @param targetDocument - The document to copy referenced values to
 * @param sourceDocument - The source document containing the references
 * @param referencePath - The JSON pointer path to the reference
 * @param externalRefsKey - The key used for external references (e.g. 'x-ext')
 * @param documentKey - The key identifying the external document
 * @param bundleLocalRefs - Also bundles the local refs
 * @param processedNodes - Set of already processed nodes to prevent duplicates
 * @example
 * ```ts
 * const source = {
 *   components: {
 *     schemas: {
 *       User: {
 *         $ref: '#/x-ext/users~1schema/definitions/Person'
 *       }
 *     }
 *   }
 * }
 *
 * const target = {}
 * resolveAndCopyReferences(
 *   target,
 *   source,
 *   '/components/schemas/User',
 *   'x-ext',
 *   'users/schema'
 * )
 * // Result: target will contain the User schema with resolved references
 * ```
 */
export const resolveAndCopyReferences = (targetDocument, sourceDocument, referencePath, externalRefsKey, documentKey, bundleLocalRefs = false, processedNodes = new Set(), documentMetadata = {}) => {
    const referencedValue = getValueByPath(sourceDocument, getSegmentsFromPath(referencePath)).value;
    if (processedNodes.has(referencedValue)) {
        return;
    }
    processedNodes.add(referencedValue);
    // Only relocated copies need canonical metadata; keep the authored source unchanged.
    const segments = getSegmentsFromPath(referencePath);
    const copiedValue = segments.length === 2 && isObject(referencedValue) && Object.keys(documentMetadata).length > 0
        ? { ...referencedValue, ...documentMetadata }
        : referencedValue;
    setValueAtPath(targetDocument, referencePath, copiedValue);
    // Keep every enclosing base when copying a subtree, so later partial bundles
    // resolve against the same document and schema resources as the original.
    for (let length = 2; length < segments.length; length++) {
        const ancestorPath = segments.slice(0, length);
        const ancestor = getValueByPath(sourceDocument, ancestorPath).value;
        if (!isObject(ancestor)) {
            continue;
        }
        if (length === 2) {
            for (const [key, value] of Object.entries(documentMetadata)) {
                setValueAtPath(targetDocument, `/${[...ancestorPath, key].map(escapeJsonPointer).join('/')}`, value);
            }
        }
        if (typeof ancestor.$id === 'string') {
            setValueAtPath(targetDocument, `/${[...ancestorPath, '$id'].map(escapeJsonPointer).join('/')}`, ancestor.$id);
        }
    }
    // Do the same for each local ref
    const traverse = (node) => {
        if (!node || typeof node !== 'object') {
            return;
        }
        if ('$ref' in node && typeof node['$ref'] === 'string') {
            // We only process references from the same external document because:
            // 1. Other documents will be handled in separate recursive branches
            // 2. The source document only contains the current document's content
            // This prevents undefined behavior and maintains proper document boundaries
            if (node['$ref'].startsWith(`#/${externalRefsKey}/${escapeJsonPointer(documentKey)}`)) {
                resolveAndCopyReferences(targetDocument, sourceDocument, node['$ref'].substring(1), externalRefsKey, documentKey, bundleLocalRefs, processedNodes, documentMetadata);
            }
            // Bundle the local refs as well
            else if (bundleLocalRefs) {
                resolveAndCopyReferences(targetDocument, sourceDocument, node['$ref'].substring(1), externalRefsKey, documentKey, bundleLocalRefs, processedNodes, documentMetadata);
            }
        }
        for (const value of Object.values(node)) {
            traverse(value);
        }
    };
    traverse(referencedValue);
};
/**
 * Extension keys used for bundling external references in OpenAPI documents.
 * These custom extensions help maintain the structure and traceability of bundled documents.
 */
export const extensions = {
    /**
     * Custom OpenAPI extension key used to store external references.
     * This key will contain all bundled external documents.
     * The x-ext key is used to maintain a clean separation between the main
     * OpenAPI document and its bundled external references.
     */
    externalDocuments: 'x-ext',
    /**
     * Custom OpenAPI extension key used to maintain a mapping between
     * hashed keys and their original URLs in x-ext.
     * This mapping is essential for tracking the source of bundled references
     */
    externalDocumentsMappings: 'x-ext-urls',
};
/**
 * Bundles an OpenAPI specification by resolving all external references.
 * This function traverses the input object recursively and embeds external $ref
 * references into an x-ext section. External references can be URLs or local files.
 * The original $refs are updated to point to their embedded content in the x-ext section.
 * If the input is an object, it will be modified in place by adding an x-ext
 * property to store resolved external references.
 *
 * @param input - The OpenAPI specification to bundle. Can be either an object or string.
 *                If a string is provided, it will be resolved using the provided plugins.
 *                If no plugin can process the input, the onReferenceError hook will be invoked
 *                and an error will be emitted to the console.
 * @param config - Configuration object containing plugins and options for bundling OpenAPI specifications
 * @returns A promise that resolves to the bundled specification with all references embedded
 * @example
 * // Example with object input
 * const spec = {
 *   paths: {
 *     '/users': {
 *       $ref: 'https://example.com/schemas/users.yaml'
 *     }
 *   }
 * }
 *
 * const bundled = await bundle(spec, {
 *   plugins: [fetchUrls()],
 *   treeShake: true,
 *   urlMap: true,
 *   hooks: {
 *     onResolveStart: (ref) => console.log('Resolving:', ref.$ref),
 *     onResolveSuccess: (ref) => console.log('Resolved:', ref.$ref),
 *     onResolveError: (ref) => console.log('Failed to resolve:', ref.$ref)
 *   }
 * })
 * // Result:
 * // {
 * //   paths: {
 * //     '/users': {
 * //       $ref: '#/x-ext/abc123'
 * //     }
 * //   },
 * //   'x-ext': {
 * //     'abc123': {
 * //       // Resolved content from users.yaml
 * //     }
 * //   },
 * //   'x-ext-urls': {
 * //     'https://example.com/schemas/users.yaml': 'abc123'
 * //   }
 * // }
 *
 * // Example with URL input
 * const bundledFromUrl = await bundle('https://example.com/openapi.yaml', {
 *   plugins: [fetchUrls()],
 *   treeShake: true,
 *   urlMap: true,
 *   hooks: {
 *     onResolveStart: (ref) => console.log('Resolving:', ref.$ref),
 *     onResolveSuccess: (ref) => console.log('Resolved:', ref.$ref),
 *     onResolveError: (ref) => console.log('Failed to resolve:', ref.$ref)
 *   }
 * })
 * // The function will first fetch the OpenAPI spec from the URL,
 * // then bundle all its external references into the x-ext section
 */
export async function bundle(input, config) {
    // Set the default external documents key and mappings key if not provided in the config
    config.externalDocumentsKey = config.externalDocumentsKey ?? extensions.externalDocuments;
    config.externalDocumentsMappingsKey = config.externalDocumentsMappingsKey ?? extensions.externalDocumentsMappings;
    // Cache for storing promises of resolved external references (URLs and local files)
    // to avoid duplicate fetches/reads of the same resource
    const cache = config.cache ?? new Map();
    const loaderPlugins = config.plugins.filter((it) => it.type === 'loader');
    const lifecyclePlugin = config.plugins.filter((it) => it.type === 'lifecycle');
    /**
     * Resolves the input value by either returning it directly if it's not a string,
     * or attempting to resolve it using the provided plugins if it is a string.
     * @returns The resolved input data or throws an error if resolution fails
     */
    const resolveInput = async () => {
        if (typeof input !== 'string') {
            return input;
        }
        const result = await resolveContents(input, loaderPlugins);
        if (result.ok && typeof result.data === 'object') {
            return result.data;
        }
        throw new Error('Failed to resolve input: Please provide a valid string value or pass a loader to process the input');
    };
    // Resolve the input specification, which could be either a direct object or a string URL/path
    const rawSpecification = await resolveInput();
    // Document root used to write all external documents
    // We need this when we want to do a partial bundle of a document
    const documentRoot = config.root ?? rawSpecification;
    // Determines if the bundling operation is partial.
    // Partial bundling occurs when:
    // - A root document is provided that is different from the raw specification being bundled, or
    // - A maximum depth is specified in the config.
    // In these cases, only a subset of the document may be bundled.
    const isPartialBundling = (config.root !== undefined && config.root !== rawSpecification) || config.depth !== undefined;
    // Set of nodes that have already been processed during bundling to prevent duplicate processing
    const processedNodes = config.visitedNodes ?? new Set();
    // Determines the initial origin path for the bundler based on the input type.
    // For string inputs that are URLs or file paths, uses the input as the origin.
    // For non-string inputs or other string types, returns an '/' as a root path.
    const getDefaultOrigin = () => {
        if (config.origin) {
            return config.origin;
        }
        if (typeof input !== 'string') {
            return '/';
        }
        if (isHttpUrl(input) || isFilePath(input)) {
            return input;
        }
        return '/';
    };
    const references = documentReferences(config.externalDocumentsKey, (document, retrievalUri) => {
        for (const resolver of [
            config.hooks?.resolveDocument,
            ...lifecyclePlugin.map((plugin) => plugin.resolveDocument),
        ]) {
            const identity = resolver?.(document, retrievalUri);
            if (identity !== undefined) {
                return identity;
            }
        }
        return undefined;
    });
    references.register(documentRoot, getDefaultOrigin());
    const defaultOrigin = references.origin(documentRoot) ?? getDefaultOrigin();
    const hasRootIdentity = references.identity(documentRoot) !== undefined || getId(documentRoot) !== undefined;
    const referenceToRoot = (pointer, sourceOrigin) => {
        return hasRootIdentity && references.isSchemaResource(sourceOrigin) && sourceOrigin !== defaultOrigin
            ? `${defaultOrigin}${pointer}`
            : pointer;
    };
    // Create the cache to store the compressed values to their map values
    if (documentRoot[config.externalDocumentsMappingsKey] === undefined) {
        documentRoot[config.externalDocumentsMappingsKey] = {};
    }
    const { generate } = uniqueValueGeneratorFactory(config.compress ?? getHash, documentRoot[config.externalDocumentsMappingsKey]);
    // Index supplied and previously bundled documents before resolving canonical identities.
    const storedDocuments = documentRoot[config.externalDocumentsKey];
    if (isObject(storedDocuments)) {
        for (const [key, document] of Object.entries(storedDocuments)) {
            const retrievalUri = resolveReferencePath(defaultOrigin, documentRoot[config.externalDocumentsMappingsKey][key] ?? key);
            references.register(document, retrievalUri, [config.externalDocumentsKey, key]);
        }
    }
    for (const [uri, pending] of cache) {
        const result = await pending;
        if (result.ok) {
            const retrievalUri = resolveReferencePath(defaultOrigin, uri);
            const relativeUri = toRelativePath(retrievalUri, defaultOrigin);
            const key = await generate(relativeUri);
            references.register(result.data, retrievalUri, [config.externalDocumentsKey, key]);
        }
    }
    /**
     * Executes lifecycle hooks defined both in the bundler configuration and any extended lifecycle plugins.
     * This utility function ensures that all relevant hooks for a given event type are called in order:
     * - First, the hook directly provided via the config (if present)
     * - Then, all matching hooks from registered lifecycle plugins (if present)
     *
     * Hooks are awaited in sequence for the given event type and argument list.
     *
     * @param type The hook event type, corresponding to a key of Config['hooks'].
     * @param args Arguments to pass to the hook function, matching HookFn<T>.
     */
    const executeHooks = async (type, ...args) => {
        // Run hook defined directly in config, if present
        const hook = config.hooks?.[type];
        if (hook) {
            await hook(...args);
        }
        // Additionally run the hook for every lifecycle plugin, if present
        for (const plugin of lifecyclePlugin) {
            const pluginHook = plugin[type];
            if (pluginHook) {
                await pluginHook(...args);
            }
        }
    };
    const bundler = async (root, origin = defaultOrigin, isChunkParent = false, depth = 0, currentPath = [], parent = null, referencedFromPath) => {
        // If a maximum depth is set in the config, stop bundling when the current depth reaches or exceeds it
        if (config.depth !== undefined && depth > config.depth) {
            return;
        }
        if (!isObject(root) && !Array.isArray(root)) {
            return;
        }
        // Skip if this node has already been processed to prevent infinite recursion
        // and duplicate processing of the same node
        if (processedNodes.has(root)) {
            return;
        }
        // Mark this node as processed before continuing
        processedNodes.add(root);
        // A node with its own `$id` establishes a new base for resolving relative references within it.
        // Fall back to the origin inherited from the parent document otherwise.
        const id = getId(root);
        const nodeOrigin = references.origin(root) ?? (id ? resolveReferencePath(origin, id) : origin);
        const context = {
            path: currentPath,
            referencedFromPath,
            resolutionCache: cache,
            parentNode: parent,
            rootNode: documentRoot,
            loaders: loaderPlugins,
            origin: nodeOrigin,
        };
        await executeHooks('onBeforeNodeProcess', root, context);
        if (hasRef(root)) {
            const ref = root['$ref'];
            const isChunk = '$global' in root && typeof root['$global'] === 'boolean' && root['$global'];
            // Try to convert the reference to a local reference if possible
            // This handles cases where the reference points to a local schema using $id or $anchor
            // If it can be converted to a local reference, we do not need to bundle it
            // and can skip further processing for this reference
            // In case of partial bundling, we still need to ensure that all dependencies
            // of the local reference are bundled to create a complete and self-contained partial bundle
            // This is important to maintain the integrity of the partial bundle
            const local = references.resolve(ref, nodeOrigin);
            const localRef = local?.path;
            if (localRef !== undefined) {
                // A fragment under an embedded $id resolves within that schema, not the document.
                // Without a declared root identity, retain references to root resources rather
                // than baking a retrieval location into an otherwise portable bundle.
                const preserveRootResourceReference = !hasRootIdentity &&
                    local.document === documentRoot &&
                    references.isSchemaResource(nodeOrigin) &&
                    nodeOrigin !== defaultOrigin;
                if (!local.preserveReference && !preserveRootResourceReference) {
                    root.$ref = referenceToRoot(localRef ? `#/${localRef}` : '#', nodeOrigin);
                }
                if (isPartialBundling) {
                    const segments = getSegmentsFromPath(`/${localRef}`);
                    const parent = segments.length > 0 ? getValueByPath(documentRoot, segments.slice(0, -1)).value : undefined;
                    const targetValue = {
                        value: local.value,
                        context: isObject(local.value) ? references.origin(local.value) : nodeOrigin,
                    };
                    // When doing partial bundling, we need to recursively bundle all dependencies
                    // referenced by this local reference to ensure the partial bundle is complete.
                    // This includes not just the direct reference but also all its dependencies,
                    // creating a complete and self-contained partial bundle.
                    //
                    // The pointer addresses the root document, so the target's base is the nearest `$id` on
                    // the way to it, else the document origin. `getValueByPath` reports no `$id` as an empty
                    // string, and handing that on as the origin left a relative reference under the target
                    // (a chunk reference written relative to the document) with nothing to resolve against.
                    await bundler(targetValue.value, targetValue.context || defaultOrigin, isChunkParent, depth + 1, segments, parent, referencedFromPath);
                }
                if (local.documentPath.length > 0) {
                    const origin = isObject(local.document) || Array.isArray(local.document) ? references.origin(local.document) : nodeOrigin;
                    await bundler(local.document, origin, isChunkParent, depth + 1, local.documentPath);
                    if (config.treeShake) {
                        const [key, documentKey] = local.documentPath;
                        resolveAndCopyReferences(documentRoot, { [key]: { [documentKey]: local.document } }, `/${localRef}`, key, documentKey, false, new Set(), references.identity(local.document)?.metadata);
                    }
                    else {
                        const metadata = references.identity(local.document)?.metadata;
                        setValueAtPath(documentRoot, `/${local.documentPath.map(escapeJsonPointer).join('/')}`, isObject(local.document) && metadata ? { ...local.document, ...metadata } : local.document);
                    }
                }
                await executeHooks('onAfterNodeProcess', root, context);
                return;
            }
            const [prefix, path = ''] = ref.split('#', 2);
            // Combine the current origin with the new path to resolve relative references
            // correctly within the context of the external file being processed
            const resolvedPath = resolveReferencePath(nodeOrigin, prefix);
            const relativePath = toRelativePath(resolvedPath, defaultOrigin);
            // Generate a unique compressed path for the external document
            // This is used as a key to store and reference the bundled external document
            // The compression helps reduce the overall file size of the bundled document
            const compressedPath = await generate(relativePath);
            const seen = cache.has(relativePath);
            if (!seen) {
                cache.set(relativePath, resolveContents(resolvedPath, loaderPlugins));
            }
            await executeHooks('onResolveStart', root);
            // Resolve the remote document
            const result = await cache.get(relativePath);
            if (result.ok) {
                // Process the result only once to avoid duplicate processing and prevent multiple prefixing
                // of internal references, which would corrupt the reference paths
                if (!seen) {
                    // Index the whole external document before following references within it.
                    // Chunks retain the referring context because they are already self-contained.
                    if (!isChunk) {
                        references.register(result.data, resolvedPath, [config.externalDocumentsKey, compressedPath]);
                    }
                    // Recursively process the resolved content
                    // to handle any nested references it may contain. We pass the resolvedPath as the new origin
                    // to ensure any relative references within this content are resolved correctly relative to
                    // their new location in the bundled document.
                    await bundler(result.data, isChunk ? origin : resolvedPath, isChunk, depth + 1, [config.externalDocumentsKey, compressedPath], null, 
                    // Keep the referring document path across external hops, replacing the storage wrapper.
                    referencedFromPath ? [...referencedFromPath, ...currentPath.slice(2)] : currentPath);
                    // Store the mapping between hashed keys and original URLs in x-ext-urls
                    // This allows tracking which external URLs were bundled and their corresponding locations
                    setValueAtPath(documentRoot, `/${config.externalDocumentsMappingsKey}/${escapeJsonPointer(compressedPath)}`, relativePath);
                }
                if (config.treeShake === true) {
                    // Store only the subtree that is actually used
                    // This optimizes the bundle size by only including the parts of the external document
                    // that are referenced, rather than the entire document
                    resolveAndCopyReferences(documentRoot, { [config.externalDocumentsKey]: { [compressedPath]: result.data } }, prefixInternalRef(`#${path}`, [config.externalDocumentsKey, compressedPath]).substring(1), config.externalDocumentsKey, compressedPath, false, new Set(), references.identity(result.data)?.metadata);
                }
                else if (!seen) {
                    // Store the external document in the main document's x-ext key
                    // When tree shaking is disabled, we include the entire external document
                    // This preserves all content and is faster since we don't need to analyze and copy
                    // specific parts. This approach is ideal when storing the result in memory
                    // as it avoids the overhead of tree shaking operations
                    const metadata = references.identity(result.data)?.metadata;
                    setValueAtPath(documentRoot, `/${config.externalDocumentsKey}/${compressedPath}`, isObject(result.data) && metadata ? { ...result.data, ...metadata } : result.data);
                }
                // Update the $ref to point to the embedded document in x-ext
                // This is necessary because we need to maintain the correct path context
                // for the embedded document while preserving its internal structure
                root.$ref = referenceToRoot(prefixInternalRef(`#${path}`, [config.externalDocumentsKey, compressedPath]), nodeOrigin);
                await executeHooks('onResolveSuccess', root);
                await executeHooks('onAfterNodeProcess', root, context);
                return;
            }
            await executeHooks('onResolveError', root);
            await executeHooks('onAfterNodeProcess', root, context);
            return console.warn(`Failed to resolve external reference "${resolvedPath}". The reference may be invalid, inaccessible, or missing a loader for this type of reference.`);
        }
        // Recursively traverse all child properties of the current object to resolve nested $ref references.
        // This step ensures that any $refs located deeper within the object hierarchy are discovered and processed.
        // We explicitly skip the extension keys (x-ext and x-ext-urls) to avoid reprocessing already bundled or mapped content.
        for (const key in root) {
            if (key === config.externalDocumentsKey || key === config.externalDocumentsMappingsKey) {
                continue;
            }
            await bundler(root[key], nodeOrigin, isChunkParent, depth + 1, [...currentPath, key], root, referencedFromPath);
        }
        await executeHooks('onAfterNodeProcess', root, context);
    };
    await bundler(rawSpecification);
    // Keep urlMappings when doing partial bundling to track hash values and handle collisions
    // For full bundling without urlMap config, remove the mappings to clean up the output
    if (!config.urlMap && !isPartialBundling) {
        // Remove the external document mappings from the output when doing a full bundle without urlMap config
        delete documentRoot[config.externalDocumentsMappingsKey];
    }
    return rawSpecification;
}
