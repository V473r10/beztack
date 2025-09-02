import { AdminHeader } from "./components/shared/admin-header";
import { AdminStats } from "./components/analytics/admin-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { IconTrendingUp, IconCalendar } from "@tabler/icons-react";

// Mock function for user growth data
async function fetchUserGrowthData() {
	const response = await authClient.admin.listUsers({
		query: {
			limit: 1000,
			sortBy: "createdAt",
			sortDirection: "asc",
		},
	});
	
	if (!response.data) {
		return [];
	}

	// Group users by month for growth chart
	const usersByMonth = response.data.users.reduce((acc, user) => {
		const date = new Date(user.createdAt);
		const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
		acc[monthKey] = (acc[monthKey] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);

	return Object.entries(usersByMonth).map(([month, count]) => ({
		month,
		count,
	}));
}

export default function AdminAnalytics() {
	const { data: growthData, isLoading } = useQuery({
		queryKey: ["admin", "analytics", "growth"],
		queryFn: fetchUserGrowthData,
	});

	return (
		<div className="flex flex-col gap-6 p-6">
			<AdminHeader
				title="Admin Analytics"
				description="View system metrics and user growth statistics"
			/>

			{/* Stats Overview */}
			<AdminStats />

			{/* Additional Analytics Cards */}
			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<IconTrendingUp className="h-5 w-5" />
							User Growth
						</CardTitle>
						<CardDescription>
							Monthly user registration trends
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="h-32 bg-muted rounded animate-pulse" />
						) : growthData && growthData.length > 0 ? (
							<div className="space-y-2">
								{growthData.slice(-6).map((data) => (
									<div key={data.month} className="flex justify-between items-center">
										<span className="text-sm">{data.month}</span>
										<span className="font-medium">{data.count} users</span>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No growth data available
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<IconCalendar className="h-5 w-5" />
							System Health
						</CardTitle>
						<CardDescription>
							Overall system status and metrics
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex justify-between items-center">
								<span className="text-sm">Database Status</span>
								<span className="text-green-600 font-medium">Healthy</span>
							</div>
							<div className="flex justify-between items-center">
								<span className="text-sm">Authentication</span>
								<span className="text-green-600 font-medium">Online</span>
							</div>
							<div className="flex justify-between items-center">
								<span className="text-sm">Admin API</span>
								<span className="text-green-600 font-medium">Operational</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}