import { createServer } from "node:http"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { extname, join, resolve } from "node:path"
import pc from "picocolors"
import { readManifest } from "../core/manifest.js"
import { buildUpdatePlan } from "../core/planner.js"
import {
	ensureTemplateRoot,
	resolveTemplateRoot,
} from "../core/post-checks.js"
import { writePlanReport } from "../core/report.js"
import { readTemplateVersion } from "../core/template-version.js"

interface InspectOptions {
	workspaceRoot: string
	templateRoot?: string
	refresh: boolean
	offline: boolean
	host?: string
	port?: number
}

interface SerializableChange {
	path: string
	type: "add" | "modify" | "delete"
	ownership: "template-owned" | "custom-owned" | "mixed"
	conflictReason?: string
	currentContent: string
	templateContent: string
}

interface InspectPayload {
	generatedAt: string
	workspaceRoot: string
	templateRoot: string
	fromVersion: string
	toVersion: string
	totalChanges: number
	conflicts: number
	skippedUnchangedTemplateFiles: number
	changes: SerializableChange[]
}

const DEFAULT_HOST = "127.0.0.1"
const DEFAULT_PORT = 3434

export async function runInspect(options: InspectOptions): Promise<void> {
	if (
		typeof options.port === "number" &&
		(!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)
	) {
		throw new Error("Invalid --port value. Use an integer between 0 and 65535.")
	}

	const templateRoot = await resolveTemplateRoot({
		workspaceRoot: options.workspaceRoot,
		templateRoot: options.templateRoot,
		refresh: options.refresh,
		offline: options.offline,
	})
	await ensureTemplateRoot(templateRoot)

	const manifest = await readManifest(options.workspaceRoot)
	const targetVersion = await readTemplateVersion(templateRoot)
	const plan = await buildUpdatePlan({
		workspaceRoot: options.workspaceRoot,
		templateRoot,
		manifest,
	})
	const reportPath = await writePlanReport(options.workspaceRoot, plan)
	const inspectRoot = join(options.workspaceRoot, ".beztack", "inspect")
	await mkdir(inspectRoot, { recursive: true })

	const payload: InspectPayload = {
		generatedAt: new Date().toISOString(),
		workspaceRoot: options.workspaceRoot,
		templateRoot,
		fromVersion: manifest.currentVersion,
		toVersion: targetVersion,
		totalChanges: plan.changes.length,
		conflicts: plan.conflicts.length,
		skippedUnchangedTemplateFiles: plan.skippedUnchangedTemplateFiles,
		changes: plan.changes.map((change) => ({
			path: change.path,
			type: change.type,
			ownership: change.ownership,
			conflictReason: change.conflictReason,
			currentContent: change.currentContent ?? "",
			templateContent: change.templateContent ?? "",
		})),
	}

	await writeFile(
		join(inspectRoot, "data.json"),
		`${JSON.stringify(payload, null, 2)}\n`,
		"utf-8",
	)
	await writeFile(join(inspectRoot, "index.html"), buildInspectHtml(), "utf-8")

	const host = options.host ?? DEFAULT_HOST
	const preferredPort = options.port ?? DEFAULT_PORT
	const server = createServer(async (request, response) => {
		await serveInspectStatic(inspectRoot, request.url ?? "/", response)
	})

	const actualPort = await listenOnAvailablePort(server, host, preferredPort)
	const url = `http://${host}:${actualPort}`

	process.stdout.write(
		`${pc.bold("Template inspect viewer")}\n` +
			`- URL: ${url}\n` +
			`- Changes: ${payload.totalChanges}\n` +
			`- Skipped unchanged template files: ${payload.skippedUnchangedTemplateFiles}\n` +
			`- Conflicts: ${payload.conflicts}\n` +
			`- Report: ${reportPath}\n` +
			`- Press Ctrl+C to stop the viewer\n`,
	)

	await new Promise<void>((resolvePromise) => {
		const closeServer = () => {
			server.close(() => {
				resolvePromise()
			})
		}

		process.once("SIGINT", closeServer)
		process.once("SIGTERM", closeServer)
	})
}

async function serveInspectStatic(
	inspectRoot: string,
	requestUrl: string,
	response: {
		writeHead: (statusCode: number, headers?: Record<string, string>) => void
		end: (data?: string) => void
	},
): Promise<void> {
	try {
		const relativePath = sanitizeRequestPath(requestUrl)
		const resolvedPath = resolve(inspectRoot, relativePath)
		if (!resolvedPath.startsWith(resolve(inspectRoot))) {
			response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" })
			response.end("Forbidden")
			return
		}

		const fileContents = await readFile(resolvedPath, "utf-8")
		response.writeHead(200, {
			"Content-Type": getContentType(resolvedPath),
			"Cache-Control": "no-store",
		})
		response.end(fileContents)
	} catch {
		response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
		response.end("Not found")
	}
}

