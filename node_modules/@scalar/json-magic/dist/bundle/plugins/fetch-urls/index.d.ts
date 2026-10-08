import type { LoaderPlugin, ResolveResult } from '../../../bundle/index.js';
type FetchConfig = Partial<{
    headers: {
        headers: HeadersInit;
        domains: string[];
    }[];
    /** Custom transports cannot be combined with blockPrivateNetworks. */
    fetch: (input: string | URL | globalThis.Request, init?: RequestInit) => Promise<Response>;
    /**
     * When true, refuse to fetch URLs that resolve to a private, loopback, link-local, or otherwise
     * internal address. Only enforced in Node, where DNS resolution is available. Off by default so
     * existing callers keep working unchanged.
     */
    blockPrivateNetworks: boolean;
}>;
/**
 * Fetches and normalizes data from a remote URL
 * @param url - The URL to fetch data from
 * @returns A promise that resolves to either the normalized data or an error result
 * @example
 * ```ts
 * const result = await fetchUrl('https://api.example.com/data.json')
 * if (result.ok) {
 *   console.log(result.data) // The normalized data
 * } else {
 *   console.log('Failed to fetch data')
 * }
 * ```
 */
export declare function fetchUrl(url: string, limiter: <T>(fn: () => Promise<T>) => Promise<T>, config?: FetchConfig): Promise<ResolveResult>;
/**
 * Creates a plugin for handling remote URL references.
 * This plugin validates and fetches data from HTTP/HTTPS URLs.
 *
 * @returns A plugin object with validate and exec functions
 * @example
 * const urlPlugin = fetchUrls()
 * if (urlPlugin.validate('https://example.com/schema.json')) {
 *   const result = await urlPlugin.exec('https://example.com/schema.json')
 * }
 */
export declare function fetchUrls(config?: FetchConfig & Partial<{
    limit: number | null;
}>): LoaderPlugin;
export {};
//# sourceMappingURL=index.d.ts.map