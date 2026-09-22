import { defineConfig, sessionDrivers } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://growthcircuit.club",
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough",
    prerenderEnvironment: "node",
  }),
  integrations: [react(), sitemap({
    filter: (page) => ![/\/homepage-preview(?:\/|$)/, /\/auth(?:\/|$)/, /\/newsletter\/confirm(?:\/|$)/, /\/community(?:\/|$)/, /\/people\/(?:claim|edit|admin)(?:\/|$)/, /\/(?:apply|myspace|submit|builds|questions|tags|challenges)(?:\/|$)/].some((pattern) => pattern.test(new URL(page).pathname)),
  })],
  session: {
    driver: sessionDrivers.memory(),
  },
});
