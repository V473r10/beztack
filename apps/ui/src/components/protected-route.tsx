import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { getSignInPath } from "@/lib/auth-redirect";
import { authClient } from "@/lib/auth-client";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!(isPending || data)) {
      navigate(getSignInPath(location), { replace: true });
    }
  }, [data, isPending, navigate, location]);

  if (isPending) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (data) {
    return <>{children}</>;
  }

  return null;
}
