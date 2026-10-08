import { createLimiter } from '@scalar/helpers/general/create-limiter';
import { isHttpUrl } from '../../../helpers/is-http-url.js';
import { normalize } from '../../../helpers/normalize.js';
/**
 * Safely checks for host from a URL.
 * Needed because we cannot create a URL from a relative remote URL such as examples/openapi.json.
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
 * Fetches and normalizes data from a remote URL in a browser environment.
 */
const fetchUrl = async (url, limiter, config) => {
    try {
        const host = getHost(url);
        const headers = config?.headers?.find((a) => a.domains.find((d) => d === host) !== undefined)?.headers;
        const exec = config?.fetch ?? fetch;
        const result = await limiter(() => exec(url, { headers }));
        if (result.ok) {
            const body = await result.text();
            return { ok: true, data: normalize(body), raw: body };
        }
        const contentType = result.headers.get('Content-Type') ?? '';
        if (['text/html', 'application/xml'].includes(contentType)) {
            console.warn(`[WARN] We only support JSON/YAML formats, received ${contentType}`);
        }
        console.warn(`[WARN] Fetch failed with status ${result.status} ${result.statusText} for URL: ${url}`);
        return { ok: false };
    }
    catch {
        console.warn(`[WARN] Failed to parse JSON/YAML from URL: ${url}`);
        return { ok: false };
    }
};
/**
 * Creates a browser-safe plugin for handling remote URL references.
 */
export const fetchUrls = (config) => {
    const limiter = config?.limit ? createLimiter(config.limit) : (fn) => fn();
    return {
        type: 'loader',
        validate: isHttpUrl,
        exec: (value) => fetchUrl(value, limiter, config),
    };
};
