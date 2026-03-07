import { defineEventHandler, getQuery, sendRedirect } from "h3";
import { env } from "@/env";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const preapprovalId = String(query.preapproval_id ?? "");
  const redirectBase = env.APP_URL;

  const redirectUrl = new URL("/subscription-welcome", redirectBase);
  if (preapprovalId) {
    redirectUrl.searchParams.set("preapproval_id", preapprovalId);
  }

  sendRedirect(
    event,
    redirectUrl.toString()
  );
});
