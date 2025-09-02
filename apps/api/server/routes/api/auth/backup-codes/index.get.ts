import { createError, defineEventHandler, toWebRequest } from "h3";
import { auth } from "@/server/utils/auth";

export default defineEventHandler(async (event) => {
  const headers = event.headers;

  const session = await auth.api.getSession({headers})

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  return auth.api.viewBackupCodes({ body: { userId: session.user.id } });
});