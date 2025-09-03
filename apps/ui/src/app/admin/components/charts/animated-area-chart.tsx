import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "motion/react";

interface AnimatedAreaChartProps {
  data: Array<{
    month: string;
    count: number;
  }>;
}

export function AnimatedAreaChart({ data }: AnimatedAreaChartProps) {
  // Transform data to have proper labels
  const chartData = data.map((item) => ({
    month: item.month.split('-')[1] ? `${item.month.split('-')[1]}/${item.month.split('-')[0]}` : item.month,
    count: item.count,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-[300px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
            </linearGradient>
            <filter id="glow">
              <feMorphology operator="dilate" radius="1" />
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-background border rounded-lg p-3 shadow-lg"
                  >
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-sm" style={{ color: 'hsl(var(--chart-1))' }}>
                      {payload[0].value} new users
                    </p>
                  </motion.div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#colorGradient)"
            filter="url(#glow)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
