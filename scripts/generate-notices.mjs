import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
let result =
  "# Application license\n\n" +
  readFileSync("LICENSE", "utf8") +
  "\n\n# Third-party notices\n\n";
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path || pkg.dev || pkg.link) continue;
  const candidate = [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "license",
    "LICENSE-MIT",
  ].find((name) => existsSync(join(path, name)));
  result += `## ${path.replace(/^node_modules\//, "")} ${pkg.version}\n\nLicense: ${pkg.license ?? "see package"}\n\n`;
  if (candidate) result += readFileSync(join(path, candidate), "utf8") + "\n\n";
}
mkdirSync("public", { recursive: true });
writeFileSync("public/THIRD_PARTY_NOTICES.txt", result);
