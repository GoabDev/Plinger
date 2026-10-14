import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root, server: { host: "127.0.0.1", port: 43179, strictPort: true, fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] } },
  plugins: [{ name: "stub-server-actions", enforce: "pre", resolveId(source, importer) {
    if (source === "./actions" && importer?.replaceAll("\\", "/").endsWith("/app/scouter/login/referral-form.tsx")) return `${root}/mock-actions.ts`;
  } }],
});
