import ReactECharts from "echarts-for-react";
import type { CharacterAscensionWinRateRow } from "@shared/types/run";

type WinRateByAscensionChartProps = {
  rows: CharacterAscensionWinRateRow[];
};

type TooltipParam = {
  axisValueLabel?: string;
  marker?: string;
  seriesName?: string;
  data?: {
    value?: number;
    runCount?: number;
  } | null;
};

const characterColors = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7"
];

const cleanCharacterName = (character: string) => character.replace("CHARACTER.", "");

export const WinRateByAscensionChart = ({ rows }: WinRateByAscensionChartProps) => {
  if (rows.length === 0) {
    return <div className="chart-empty">No winrate data available.</div>;
  }

  const maxAscension = Math.max(...rows.map((row) => row.ascension));
  const ascensions = Array.from({ length: maxAscension + 1 }, (_, index) => index);
  const characters = [...new Set(rows.map((row) => row.character))].sort();
  const rowByCharacterAscension = new Map(
    rows.map((row) => [`${row.character}:${row.ascension}`, row])
  );

  const option = {
    color: characterColors,
    title: {
      text: "Winrate by Ascension",
      textStyle: {
        color: "#f3f4f6",
        fontSize: 18,
        fontWeight: 600
      }
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: TooltipParam | TooltipParam[]) => {
        const items = Array.isArray(params) ? params : [params];
        const ascensionLabel = items[0]?.axisValueLabel ?? "";
        const playedItems = items.filter(
          (item) => item.data && typeof item.data.value === "number"
        );

        if (playedItems.length === 0) {
          return `Ascension ${ascensionLabel}<br/>No runs`;
        }

        return [
          `Ascension ${ascensionLabel}`,
          ...playedItems.map((item) => {
            const value = item.data?.value ?? 0;
            const runCount = item.data?.runCount ?? 0;
            return `${item.marker ?? ""}${item.seriesName}: ${value.toFixed(1)}% (${runCount} runs)`;
          })
        ].join("<br/>");
      }
    },
    legend: {
      bottom: 0,
      textStyle: {
        color: "#d1d5db"
      },
      data: characters.map(cleanCharacterName)
    },
    grid: {
      top: 54,
      right: 24,
      bottom: 76,
      left: 56
    },
    xAxis: {
      type: "category",
      name: "Ascension",
      nameLocation: "middle",
      nameGap: 28,
      data: ascensions,
      axisLabel: {
        color: "#d1d5db"
      },
      nameTextStyle: {
        color: "#d1d5db"
      }
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: {
        color: "#d1d5db",
        formatter: (value: number) => `${Math.round(value)}%`
      },
      splitLine: {
        lineStyle: {
          color: "#1f2937"
        }
      }
    },
    series: characters.map((character) => ({
      name: cleanCharacterName(character),
      type: "line",
      smooth: false,
      connectNulls: true,
      showSymbol: true,
      symbolSize: 8,
      lineStyle: {
        width: 3
      },
      data: ascensions.map((ascension) => {
        const row = rowByCharacterAscension.get(`${character}:${ascension}`);
        return row
          ? {
              value: Number(row.winRate ?? 0) * 100,
              runCount: row.runCount
            }
          : null;
      })
    }))
  };

  return <ReactECharts option={option} notMerge={true} style={{ height: 380 }} />;
};
