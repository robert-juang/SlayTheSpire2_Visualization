import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "../components/charts/MetricCard";
import { WinRateByAscensionChart } from "../components/charts/WinRateByAscensionChart";

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const OverviewPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: () => window.sts2Api.getOverview()
  });
  const { data: winRateByAscension, isLoading: isChartLoading } = useQuery({
    queryKey: ["winrate-by-ascension"],
    queryFn: () => window.sts2Api.getWinRateByAscension()
  });

  if (isLoading || isChartLoading) return <section className="page">Loading overview...</section>;

  return (
    <section className="page">
      <div className="metric-grid">
        <MetricCard label="Runs" value={String(data?.totalRuns ?? 0)} />
        <MetricCard label="Win Rate" value={formatPercent(data?.winRate ?? 0)} />
        <MetricCard label="Avg Floor" value={(data?.averageFloor ?? 0).toFixed(1)} />
        <MetricCard
          label="Avg Duration"
          value={`${Math.round((data?.averageDurationSeconds ?? 0) / 60)} min`}
        />
      </div>
      <div className="chart-panel">
        <WinRateByAscensionChart rows={winRateByAscension ?? []} />
      </div>
    </section>
  );
};
