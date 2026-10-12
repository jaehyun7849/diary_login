import fs from "node:fs";
const roots = ["app", "lib", "db", "contracts", "tests"];
const paths = [];
for (const root of roots) {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = dir + "/" + e.name;
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|mjs|json|css)$/.test(p) && !p.endsWith("report.json"))
        paths.push(p);
    }
  };
  walk(root);
}
paths.push(
  "docs/auth-implementation.md",
  "README.md",
  "package.json",
  "vite.config.ts",
  "drizzle.config.ts",
  "scripts/export-source.mjs",
);
for (const p of fs.readdirSync("drizzle"))
  if (p.endsWith(".sql")) paths.push("drizzle/" + p);
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync(
  "public/source-code.json",
  JSON.stringify(
    {
      description: "한걸음 과제7 주요 소스 · 비밀값과 사용자 자료 미포함",
      t06Commit: "704893d03fd11c581da6ecc192192a5458679add",
      files: Object.fromEntries(
        paths.map((p) => [p, fs.readFileSync(p, "utf8")]),
      ),
    },
    null,
    2,
  ),
);
fs.copyFileSync("contracts/pds-schema-v2.json", "public/pds-schema-v2.json");
fs.copyFileSync("contracts/pds-auth-v3.json", "public/pds-auth-v3.json");
fs.copyFileSync("docs/auth-implementation.md", "public/auth-implementation.md");
const evidence = fs.existsSync("public/auth-evidence.json")
  ? JSON.parse(fs.readFileSync("public/auth-evidence.json", "utf8"))
  : null;
fs.writeFileSync(
  "app/source/report.json",
  JSON.stringify(
    { text: fs.readFileSync("docs/auth-implementation.md", "utf8"), evidence },
    null,
    2,
  ),
);
