import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AnimatedAreaChartProps {
  data: Array<{
    month: string;
    count: number;
  }>;
}

export function AnimatedAreaChart({ data }: AnimatedAreaChartProps) {
  // Transform data to have proper labels
  const chartData = data.map((item) => ({
    month: item.month.split("-")[1]
      ? `${item.month.split("-")[1]}/${item.month.split("-")[0]}`
      : item.month,
    count: item.count,
  }));

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="h-[300px] w-full"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorGradient" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="5%"
                stopColor="hsl(var(--chart-1))"
                stopOpacity={0.4}
              />
              <stop
                offset="95%"
                stopColor="hsl(var(--chart-1))"
                stopOpacity={0.1}
              />
            </linearGradient>
            <filter id="glow">
              <feMorphology operator="dilate" radius="1" />
              <feGaussianBlur result="coloredBlur" stdDeviation="2" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <XAxis
            axisLine={false}
            dataKey="month"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <motion.div
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-lg border bg-background p-3 shadow-lg"
                    initial={{ opacity: 0, scale: 0.9 }}
                  >
                    <p className="font-medium text-sm">{label}</p>
                    <p
                      className="text-sm"
                      style={{ color: "hsl(var(--chart-1))" }}
                    >
                      {payload[0].value} new users
                    </p>
                  </motion.div>
                );
              }
              return null;
            }}
          />
          <Area
            dataKey="count"
            fill="url(#colorGradient)"
            filter="url(#glow)"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
