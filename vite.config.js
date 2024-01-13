import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
	base: "",
	build: {
		outDir: "docs",
	},
	plugins: [topLevelAwait()],
	server: {
		hmr: false,
	},
});
