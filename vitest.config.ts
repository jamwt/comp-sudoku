import fs from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";

const wasmModule: Plugin = {
  name: "wasm-as-module",
  enforce: "pre",
  load(id) {
    if (!id.endsWith(".wasm")) return null;
    const base64 = fs.readFileSync(id).toString("base64");
    return `const bytes = Uint8Array.from(atob("${base64}"), (c) => c.charCodeAt(0));
export default new WebAssembly.Module(bytes);`;
  },
};

export default defineConfig({
  plugins: [wasmModule],
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test", "password-hash-wasm"] } },
    include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
  },
});
