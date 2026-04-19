import { useQuery } from "@tanstack/react-query";

export const RunExplorerPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => window.sts2Api.getRuns()
  });

  if (isLoading) return <section className="page">Loading runs...</section>;

  return (
    <section className="page">
      <h2>Run Explorer</h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Character</th>
            <th>A</th>
            <th>Victory</th>
            <th>Floor</th>
            <th>Duration (m)</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((run) => (
            <tr key={run.id}>
              <td>{run.playerName}</td>
              <td>{run.character}</td>
              <td>{run.ascension}</td>
              <td>{run.victory ? "Yes" : "No"}</td>
              <td>{run.floorReached}</td>
              <td>{Math.round(run.durationSeconds / 60)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
