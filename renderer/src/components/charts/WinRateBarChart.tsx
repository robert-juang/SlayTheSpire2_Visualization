import ReactECharts from "echarts-for-react";
import type { PlayerComparisonRow } from "@shared/types/run";

type WinRateBarChartProps = {
  rows: PlayerComparisonRow[];
};

export const WinRateBarChart = ({ rows }: WinRateBarChartProps) => {
  const option = {
    tooltip: {},
    xAxis: {
      type: "category",
      data: rows.map((row) => row.playerName)
    },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (value: number) => `${Math.round(value * 100)}%`
      }
    },
    series: [
      {
        type: "bar",
        data: rows.map((row) => Number(row.winRate ?? 0)),
        itemStyle: { borderRadius: [6, 6, 0, 0] }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
};
