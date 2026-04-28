import { useQuery } from "@tanstack/react-query";
import { WinRateByAscensionChart } from "../components/charts/WinRateByAscensionChart";

export const OverviewPage = () => {
  const { data: winRateByAscension, isLoading: isChartLoading } = useQuery({
    queryKey: ["winrate-by-ascension"],
    queryFn: () => window.sts2Api.getWinRateByAscension()
  });

  if (isChartLoading) return <section className="page">Loading overview...</section>;

  return (
    <section className="page">
      <div className="chart-panel chart-panel-overview">
        <WinRateByAscensionChart rows={winRateByAscension ?? []} />
      </div>
    </section>
  );
};
