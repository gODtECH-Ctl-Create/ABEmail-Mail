import { getSupabaseAdmin } from '@/lib/supabase-admin';

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'limit' | 'unavailable' };

export async function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('consume_api_rate_limit', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max_requests: maxRequests,
  });

  if (error) {
    console.error('rate limiter unavailable', error);
    return { allowed: false, reason: 'unavailable' };
  }

  return data === true ? { allowed: true } : { allowed: false, reason: 'limit' };
}
