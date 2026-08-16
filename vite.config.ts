// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// The project now points at a self-managed Supabase project. Values in .env must
// win over any pre-existing injected environment variables. loadEnv() reads .env
// and .env.local (if present) and returns the parsed map. We then overwrite
// process.env so SSR/server functions use the same values as the client build.
const env = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
for (const [key, value] of Object.entries(env)) {
  process.env[key] = value;
}

if (process.env["NODE_ENV"] === "development") {
  // eslint-disable-next-line no-console
  console.log(
    `[vite.config] Supabase project: ${process.env["VITE_SUPABASE_PROJECT_ID"] ?? "not set"}`,
  );
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
