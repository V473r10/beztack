import { defineEventHandler, getQuery, sendRedirect } from "h3";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  sendRedirect(
    event,
    `http://localhost:5173/subscription-welcome?preapproval_id=${query.preapproval_id}`
  );
});
