import { authClient } from "@/lib/auth-client";
import { useIsAdmin } from "@/lib/admin-utils";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export function AdminRoute({ children }: { children: ReactNode }) {
	const { data: session, isPending } = authClient.useSession();
	const isAdmin = useIsAdmin();
	const navigate = useNavigate();

	useEffect(() => {
		if (!isPending && !session) {
			// User not authenticated, redirect to sign in
			navigate("/auth/sign-in");
		} else if (!isPending && session && !isAdmin) {
			// User authenticated but not admin, redirect to home
			navigate("/");
		}
	}, [session, isPending, isAdmin, navigate]);

	if (isPending) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	// Only render children if user is authenticated and is admin
	if (session && isAdmin) {
		return <>{children}</>;
	}

	return null;
}