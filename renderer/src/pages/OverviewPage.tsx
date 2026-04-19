import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "../components/charts/MetricCard";

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const OverviewPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: () => window.sts2Api.getOverview()
  });

  if (isLoading) return <section className="page">Loading overview...</section>;

  return (
    <section className="page">
      <h2>Overview</h2>
      <div className="metric-grid">
        <MetricCard label="Runs" value={String(data?.totalRuns ?? 0)} />
        <MetricCard label="Win Rate" value={formatPercent(data?.winRate ?? 0)} />
        <MetricCard label="Avg Floor" value={(data?.averageFloor ?? 0).toFixed(1)} />
        <MetricCard
          label="Avg Duration"
          value={`${Math.round((data?.averageDurationSeconds ?? 0) / 60)} min`}
        />
      </div>
    </section>
  );
};
