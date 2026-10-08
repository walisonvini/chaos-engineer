/** Format-specific document identity, supplied by the caller. */
export type DocumentIdentity = {
    /** Declared base URI, resolved relative to the retrieval URI when necessary. */
    baseUri: string;
    /** Root properties retained on copies embedded in the bundle; never applied to the source document. */
    metadata?: Record<string, unknown>;
};
/** Reads document identity without imposing a document format on the bundler. */
export type DocumentResolver = (document: unknown, retrievalUri: string) => DocumentIdentity | undefined;
/** Resolution metadata survives moving documents into the bundle. */
type DocumentReferences = {
    identity: (document: unknown) => DocumentIdentity | undefined;
    register: (document: unknown, retrievalUri: string, path?: string[]) => void;
    isSchemaResource: (uri: string) => boolean;
    origin: (node: object) => string | undefined;
    resolve: (ref: string, base: string) => {
        path: string;
        value: unknown;
        preserveReference: boolean;
        document: unknown;
        documentPath: string[];
    } | undefined;
};
/**
 * Indexes complete documents before following their references. A declared identity
 * can point to content already in memory even when that URI cannot be fetched.
 */
export declare const documentReferences: (externalDocumentsKey: string, resolveDocument?: DocumentResolver) => DocumentReferences;
export {};
//# sourceMappingURL=document-references.d.ts.map