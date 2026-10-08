import type { LoaderPlugin } from '../../../bundle/index.js';
type FetchConfig = Partial<{
    headers: {
        headers: HeadersInit;
        domains: string[];
    }[];
    fetch: (input: string | URL | globalThis.Request, init?: RequestInit) => Promise<Response>;
}>;
/**
 * Creates a browser-safe plugin for handling remote URL references.
 */
export declare const fetchUrls: (config?: FetchConfig & Partial<{
    limit: number | null;
}>) => LoaderPlugin;
export {};
//# sourceMappingURL=browser.d.ts.map