import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "letter-media";
const SIGNED_URL_TTL_SEC = 3600;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

/** Byte-identical body for wrong name and wrong passkey (and missing letter). */
const AUTH_ERROR_BODY = JSON.stringify({
  ok: false,
  error: "That name and passkey don't match. Try again?",
});

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(
  body: string,
  status: number,
  origin: string | null,
): Response {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_LIMIT) {
    return false;
  }

  bucket.count += 1;
  return true;
}

type LetterRpcResult = {
  ok: boolean;
  reason?: string;
  unlock_date?: string;
  friend?: Record<string, unknown>;
  letter?: Record<string, unknown>;
  media?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      405,
      origin,
    );
  }

  const ip = clientIp(req);
  if (!rateLimitOk(ip)) {
    return jsonResponse(
      JSON.stringify({ ok: false, error: "Too many attempts. Try again later." }),
      429,
      origin,
    );
  }

  let payload: { name?: string; passkey?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(AUTH_ERROR_BODY, 401, origin);
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const passkey = typeof payload.passkey === "string" ? payload.passkey : "";

  if (!name || !passkey) {
    return jsonResponse(AUTH_ERROR_BODY, 401, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse(
      JSON.stringify({ ok: false, error: "Server configuration error" }),
      500,
      origin,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("get_letter_for", {
    p_name: name,
    p_passkey: passkey,
  });

  if (error) {
    console.error("get_letter_for RPC failed", error.message);
    return jsonResponse(
      JSON.stringify({ ok: false, error: "Server error" }),
      500,
      origin,
    );
  }

  const result = data as LetterRpcResult;

  if (!result?.ok) {
    if (result?.reason === "locked") {
      return jsonResponse(
        JSON.stringify({
          ok: false,
          reason: "locked",
          unlock_date: result.unlock_date ?? null,
        }),
        200,
        origin,
      );
    }
    // no_match, no_letter — same opaque response (wrong name or wrong passkey)
    return jsonResponse(AUTH_ERROR_BODY, 401, origin);
  }

  const media = Array.isArray(result.media) ? result.media : [];
  const signedMedia = await Promise.all(
    media.map(async (item) => {
      const storagePath = item.storage_path;
      if (typeof storagePath !== "string" || !storagePath) {
        return { ...item, signed_url: null };
      }

      const { data: signed, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

      if (signError) {
        console.error("signed URL failed", storagePath, signError.message);
        return { ...item, signed_url: null };
      }

      return { ...item, signed_url: signed.signedUrl };
    }),
  );

  return jsonResponse(
    JSON.stringify({
      ok: true,
      friend: result.friend,
      letter: result.letter,
      media: signedMedia,
      settings: result.settings ?? {},
    }),
    200,
    origin,
  );
});
