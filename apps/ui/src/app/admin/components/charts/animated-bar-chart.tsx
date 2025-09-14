import { motion } from "motion/react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AnimatedBarChartProps {
  data: Array<{
    label: string;
    value: number;
    unit?: string;
    status?: "good" | "warning" | "critical";
    color?: string;
  }>;
}

export function AnimatedBarChart({ data }: AnimatedBarChartProps) {
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="h-[250px] w-full"
      initial={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="barGradientGood" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="5%"
                stopColor="hsl(142 76% 36%)"
                stopOpacity={0.9}
              />
              <stop
                offset="95%"
                stopColor="hsl(142 76% 36%)"
                stopOpacity={0.4}
              />
            </linearGradient>
            <linearGradient id="barGradientWarning" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.9} />
              <stop
                offset="95%"
                stopColor="hsl(38 92% 50%)"
                stopOpacity={0.4}
              />
            </linearGradient>
            <linearGradient
              id="barGradientCritical"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.9} />
              <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="barGradientDefault" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="5%"
                stopColor="hsl(var(--chart-2))"
                stopOpacity={0.9}
              />
              <stop
                offset="95%"
                stopColor="hsl(var(--chart-2))"
                stopOpacity={0.4}
              />
            </linearGradient>
          </defs>
          <XAxis
            axisLine={false}
            dataKey="label"
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
                const data = payload[0].payload;
                const statusColors = {
                  good: "hsl(142 76% 36%)",
                  warning: "hsl(38 92% 50%)",
                  critical: "hsl(0 72% 51%)",
                };

                return (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border bg-background p-3 shadow-lg"
                    initial={{ opacity: 0, y: 10 }}
                  >
                    <p className="font-medium text-sm">{label}</p>
                    <p
                      className="font-mono text-sm"
                      style={{
                        color:
                          statusColors[
                            data.status as keyof typeof statusColors
                          ] || "hsl(var(--chart-2))",
                      }}
                    >
                      {payload[0].value}
                      {data.unit || "%"}
                    </p>
                    {data.status && (
                      <p className="text-muted-foreground text-xs capitalize">
                        {data.status}
                      </p>
                    )}
                  </motion.div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => {
              let fillColor = "url(#barGradientDefault)";
              switch (entry.status) {
                case "good":
                  fillColor = "url(#barGradientGood)";
                  break;
                case "warning":
                  fillColor = "url(#barGradientWarning)";
                  break;
                case "critical":
                  fillColor = "url(#barGradientCritical)";
                  break;
              }
              return <Cell fill={fillColor} key={`cell-${index}`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
