#!/usr/bin/env node
// Uploads dist/ to the static hosting component on the deployment that
// CONVEX_DEPLOY_KEY selects, and prints the site URL.
//
//   node scripts/upload-static.mjs [preview-name]
//
// The static-hosting CLI drives `convex run` without a deployment flag, which
// a preview deploy key rejects. For a preview key this script runs the CLI
// against a stand-in `convex` package that adds `--preview-name` to every
// call. The preview name defaults to the current git branch.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(join(root, "package.json"));
const convexMain = join(
  dirname(require.resolve("convex/package.json")),
  "bin/main.js",
);
const staticHostingCli = join(
  dirname(require.resolve("@convex-dev/static-hosting/package.json")),
  "dist/cli/index.js",
);
const uploadArgs = ["upload", "--dist", join(root, "dist")];

const deployKey = process.env.CONVEX_DEPLOY_KEY ?? "";
if (!deployKey) {
  console.error("CONVEX_DEPLOY_KEY is not set.");
  process.exit(1);
}

function run(cwd) {
  const result = spawnSync(
    process.execPath,
    [staticHostingCli, ...uploadArgs],
    {
      cwd,
      stdio: "inherit",
    },
  );
  return result.status ?? 1;
}

if (!deployKey.startsWith("preview:")) {
  process.exit(run(root));
}

const previewName =
  process.argv[2] ||
  execFileSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf-8",
  }).trim();
if (!previewName) {
  console.error(
    "Pass the preview name: node scripts/upload-static.mjs <preview-name>",
  );
  process.exit(1);
}

const shim = mkdtempSync(join(tmpdir(), "convex-preview-shim-"));
const shimPackage = join(shim, "node_modules", "convex");
mkdirSync(join(shimPackage, "bin"), { recursive: true });
writeFileSync(
  join(shimPackage, "package.json"),
  JSON.stringify({ name: "convex" }),
);
writeFileSync(
  join(shimPackage, "bin", "main.js"),
  `const { spawnSync } = require("node:child_process");
const result = spawnSync(
  process.execPath,
  [${JSON.stringify(convexMain)}, ...process.argv.slice(2), "--preview-name", ${JSON.stringify(previewName)}],
  { cwd: ${JSON.stringify(root)}, stdio: "inherit" },
);
process.exit(result.status ?? 1);
`,
);

console.log(`Uploading dist/ to preview deployment "${previewName}"`);
const status = run(shim);
rmSync(shim, { recursive: true, force: true });
process.exit(status);
