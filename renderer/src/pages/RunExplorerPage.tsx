import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RunListItem } from "@shared/types/run";

type FilterKey =
  | "character"
  | "ascension"
  | "victory"
  | "floorReached"
  | "deckSize"
  | "relicCount"
  | "enemyCount"
  | "killedByEncounter"
  | "durationMinutes";

type FilterState = Partial<Record<FilterKey, string>>;

const columns: Array<{
  key: FilterKey;
  label: string;
  value: (run: RunListItem) => string;
  render: (run: RunListItem) => string | number;
}> = [
  {
    key: "character",
    label: "Character",
    value: (run) => run.character,
    render: (run) => run.character
  },
  {
    key: "ascension",
    label: "A",
    value: (run) => String(run.ascension),
    render: (run) => run.ascension
  },
  {
    key: "victory",
    label: "Victory",
    value: (run) => (run.victory ? "Yes" : "No"),
    render: (run) => (run.victory ? "Yes" : "No")
  },
  {
    key: "floorReached",
    label: "Floor",
    value: (run) => String(run.floorReached),
    render: (run) => run.floorReached
  },
  {
    key: "deckSize",
    label: "Deck",
    value: (run) => String(run.deckSize),
    render: (run) => run.deckSize
  },
  {
    key: "relicCount",
    label: "Relics",
    value: (run) => String(run.relicCount),
    render: (run) => run.relicCount
  },
  {
    key: "enemyCount",
    label: "Enemies",
    value: (run) => String(run.enemyCount),
    render: (run) => run.enemyCount
  },
  {
    key: "killedByEncounter",
    label: "Lost To",
    value: (run) => run.killedByEncounter ?? "(None)",
    render: (run) => run.killedByEncounter ?? ""
  },
  {
    key: "durationMinutes",
    label: "Duration (m)",
    value: (run) => String(Math.round(run.durationSeconds / 60)),
    render: (run) => Math.round(run.durationSeconds / 60)
  }
];

const sortOptions = (values: string[]) =>
  [...values].sort((a, b) => {
    const aNumber = Number(a);
    const bNumber = Number(b);
    if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) return aNumber - bNumber;
    return a.localeCompare(b);
  });

export const RunExplorerPage = () => {
  const [filters, setFilters] = useState<FilterState>({});
  const { data, isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => window.sts2Api.getRuns()
  });

  const runs = data ?? [];
  const filterOptions = useMemo(() => {
    const options = new Map<FilterKey, string[]>();
    for (const column of columns) {
      options.set(column.key, sortOptions([...new Set(runs.map(column.value))]));
    }
    return options;
  }, [runs]);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) =>
      columns.every((column) => {
        const filterValue = filters[column.key];
        return !filterValue || column.value(run) === filterValue;
      })
    );
  }, [filters, runs]);

  if (isLoading) return <section className="page">Loading runs...</section>;

  return (
    <section className="page">
      <h2>Run Explorer</h2>
      <div className="run-count">
        Showing {filteredRuns.length} of {runs.length} runs
      </div>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>
                <div className="column-filter">
                  <span>{column.label}</span>
                  <select
                    aria-label={`Filter ${column.label}`}
                    value={filters[column.key] ?? ""}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        [column.key]: event.target.value || undefined
                      }))
                    }
                  >
                    <option value="">All</option>
                    {(filterOptions.get(column.key) ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRuns.map((run) => (
            <tr key={run.id}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(run)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
