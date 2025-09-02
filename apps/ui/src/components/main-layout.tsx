import { Outlet } from "react-router";
import { useLocation } from "react-router";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";
import { TourProvider } from "./tour";
import { SidebarInset, SidebarProvider } from "./ui/sidebar";

export const MainLayout = () => {
	const location = useLocation();
	const { pathname } = location;

	const handleTourComplete = () => {
		if (pathname === "/") {
			localStorage.setItem("home_tour_completed", "true");
		}
		if (pathname === "/settings") {
			localStorage.setItem("settings_tour_completed", "true");
		}
	};
	return (
		<TourProvider onComplete={handleTourComplete}>
			<SidebarProvider
				style={
					{
						"--sidebar-width": "calc(var(--spacing) * 72)",
						"--header-height": "calc(var(--spacing) * 12)",
					} as React.CSSProperties
				}
			>
				<AppSidebar variant="inset" />
				<SidebarInset>
					<SiteHeader />
					<div className="flex flex-1 flex-col">
						<div className="@container/main flex flex-1 flex-col gap-2">
							<Outlet />
						</div>
					</div>
				</SidebarInset>
			</SidebarProvider>
		</TourProvider>
	);
};
