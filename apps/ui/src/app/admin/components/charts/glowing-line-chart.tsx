import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "motion/react";

interface GlowingLineChartProps {
  data: Array<{
    time: string;
    value: number;
  }>;
  title?: string;
}

export function GlowingLineChart({ data, title = "Metric" }: GlowingLineChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.1 }}
      className="h-[200px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <filter id="glow" height="300%" width="300%" x="-75%" y="-75%">
              <feMorphology operator="dilate" radius="2"/>
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/> 
              </feMerge>
            </filter>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8} />
              <stop offset="50%" stopColor="hsl(var(--chart-3))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#6b7280' }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#6b7280' }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-background/90 backdrop-blur-sm border rounded-lg p-2 shadow-xl"
                  >
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-xs" style={{ color: 'hsl(var(--chart-3))' }}>
                      {title}: {payload[0].value}
                    </p>
                  </motion.div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="url(#lineGradient)"
            strokeWidth={3}
            dot={{ r: 4, fill: 'hsl(var(--chart-3))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
            activeDot={{ r: 6, fill: 'hsl(var(--chart-3))', stroke: 'hsl(var(--background))', strokeWidth: 2, filter: "url(#glow)" }}
            filter="url(#glow)"
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
