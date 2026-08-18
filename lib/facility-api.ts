import { env } from "cloudflare:workers";

type FacilityEnvelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

function runtimeValue(key: string) {
  return (env as unknown as Record<string, string | undefined>)[key] ?? "";
}

export function facilityApiEnabled() {
  return Boolean(runtimeValue("COMMON_FACILITY_GAS_URL"));
}

export async function facilityPublicGet<T>(action: string, data: Record<string, string>) {
  const url = new URL(runtimeValue("COMMON_FACILITY_GAS_URL"));
  url.searchParams.set("action", action);
  Object.entries(data).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!response.ok) throw new Error("FACILITY_API_UNAVAILABLE");
  const body = await response.json() as FacilityEnvelope<T>;
  if (!body.ok || body.data === undefined) throw new Error(body.error?.code || "FACILITY_API_ERROR");
  return body.data;
}

export async function facilityPost<T>(action: string, data: Record<string, unknown>, requestId = crypto.randomUUID()) {
  const url = runtimeValue("COMMON_FACILITY_GAS_URL");
  const apiToken = runtimeValue("FACILITY_API_TOKEN") || runtimeValue("RECEPTION_API_TOKEN");
  if (!url || !apiToken) throw new Error("FACILITY_API_NOT_CONFIGURED");
  const response = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ version: 1, action, requestId, deviceId: "MEMBER-CARD-WEB", apiToken, data }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("FACILITY_API_UNAVAILABLE");
  const body = await response.json() as FacilityEnvelope<T>;
  if (!body.ok || body.data === undefined) throw new Error(body.error?.code || "FACILITY_API_ERROR");
  return body.data;
}
