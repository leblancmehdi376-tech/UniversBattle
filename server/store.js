// Petite abstraction clé/valeur async. En local (aucune variable Redis
// définie), on utilise une Map en mémoire (comportement identique à avant).
// Sur Vercel, une fois un store Redis (Upstash, via Marketplace) lié au
// projet, on bascule sur @upstash/redis sans rien changer côté appelant.
// Deux conventions de noms sont acceptées: UPSTASH_REDIS_REST_* (défaut
// @upstash/redis) et KV_REST_API_* (anciennes intégrations Vercel KV).
const memory = new Map();

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const hasRedis = Boolean(REDIS_URL && REDIS_TOKEN);

let redisClientPromise = null;
async function getRedisClient() {
  if (!redisClientPromise) {
    redisClientPromise = import("@upstash/redis").then(
      ({ Redis }) => new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    );
  }
  return redisClientPromise;
}

export async function get(key) {
  if (hasRedis) {
    const redis = await getRedisClient();
    const value = await redis.get(key);
    return value ?? null;
  }
  return memory.has(key) ? memory.get(key) : null;
}

export async function set(key, value) {
  if (hasRedis) {
    const redis = await getRedisClient();
    await redis.set(key, value);
    return;
  }
  memory.set(key, value);
}

export async function del(key) {
  if (hasRedis) {
    const redis = await getRedisClient();
    await redis.del(key);
    return;
  }
  memory.delete(key);
}
