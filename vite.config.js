import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
	plugins: [topLevelAwait()],
	server: {
		hmr: false,
	},
});
