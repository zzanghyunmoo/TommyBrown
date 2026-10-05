import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { connectorFetch } from "../../src/main/connectors/http";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

it("bounds streamed and declared response sizes and never follows redirects", async () => {
  let destinationRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { location: "/destination" }).end();
    } else if (request.url === "/destination") {
      destinationRequests++;
      response.end("unexpected");
    } else if (request.url === "/declared") {
      response.writeHead(200, { "content-length": 5 * 1024 * 1024 });
      response.flushHeaders();
    } else if (request.url === "/streamed") {
      response.writeHead(200, { "transfer-encoding": "chunked" });
      response.end(Buffer.alloc(4 * 1024 * 1024 + 1, 65));
    } else response.end("within limit");
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  cleanup.push(
    () =>
      new Promise<void>((done, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : done()));
      }),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port");
  const endpoint = new URL(`http://127.0.0.1:${address.port}/`);
  expect(await (await connectorFetch(endpoint, endpoint)).text()).toBe(
    "within limit",
  );
  await expect(
    connectorFetch(endpoint, new URL("declared", endpoint)),
  ).rejects.toThrow(/4 MiB/);
  const streamed = await connectorFetch(
    endpoint,
    new URL("streamed", endpoint),
  );
  await expect(streamed.text()).rejects.toThrow(/4 MiB/);
  await expect(
    connectorFetch(endpoint, new URL("redirect", endpoint)),
  ).rejects.toThrow();
  await expect(
    connectorFetch(endpoint, "https://example.com/mcp"),
  ).rejects.toThrow(/another origin/);
  expect(destinationRequests).toBe(0);
});
