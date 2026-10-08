import type { LookupAddress } from 'node:dns';
/**
 * Reports whether a hostname resolves to a private, loopback, link-local, or otherwise internal
 * address that a bundled `$ref` should not be allowed to reach.
 *
 * Literal IPs are checked directly. Hostnames are resolved via DNS and every returned address is
 * checked, so a name that points at an internal IP is rejected. A host that cannot be resolved is
 * treated as blocked.
 *
 * This lives in a Node-only module because it depends on `node:dns` and `node:net`. Load it with a
 * dynamic import so the browser build of the fetch plugin stays free of Node built-ins.
 *
 * @param hostname - The hostname or IP (brackets around an IPv6 literal are tolerated).
 */
export declare const isBlockedHost: (hostname: string) => Promise<boolean>;
/** Resolves a host once and returns only validated public addresses, or null when blocked. */
export declare const resolvePublicHost: (hostname: string) => Promise<LookupAddress[] | null>;
//# sourceMappingURL=is-blocked-host.d.ts.map