import type { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

// SDK 1.31 declares a possibly undefined sessionId against an exact optional field.
export function exactTransport(
  source: StreamableHTTPClientTransport,
): Transport {
  const transport: Transport = {
    start: () => source.start(),
    close: () => source.close(),
    send: (message, options) => source.send(message, options),
    setProtocolVersion: (version) => source.setProtocolVersion(version),
  };
  source.onmessage = (message) => {
    if (source.sessionId !== undefined) transport.sessionId = source.sessionId;
    else delete transport.sessionId;
    transport.onmessage?.(message);
  };
  source.onerror = (error) => transport.onerror?.(error);
  source.onclose = () => transport.onclose?.();
  return transport;
}
