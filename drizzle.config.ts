import { defineConfig } from "drizzle-kit";
export default defineConfig({
	dialect: "postgresql",
	out: "./drizzle",
	schema: "./drizzle/schema.ts",
	dbCredentials: {
		url:
			process.env.POSTGRES_URL ||
			"postgresql://skymoth:skymoth@127.0.0.1/skymoth",
	},
	// Print all statements
	verbose: true,
	// Always ask for confirmation
	strict: true,
});
