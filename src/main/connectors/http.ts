const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export async function connectorFetch(
  endpoint: URL,
  input: Request | URL | string,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== endpoint.origin)
    throw new Error(
      "The connector tried to send credentials to another origin.",
    );
  const originalSignal =
    init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const response = await fetch(input, {
    ...init,
    redirect: "error",
    signal: AbortSignal.any([
      ...(originalSignal ? [originalSignal] : []),
      AbortSignal.timeout(30000),
    ]),
  });
  if (!response.body) return response;
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    await response.body.cancel();
    throw new Error("The connector response exceeds the 4 MiB limit.");
  }
  const reader = response.body.getReader();
  let received = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          return;
        }
        received += chunk.value.byteLength;
        if (received > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error("The connector response exceeds the 4 MiB limit.");
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
