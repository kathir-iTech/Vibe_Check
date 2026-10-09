export const CLIENT_TIMEOUT_MS = 55_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = CLIENT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`VibeCheck request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}