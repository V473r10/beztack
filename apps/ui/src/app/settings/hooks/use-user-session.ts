import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { USER_QUERY_STALE_TIME } from "../lib/constants";

export function useUserSession() {
  return useQuery({
    queryKey: ["user-session"],
    queryFn: async () => {
      const session = await authClient.getSession();
      if (!session.data) {
        throw new Error("No session");
      }
      return session.data.user;
    },
    staleTime: USER_QUERY_STALE_TIME,
  });
}
