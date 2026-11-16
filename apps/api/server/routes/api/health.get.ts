import { db } from "@beztack/db";
import { sql } from "drizzle-orm";
import { defineEventHandler, setResponseHeader, setResponseStatus } from "h3";

const HTTP_SERVICE_UNAVAILABLE = 503;
/** A database that does not answer in this time counts as unreachable. */
const DATABASE_TIMEOUT_MS = 5000;

async function databaseAnswers(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("database timeout")), DATABASE_TIMEOUT_MS);
  });
  try {
    await Promise.race([db.execute(sql`select 1`), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Liveness and database reachability for monitors. Public: no session, one
 * trivial query, and a body that carries no connection details or error text.
 */
export default defineEventHandler(async (event) => {
  const databaseUp = await databaseAnswers();

  setResponseHeader(event, "Cache-Control", "no-store");
  if (!databaseUp) {
    setResponseStatus(event, HTTP_SERVICE_UNAVAILABLE);
  }
  return databaseUp
    ? { status: "ok", database: "up" }
    : { status: "unavailable", database: "down" };
});
