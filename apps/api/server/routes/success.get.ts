import { defineEventHandler, sendRedirect } from "h3";

export default defineEventHandler((event) => {
  // Redirect to the success pag
  sendRedirect(event, "http://localhost:5173/", 302);
});