function sanitizeRequestPath(requestUrl: string): string {
	if (requestUrl === "/" || requestUrl.length === 0) {
		return "index.html"
	}

	const withoutQuery = requestUrl.split("?")[0] ?? requestUrl
	return withoutQuery.replace(/^\/+/, "")
}

function getContentType(path: string): string {
	const extension = extname(path).toLowerCase()
	if (extension === ".html") {
		return "text/html; charset=utf-8"
	}
	if (extension === ".json") {
		return "application/json; charset=utf-8"
	}
	if (extension === ".js") {
		return "text/javascript; charset=utf-8"
	}
	if (extension === ".css") {
		return "text/css; charset=utf-8"
	}
	return "text/plain; charset=utf-8"
}

async function listenOnAvailablePort(
	server: {
		listen: (
			port: number,
			host: string,
			callback: () => void,
		) => void
		on: (event: "error", listener: (error: NodeJS.ErrnoException) => void) => void
		off: (event: "error", listener: (error: NodeJS.ErrnoException) => void) => void
		address: () => string | { port: number } | null
	},
	host: string,
	preferredPort: number,
): Promise<number> {
	return await new Promise<number>((resolvePromise, rejectPromise) => {
		const onError = (error: NodeJS.ErrnoException) => {
			if (error.code !== "EADDRINUSE") {
				rejectPromise(error)
				return
			}

			server.off("error", onError)
			server.listen(0, host, () => {
				const address = server.address()
				if (
					typeof address === "object" &&
					address !== null &&
					typeof address.port === "number"
				) {
					resolvePromise(address.port)
					return
				}
				rejectPromise(new Error("Failed to resolve viewer port"))
			})
		}

		server.on("error", onError)
		server.listen(preferredPort, host, () => {
			server.off("error", onError)
			const address = server.address()
			if (
				typeof address === "object" &&
				address !== null &&
				typeof address.port === "number"
			) {
				resolvePromise(address.port)
				return
			}
			rejectPromise(new Error("Failed to resolve viewer port"))
		})
	})
}

