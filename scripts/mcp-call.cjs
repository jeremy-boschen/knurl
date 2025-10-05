// mcp-call.cjs
// Usage: node mcp-call.cjs <npm-package-or-path> <tool-name|list> [arguments.json]
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const TARGET = process.argv[2];
const TOOL = process.argv[3];
const ARGFILE = process.argv[4];

if (!TARGET || !TOOL) {
  console.error("Usage: node mcp-call.cjs <npm-package-or-path> <tool-name|list> [arguments.json]");
  process.exit(1);
}

// Optional env overrides
const TIMEOUT_MS = parseInt(process.env.MCP_TIMEOUT_MS || "30000", 10);

// Build runner fallback chain
function isPathLike(s) { return /[\\/]/.test(s) || /\.m?js$/.test(s); }
const candidates = [];

if (process.env.MCP_BIN) {
  const args = process.env.MCP_ARGS ? JSON.parse(process.env.MCP_ARGS) : [];
  candidates.push({ bin: process.env.MCP_BIN, args });
} else if (isPathLike(TARGET)) {
  candidates.push({ bin: "node", args: [TARGET] });
} else {
  candidates.push(
    { bin: "npx.cmd",  args: ["-y", TARGET] },
    { bin: "npm",  args: ["exec", "-y", TARGET] },
    { bin: "pnpm", args: ["dlx", TARGET] },
    { bin: "yarn", args: ["dlx", TARGET] },
    { bin: "bunx", args: [TARGET] }
  );
}

function trySpawn(seq, idx = 0) {
  if (idx >= seq.length) {
    console.error("Unable to spawn MCP server. Tried:", seq.map(c => `${c.bin} ${c.args.join(" ")}`).join(" | "));
    process.exit(1);
  }
  const isWin = process.platform === "win32";
  const needsShell = isWin; // safest on Windows due to .cmd/.bat behavior


  const c = seq[idx];
  const child = spawn(c.bin, c.args, { stdio: ["pipe", "pipe", "inherit"], windowsHide: true, shell: needsShell });
  child.once("error", (e) => {
    if (e.code === "ENOENT") trySpawn(seq, idx + 1);
    else { console.error(e); process.exit(1); }
  });
  child.stdout.once("data", () => { /* first output indicates it's alive */ });
  return child;
}

let nextId = 1;
const pending = new Map();
let buf = "";

function handleChunk(chunk) {
  buf += chunk.toString();
  const lines = buf.split(/\r?\n/);
  buf = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (process.env.MCP_VERBOSE) {
        console.error("[notif]", line);
      }
    } catch {
      if (process.env.MCP_VERBOSE) console.error("[non-json]", line);
    }
  }
}

function send(child, method, params, wantsResponse = true) {
  const id = wantsResponse ? nextId++ : undefined;
  const payload = { jsonrpc: "2.0", method, params };
  if (wantsResponse) payload.id = id;
  if (process.env.MCP_VERBOSE) console.error(">>>", JSON.stringify(payload));
  child.stdin.write(JSON.stringify(payload) + "\n");
  if (!wantsResponse) return Promise.resolve();
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

(async () => {
  const child = trySpawn(candidates);
  child.stdout.on("data", handleChunk);

  const timer = setTimeout(() => {
    console.error(`Timed out after ${TIMEOUT_MS}ms`);
    try { child.kill(); } catch {}
    process.exit(2);
  }, TIMEOUT_MS);

  process.on("SIGINT",  () => { try { child.kill(); } catch {}; process.exit(130); });
  process.on("SIGTERM", () => { try { child.kill(); } catch {}; process.exit(143); });
  child.on("exit", (code) => process.exit(code ?? 0));

  // Handshake (per MCP spec)
  await send(child, "initialize", { protocolVersion: "2025-06-18", capabilities: {} });
  await send(child, "notifications/client/initialized", {}, false);

  if (TOOL.toLowerCase() === "list") {
    const tools = await send(child, "tools/list", {});
    clearTimeout(timer);
    console.log(JSON.stringify(tools, null, 2));
    child.stdin.end();
    return;
  }

  const listed = await send(child, "tools/list", {});
  const names = new Set((listed?.tools || []).map(t => t.name));
  if (!names.has(TOOL)) {
    console.error(`Tool '${TOOL}' not found. Available: ${[...names].join(", ") || "(none)"}`);
    process.exit(2);
  }

  let argsObj = {};
  if (ARGFILE) {
    const raw = JSON.parse(fs.readFileSync(ARGFILE, "utf8"));
    argsObj = raw?.arguments && typeof raw.arguments === "object" ? raw.arguments : raw;
    if (typeof argsObj !== "object" || Array.isArray(argsObj)) {
      console.error("Arguments file must be a JSON object (the value for tools/call params.arguments).");
      process.exit(3);
    }
  }

  const result = await send(child, "tools/call", { name: TOOL, arguments: argsObj });
  clearTimeout(timer);
  console.log(JSON.stringify(result, null, 2));
  child.stdin.end();
})().catch(e => { console.error(e?.stack || String(e)); process.exit(1); });
