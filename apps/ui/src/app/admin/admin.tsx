import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminHeader } from "./components/shared/admin-header";
import { AdminStats } from "./components/analytics/admin-stats";
import { authClient } from "@/lib/auth-client";
import { formatRelativeTime } from "@/lib/admin-utils";
import { useQuery } from "@tanstack/react-query";
import { IconPlus, IconUsers } from "@tabler/icons-react";
import { Link } from "react-router";

// Mock function for recent activity - replace with actual admin API call  
async function fetchRecentActivity() {
	const response = await authClient.admin.listUsers({
		query: {
			limit: 5,
			sortBy: "createdAt",
			sortDirection: "desc",
		}
	});
	
	if (!response.data) {
		return [];
	}

	return response.data.users.map(user => ({
		id: user.id,
		type: "user_created" as const,
		message: `New user ${user.name || user.email} registered`,
		timestamp: user.createdAt,
		user: {
			name: user.name,
			email: user.email,
		},
	}));
}

export default function AdminDashboard() {
	const { data: recentActivity, isLoading } = useQuery({
		queryKey: ["admin", "recent-activity"],
		queryFn: fetchRecentActivity,
	});

	return (
		<div className="flex flex-col gap-6 p-6">
			<AdminHeader
				title="Admin Dashboard"
				description="Manage users and view system analytics"
				action={
					<Button asChild>
						<Link to="/admin/users">
							<IconUsers className="mr-2 h-4 w-4" />
							Manage Users
						</Link>
					</Button>
				}
			/>

			{/* Stats Overview */}
			<AdminStats />

			{/* Recent Activity */}
			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
						<CardDescription>
							Latest user registrations and system events
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 3 }).map((_, i) => (
									<div key={i} className="flex items-center space-x-3">
										<div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
										<div className="space-y-1 flex-1">
											<div className="h-4 bg-muted rounded animate-pulse" />
											<div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
										</div>
									</div>
								))}
							</div>
						) : recentActivity && recentActivity.length > 0 ? (
							<div className="space-y-4">
								{recentActivity.map((activity) => (
									<div key={activity.id} className="flex items-center space-x-3">
										<div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
											<IconUsers className="h-4 w-4 text-primary" />
										</div>
										<div className="space-y-1 flex-1">
											<p className="text-sm font-medium">
												{activity.message}
											</p>
											<p className="text-xs text-muted-foreground">
												{formatRelativeTime(activity.timestamp)}
											</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No recent activity to display
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
						<CardDescription>
							Common administrative tasks
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<Button asChild variant="outline" className="w-full justify-start">
							<Link to="/admin/users">
								<IconUsers className="mr-2 h-4 w-4" />
								View All Users
							</Link>
						</Button>
						<Button asChild variant="outline" className="w-full justify-start">
							<Link to="/admin/users?action=create">
								<IconPlus className="mr-2 h-4 w-4" />
								Create New User
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}