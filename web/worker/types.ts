export interface Identity { id: string; email: string }
export interface Env {
  DB: D1Database; IMAGES: KVNamespace; ASSETS: Fetcher;
  AUTH_PEPPER: string; TURNSTILE_SITE_KEY: string; TURNSTILE_SECRET_KEY: string;
}
export type Authenticate = (request: Request, env: Env) => Promise<Identity>;
