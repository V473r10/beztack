import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

const currentFile = fileURLToPath(import.meta.url)
const currentDir = dirname(currentFile)
const apiEnvPath = resolve(currentDir, "../../apps/api/.env")
const localEnvPath = resolve(currentDir, ".env")

config({ path: apiEnvPath })
config({ path: localEnvPath })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
	throw new Error(
		[
			"DATABASE_URL is required for drizzle-kit commands.",
			`Checked: ${apiEnvPath}`,
			`Checked: ${localEnvPath}`,
		].join("\n"),
	)
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
})
