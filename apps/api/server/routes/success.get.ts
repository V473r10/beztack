import { defineEventHandler, sendRedirect } from "h3";

const REDIRECT_STATUS = 302;
export default defineEventHandler((event) => {
  // Redirect to the success pag
  sendRedirect(event, "http://localhost:5173/", REDIRECT_STATUS);
});
