import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "motion/react";

interface AnimatedBarChartProps {
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
}

export function AnimatedBarChart({ data }: AnimatedBarChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="h-[250px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.9} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="label" 
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-background border rounded-lg p-3 shadow-lg"
                  >
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-sm" style={{ color: 'hsl(var(--chart-2))' }}>
                      {payload[0].value}%
                    </p>
                  </motion.div>
                );
              }
              return null;
            }}
          />
          <Bar 
            dataKey="value" 
            fill="url(#barGradient)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
