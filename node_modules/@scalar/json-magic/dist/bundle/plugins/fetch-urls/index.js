import { createLimiter } from '@scalar/helpers/general/create-limiter';
import { isHttpUrl } from '../../../helpers/is-http-url.js';
import { normalize } from '../../../helpers/normalize.js';
/**
 * Safely checks for host from a URL
 * Needed because we cannot create a URL from a relative remote URL ex: examples/openapi.json
 */
const getHost = (url) => {
    try {
        return new URL(url).host;
    }
    catch {
        return null;
    }
};
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
export async function fetchUrl(url, limiter, config) {
    try {
        const host = getHost(url);
        const headers = config?.headers?.find((a) => a.domains.find((d) => d === host) !== undefined)?.headers;
        const guarded = config?.blockPrivateNetworks && typeof window === 'undefined';
        const result = await limiter(async () => {
            if (guarded) {
                // A custom fetch can ignore the pinned connection and resolve the host again.
                if (config?.fetch) {
                    throw new Error('Custom fetch cannot be combined with private network blocking');
                }
                const { fetchPublicUrl } = await import('./fetch-public-url.js');
                return fetchPublicUrl(url, headers);
            }
            return (config?.fetch ?? fetch)(url, { headers });
        });
        if (result.ok) {
            const body = await result.text();
            return {
                ok: true,
                data: normalize(body),
                raw: body,
            };
        }
        const contentType = result.headers.get('Content-Type') ?? '';
        // Warn if the content type is HTML or XML as we only support JSON/YAML
        if (['text/html', 'application/xml'].includes(contentType)) {
            console.warn(`[WARN] We only support JSON/YAML formats, received ${contentType}`);
        }
        console.warn(`[WARN] Fetch failed with status ${result.status} ${result.statusText} for URL: ${url}`);
        return {
            ok: false,
        };
    }
    catch {
        console.warn(`[WARN] Failed to parse JSON/YAML from URL: ${url}`);
        return {
            ok: false,
        };
    }
}
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
export function fetchUrls(config) {
    // If there is a limit specified we limit the number of concurrent calls
    const limiter = config?.limit ? createLimiter(config.limit) : (fn) => fn();
    return {
        type: 'loader',
        validate: isHttpUrl,
        exec: (value) => fetchUrl(value, limiter, config),
    };
}
