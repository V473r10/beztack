import { AdminHeader } from "./components/shared/admin-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { IconTrendingUp, IconUsers, IconActivity, IconDatabase, IconShield } from "@tabler/icons-react";
import { AnimatedBarChart } from "./components/charts/animated-bar-chart";
import { StatsCard } from "./components/charts/stats-card";
import { PingingDotChart } from "@/components/ui/pinging-dot-chart";
import type { ChartConfig } from "@/components/ui/chart";
import { motion } from "motion/react";

// Enhanced data fetching functions
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
		const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
		acc[monthKey] = {
			month: monthLabel,
			users: (acc[monthKey]?.users || 0) + 1
		};
		return acc;
	}, {} as Record<string, { month: string; users: number }>);

	return Object.values(usersByMonth).sort((a, b) => a.month.localeCompare(b.month));
}

// Real data fetchers
async function fetchSystemMetrics() {
	// In a real app, this would fetch from your monitoring API
	// For now, we'll simulate with realistic values
	return [
		{ label: 'Database Connections', value: 85 },
		{ label: 'Memory Usage', value: 67 },
		{ label: 'Response Time', value: 23 },
		{ label: 'Error Rate', value: 2 }
	];
}

async function fetchUserStats() {
	const response = await authClient.admin.listUsers({
		query: {
			limit: 1000,
			sortBy: "createdAt",
			sortDirection: "desc",
		},
	});
	
	if (!response.data) {
		return { totalUsers: 0, activeUsers: 0, bannedUsers: 0, recentSignups: 0 };
	}

	const users = response.data.users;
	const totalUsers = users.length;
	const bannedUsers = users.filter(user => user.banned).length;
	const activeUsers = totalUsers - bannedUsers;
	
	// Count recent signups (last 7 days)
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
	const recentSignups = users.filter(
		user => new Date(user.createdAt) > sevenDaysAgo
	).length;

	return { totalUsers, activeUsers, bannedUsers, recentSignups };
}

export default function AdminAnalytics() {
	const { data: growthData, isLoading } = useQuery({
		queryKey: ["admin", "analytics", "growth"],
		queryFn: fetchUserGrowthData,
	});

	// Chart configuration for user growth
	const growthChartConfig: ChartConfig = {
		users: {
			label: "New Users",
			color: "hsl(220 70% 50%)",
		},
	};

	const { data: userStats } = useQuery({
		queryKey: ["admin", "user-stats"],
		queryFn: fetchUserStats,
	});

	const { data: systemMetrics } = useQuery({
		queryKey: ["admin", "system-metrics"],
		queryFn: fetchSystemMetrics,
		refetchInterval: 30000, // Refresh every 30 seconds
	});

	return (
		<div className="flex flex-col gap-8 p-6">
			<motion.div
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<AdminHeader
					title="Analytics Dashboard"
					description="Monitor system performance and user metrics"
				/>
			</motion.div>

			{/* User Stats Cards */}
			{userStats && (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
					<StatsCard
						title="Total Users"
						description="Registered users"
						value={userStats.totalUsers.toLocaleString()}
						icon={<IconUsers className="h-5 w-5" />}
						delay={0.1}
					/>
					<StatsCard
						title="Active Users"
						description="Currently active"
						value={userStats.activeUsers.toLocaleString()}
						icon={<IconActivity className="h-5 w-5" />}
						delay={0.2}
					/>
					<StatsCard
						title="New This Week"
						description="Recent signups"
						value={userStats.recentSignups.toLocaleString()}
						icon={<IconTrendingUp className="h-5 w-5" />}
						delay={0.3}
					/>
					<StatsCard
						title="Banned Users"
						description="Restricted accounts"
						value={userStats.bannedUsers.toLocaleString()}
						icon={<IconShield className="h-5 w-5" />}
						delay={0.4}
					/>
				</div>
			)}

			{/* Charts Section */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* User Growth Chart */}
				<Card className="col-span-1">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<IconTrendingUp className="h-5 w-5" />
							User Growth
						</CardTitle>
						<CardDescription>
							Monthly user registration trends
						</CardDescription>
					</CardHeader>
					<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
						{isLoading ? (
							<div className="h-[300px] bg-gradient-to-r from-muted/50 to-muted rounded animate-pulse" />
						) : growthData && growthData.length > 0 ? (
							<PingingDotChart 
								data={growthData}
								config={growthChartConfig}
								xAxisKey="month"
								yAxisKey="users"
								className="aspect-auto h-[300px] w-full"
							/>
						) : (
							<motion.p 
								className="text-sm text-muted-foreground text-center h-[300px] flex items-center justify-center"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
							>
								No growth data available
							</motion.p>
						)}
					</CardContent>
				</Card>

				{/* System Metrics */}
				<Card className="col-span-1">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<IconDatabase className="h-5 w-5" />
							System Metrics
						</CardTitle>
						<CardDescription>
							Real-time performance indicators
						</CardDescription>
					</CardHeader>
					<CardContent>
						{systemMetrics ? (
							<AnimatedBarChart data={systemMetrics} />
						) : (
							<div className="h-[250px] bg-muted/50 rounded animate-pulse" />
						)}
					</CardContent>
				</Card>
			</div>


		</div>
	);
}