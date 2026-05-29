import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
    analytics: true,
  });
}

export async function checkRateLimit(ip: string): Promise<{ success: boolean; message?: string }> {
  if (!ratelimit) {
    // Modo graceful: se o usuário não configurou Upstash, pula o rate limit
    return { success: true };
  }

  try {
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return { success: false, message: "Too many requests. Please try again later." };
    }
    return { success: true };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { success: true }; // Falha aberta em caso de erro na rede Redis
  }
}
