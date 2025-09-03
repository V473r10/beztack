"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface PingingDotChartProps {
  data: any[];
  config: ChartConfig;
  xAxisKey: string;
  yAxisKey: string;
  className?: string;
}

export function PingingDotChart({ 
  data, 
  config, 
  xAxisKey, 
  yAxisKey, 
  className 
}: PingingDotChartProps) {
  return (
    <ChartContainer config={config} className={className}>
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 12,
          right: 12,
          top: 12,
          bottom: 12,
        }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid 
          vertical={false}
          stroke="hsl(var(--border))"
          strokeDasharray="3 3"
          opacity={0.4}
        />
        <XAxis
          dataKey={xAxisKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ 
            fontSize: 12, 
            fill: 'hsl(var(--muted-foreground))',
            fontWeight: 500
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ 
            fontSize: 12, 
            fill: 'hsl(var(--muted-foreground))',
            fontWeight: 500
          }}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent />}
        />
        <Line
          dataKey={yAxisKey}
          type="monotone"
          stroke={`var(--color-${yAxisKey})`}
          strokeWidth={3}
          dot={<CustomizedDot />}
          activeDot={<ActiveDot />}
          filter="url(#glow)"
        />
      </LineChart>
    </ChartContainer>
  );
}

const CustomizedDot = (props: any) => {
  const { cx, cy, stroke, index } = props;

  return (
    <g>
      {/* Pulsing background circle */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={8} 
        fill={stroke} 
        opacity={0.2}
      >
        <animate
          attributeName="r"
          values="8;16;8"
          dur="2s"
          repeatCount="indefinite"
          begin={`${index * 0.2}s`}
        />
        <animate
          attributeName="opacity"
          values="0.2;0.05;0.2"
          dur="2s"
          repeatCount="indefinite"
          begin={`${index * 0.2}s`}
        />
      </circle>
      
      {/* Main dot */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={4} 
        fill={stroke}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
      
      {/* Ping ring */}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        stroke={stroke}
        fill="none"
        strokeWidth={2}
        opacity={0.6}
      >
        <animate
          attributeName="r"
          values="4;12;4"
          dur="1.5s"
          repeatCount="indefinite"
          begin={`${index * 0.3}s`}
        />
        <animate
          attributeName="opacity"
          values="0.6;0;0.6"
          dur="1.5s"
          repeatCount="indefinite"
          begin={`${index * 0.3}s`}
        />
      </circle>
    </g>
  );
};

const ActiveDot = (props: any) => {
  const { cx, cy, stroke } = props;

  return (
    <g>
      {/* Glowing effect */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={8} 
        fill={stroke} 
        opacity={0.3}
        filter="url(#glow)"
      />
      {/* Main active dot */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={6} 
        fill={stroke}
        stroke="hsl(var(--background))"
        strokeWidth={3}
      />
    </g>
  );
};
