#!/usr/bin/env node

import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const mainScriptPath = resolve("dist", "index.js");
const shebang = "#!/usr/bin/env node\n";

async function processFile() {
	try {
		// Read the compiled file
		let content = await readFile(mainScriptPath, "utf8");

		// Prepend shebang if not already present
		if (!content.startsWith(shebang)) {
			content = shebang + content;
			await writeFile(mainScriptPath, content, "utf8");
			console.log(`Added shebang to ${mainScriptPath}`);
		} else {
			console.log(`Shebang already present in ${mainScriptPath}`);
		}

		// Make the file executable
		await chmod(mainScriptPath, 0o755); // rwxr-xr-x
		console.log(`Made ${mainScriptPath} executable.`);
	} catch (error) {
		console.error("Error during post-build processing:", error);
		process.exit(1);
	}
}

processFile();
