import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const index = process.argv.indexOf("-config");
const config = JSON.parse(readFileSync(process.argv[index + 1], "utf8"));
if (process.argv.includes("--exit-early")) process.exit(7);
const server = createServer((request, response) => {
  const management = request.url.startsWith("/v8/management");
  const key = management
    ? config.management["secret-key"]
    : config.access["api-keys"][0];
  response.setHeader("content-type", "application/json");
  if (request.headers.authorization !== `Bearer ${key}`) {
    response.writeHead(401).end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  response.end(JSON.stringify(management ? { files: [] } : { data: [] }));
});
server.listen(config.server.port, config.server.host);
