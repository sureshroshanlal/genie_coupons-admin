import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [react(), tailwind({ config: "./tailwind.config.cjs" })],
  vite: {
    ssr: {
      noExternal: ["react-quill-new", "quill"], // 👈 do not SSR these
    },
  },
});
