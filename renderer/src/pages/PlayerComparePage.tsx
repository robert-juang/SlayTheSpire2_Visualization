import { useQuery } from "@tanstack/react-query";
import { WinRateBarChart } from "../components/charts/WinRateBarChart";

export const PlayerComparePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => window.sts2Api.getPlayerComparison()
  });

  if (isLoading) return <section className="page">Loading player comparison...</section>;

  return (
    <section className="page">
      <h2>Player Compare</h2>
      <WinRateBarChart rows={data ?? []} />
    </section>
  );
};
