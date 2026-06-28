// Derived project (lncd) Custom-owned: API routes
import { db } from "./db";

export function registerRoute(path: string, handler: Function): void {
  console.log(`registering ${path}`);
}

registerRoute("/v1/lncd/items", () => ({ items: db.select().from(schema.items) }));