function buildInspectHtml(): string {
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Beztack Template Inspect</title>
  <style>
    :root {
      --bg: #0b1220;
      --panel: #111a2d;
      --panel-2: #1a2640;
      --text: #d7e1f5;
      --muted: #9ab0d4;
      --accent: #61e7b6;
      --danger: #ff7c7c;
      --border: #243555;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "JetBrains Mono", ui-monospace, monospace;
      background: radial-gradient(circle at top right, #172642, #0b1220 60%);
      color: var(--text);
      min-height: 100vh;
    }
    .layout {
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      min-height: 100vh;
    }
    .sidebar {
      border-right: 1px solid var(--border);
      background: linear-gradient(180deg, #0f192e, #0b1220);
      padding: 16px;
      overflow: auto;
    }
    .main {
      padding: 16px;
      overflow: auto;
    }
    .summary {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 14px;
      line-height: 1.6;
    }
    .search {
      width: 100%;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }
    .list {
      display: grid;
      gap: 8px;
    }
    .item {
      width: 100%;
      text-align: left;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
      border-radius: 10px;
      padding: 10px;
      cursor: pointer;
    }
    .item:hover { border-color: #3a5687; }
    .item.active { border-color: var(--accent); }
    .item-path {
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
    .item-meta {
      color: var(--muted);
      font-size: 11px;
      margin-top: 4px;
    }
    .chips {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .chip {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      color: var(--muted);
      background: var(--panel);
    }
    .chip.conflict { color: var(--danger); border-color: #6b2b2b; }
    .path {
      font-size: 14px;
      margin: 0 0 10px 0;
      color: var(--text);
      word-break: break-word;
    }
    .diff-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .panel {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--panel-2);
      overflow: hidden;
    }
    .panel h3 {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
    }
    pre {
      margin: 0;
      padding: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.4;
      font-size: 12px;
      min-height: 240px;
    }
    .line-add { background: rgba(97, 231, 182, 0.16); }
    .line-del { background: rgba(255, 124, 124, 0.14); }
    .hint {
      color: var(--muted);
      font-size: 12px;
    }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      margin-left: 8px;
      font-size: 10px;
      color: var(--muted);
    }
    @media (max-width: 960px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { border-right: 0; border-bottom: 1px solid var(--border); }
      .diff-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div id="summary" class="summary"></div>
      <input id="search" class="search" placeholder="Filter by file path..." />
      <div id="list" class="list"></div>
    </aside>
    <main class="main">
      <div id="detail"></div>
    </main>
  </div>
  <script type="module">
    const data = await fetch("./data.json").then((response) => response.json())
    const listElement = document.getElementById("list")
    const detailElement = document.getElementById("detail")
    const searchElement = document.getElementById("search")
    const summaryElement = document.getElementById("summary")

    summaryElement.textContent =
      "Changes: " + data.totalChanges +
      " | Skipped unchanged: " + data.skippedUnchangedTemplateFiles +
      " | Conflicts: " + data.conflicts +
      " | From " + data.fromVersion + " to " + data.toVersion

    let filteredChanges = [...data.changes]
    let activeIndex = 0

    renderList()
    renderDetail()

    searchElement.addEventListener("input", () => {
      const query = searchElement.value.toLowerCase().trim()
      filteredChanges = data.changes.filter((change) =>
        change.path.toLowerCase().includes(query)
      )
      activeIndex = 0
      renderList()
      renderDetail()
    })

    function renderList() {
      listElement.innerHTML = ""
      if (filteredChanges.length === 0) {
        const empty = document.createElement("div")
        empty.className = "hint"
        empty.textContent = "No changes match your filter."
        listElement.append(empty)
        return
      }

      for (const [index, change] of filteredChanges.entries()) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "item" + (index === activeIndex ? " active" : "")
        const conflictBadge = change.conflictReason
          ? '<span class="pill">conflict</span>'
          : ""
        button.innerHTML =
          '<div class="item-path">' + escapeHtml(change.path) + conflictBadge + "</div>" +
          '<div class="item-meta">' + change.type + " | " + change.ownership + "</div>"
        button.addEventListener("click", () => {
          activeIndex = index
          renderList()
          renderDetail()
        })
        listElement.append(button)
      }
    }

    async function renderDetail() {
      detailElement.innerHTML = ""
      if (filteredChanges.length === 0) {
        detailElement.innerHTML = '<p class="hint">No file selected.</p>'
        return
      }

      const change = filteredChanges[activeIndex]
      const wrapper = document.createElement("div")
      wrapper.innerHTML =
        '<div class="chips">' +
          '<div class="chip">Type: ' + change.type + "</div>" +
          '<div class="chip">Ownership: ' + change.ownership + "</div>" +
          (change.conflictReason
            ? '<div class="chip conflict">Conflict: ' + escapeHtml(change.conflictReason) + "</div>"
            : "") +
        "</div>" +
        '<h2 class="path">' + escapeHtml(change.path) + "</h2>"

      const diffRoot = document.createElement("div")
      const renderedByPierre = await tryRenderWithPierreDiffs(diffRoot, change)

      if (!renderedByPierre) {
        const fallback = renderFallbackDiff(change)
        diffRoot.append(fallback)
      }

      wrapper.append(diffRoot)
      detailElement.append(wrapper)
    }

    async function tryRenderWithPierreDiffs(container, change) {
      try {
        const module = await import("https://cdn.jsdelivr.net/npm/@pierre/diffs/+esm")
        const factory =
          module.createDiffView ||
          module.createDiffViewer ||
          module.renderDiff ||
          module.default

        if (typeof factory === "function") {
          const rendered = factory({
            oldValue: change.currentContent,
            newValue: change.templateContent,
            oldText: change.currentContent,
            newText: change.templateContent,
            mode: "split",
            container,
          })

          if (rendered instanceof Element) {
            container.append(rendered)
          }

          return true
        }

        if (typeof module.DiffViewer === "function") {
          const view = new module.DiffViewer({
            oldValue: change.currentContent,
            newValue: change.templateContent,
          })
          if (view instanceof Element) {
            container.append(view)
            return true
          }
        }

        return false
      } catch {
        return false
      }
    }

    function renderFallbackDiff(change) {
      const leftLines = splitLines(change.currentContent)
      const rightLines = splitLines(change.templateContent)
      const lineCount = Math.max(leftLines.length, rightLines.length)

      const grid = document.createElement("div")
      grid.className = "diff-grid"

      const leftPanel = document.createElement("section")
      leftPanel.className = "panel"
      leftPanel.innerHTML = "<h3>Workspace</h3>"

      const rightPanel = document.createElement("section")
      rightPanel.className = "panel"
      rightPanel.innerHTML = "<h3>Template</h3>"

      const leftPre = document.createElement("pre")
      const rightPre = document.createElement("pre")

      for (let index = 0; index < lineCount; index += 1) {
        const left = leftLines[index] ?? ""
        const right = rightLines[index] ?? ""
        const leftDiv = document.createElement("div")
        const rightDiv = document.createElement("div")

        leftDiv.textContent = left
        rightDiv.textContent = right

        if (left !== right) {
          if (left.length > 0) {
            leftDiv.className = "line-del"
          }
          if (right.length > 0) {
            rightDiv.className = "line-add"
          }
        }

        leftPre.append(leftDiv)
        rightPre.append(rightDiv)
      }

      leftPanel.append(leftPre)
      rightPanel.append(rightPre)
      grid.append(leftPanel, rightPanel)

      return grid
    }

    function splitLines(value) {
      if (value.length === 0) {
        return []
      }
      return value.replace(/\\r\\n/g, "\\n").split("\\n")
    }

    function escapeHtml(value) {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
    }
  </script>
</body>
</html>
`
}
