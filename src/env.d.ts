declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database
  }
}

declare module "*.sql?raw" {
  const content: string
  export default content
}

interface CacheStorage {
  default: Cache
}
