// Express `trust proxy` value.
//
// A hop count (never `true`) limits which X-Forwarded-For entries Express
// believes. 0 disables proxy trust entirely.
export function resolveTrustProxy(hops: number): number | false {
  return hops > 0 ? hops : false;
}
