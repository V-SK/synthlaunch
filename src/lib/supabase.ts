type SupabaseClient = {
  baseUrl: string;
  headers: Record<string, string>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
};

export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured');
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${baseUrl}/${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      const detail = text || res.statusText;
      throw new Error(`Supabase request failed (${res.status}): ${detail}`);
    }

    if (res.status === 204) {
      return null as T;
    }

    return (await res.json()) as T;
  }

  return { baseUrl, headers, request };
}
