import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RunListItem } from "@shared/types/run";
import { getCharacterIconUrl } from "../assets/characterIconMap";

type SortDirection = "asc" | "desc";
type SortKey = "id" | "ascension" | "floorReached" | "durationMinutes";

const columns: Array<{
  key: string;
  label: string;
  value: (run: RunListItem) => string;
  render: (run: RunListItem) => React.ReactNode;
  sortValue?: (run: RunListItem) => number;
}> = [
  {
    key: "id",
    label: "#",
    value: (run) => run.id,
    render: (run) => run.id,
    sortValue: (run) => Number(run.id)
  },
  {
    key: "character",
    label: "Character",
    value: (run) => run.character,
    render: (run) => {
      const iconUrl = getCharacterIconUrl(run.character);
      return iconUrl ? (
        <img
          className="character-icon"
          src={iconUrl}
          alt={run.character}
          title={run.character}
        />
      ) : (
        run.character
      );
    }
  },
  {
    key: "ascension",
    label: "Asc",
    value: (run) => String(run.ascension),
    render: (run) => run.ascension,
    sortValue: (run) => run.ascension
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
    render: (run) => run.floorReached,
    sortValue: (run) => run.floorReached
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
    render: (run) => Math.round(run.durationSeconds / 60),
    sortValue: (run) => Math.round(run.durationSeconds / 60)
  }
];

const sortOptions = (values: string[]) =>
  [...values].sort((a, b) => {
    const aNumber = Number(a);
    const bNumber = Number(b);
    if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) return aNumber - bNumber;
    return a.localeCompare(b);
  });

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Unknown detail loading error";
};

const TypingText = ({ text }: { text: string }) => {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    setVisibleLength(0);
    if (!text) return;

    const step = Math.max(1, Math.ceil(text.length / 220));
    let nextLength = 0;
    let timeoutId: number | undefined;

    const tick = () => {
      nextLength = Math.min(text.length, nextLength + step);
      setVisibleLength(nextLength);
      if (nextLength < text.length) {
        timeoutId = window.setTimeout(tick, 16);
      }
    };

    timeoutId = window.setTimeout(tick, 16);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [text]);

  return <div className="ai-analysis-text">{text.slice(0, visibleLength)}</div>;
};

export const RunExplorerPage = () => {
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [selectedAscension, setSelectedAscension] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [requestedAnalysisIds, setRequestedAnalysisIds] = useState<Record<string, boolean>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => window.sts2Api.getRuns(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });
  const { data: appConfig } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => window.sts2Api.getConfig(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });
  const {
    data: expandedRunDetail,
    error: detailError,
    isError: isDetailError,
    isLoading: isDetailLoading
  } = useQuery({
    queryKey: ["run-detail", expandedRunId],
    queryFn: () => {
      if (!window.sts2Api.getRunDetail) {
        throw new Error("Run detail API is not loaded. Restart the Electron app.");
      }
      return window.sts2Api.getRunDetail(expandedRunId ?? "");
    },
    enabled: Boolean(expandedRunId),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });
  const {
    data: expandedRunAnalysis,
    error: analysisError,
    isError: isAnalysisError,
    isLoading: isAnalysisLoading,
    refetch: refetchRunAnalysis
  } = useQuery({
    queryKey: ["run-ai-analysis", expandedRunId],
    queryFn: () => {
      if (!window.sts2Api.getRunAiAnalysis) {
        throw new Error("Run AI analysis API is not loaded. Restart the Electron app.");
      }
      return window.sts2Api.getRunAiAnalysis(expandedRunId ?? "");
    },
    enabled: Boolean(
      expandedRunId && requestedAnalysisIds[expandedRunId] && !isDetailError && !isDetailLoading
    ),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!expandedRunId || appConfig?.allowExternalAiCalls === false) return;
    setRequestedAnalysisIds((current) => {
      if (current[expandedRunId]) return current;
      return {
        ...current,
        [expandedRunId]: true
      };
    });
  }, [appConfig?.allowExternalAiCalls, expandedRunId]);

  const runs = data ?? [];
  const characterOptions = useMemo(
    () => sortOptions([...new Set(runs.map((run) => run.character))]),
    [runs]
  );
  const ascensionOptions = useMemo(
    () => sortOptions([...new Set(runs.map((run) => String(run.ascension)))]),
    [runs]
  );

  const filteredRuns = useMemo(() => {
    const nextRuns = runs.filter((run) => {
      if (selectedCharacter && run.character !== selectedCharacter) return false;
      if (selectedAscension && String(run.ascension) !== selectedAscension) return false;
      return true;
    });

    if (!sortKey) return nextRuns;

    const sortedRuns = [...nextRuns];
    const sortColumn = columns.find((column) => column.key === sortKey);
    if (!sortColumn?.sortValue) return nextRuns;

    sortedRuns.sort((left, right) => {
      const leftValue = sortColumn.sortValue?.(left) ?? 0;
      const rightValue = sortColumn.sortValue?.(right) ?? 0;
      return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
    });

    return sortedRuns;
  }, [runs, selectedAscension, selectedCharacter, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  if (isLoading) return <section className="page">Loading runs...</section>;

  return (
    <section className="page">
      <div className="run-explorer-toolbar">
        <label className="toolbar-filter">
          <span>Character</span>
          <select value={selectedCharacter} onChange={(event) => setSelectedCharacter(event.target.value)}>
            <option value="">All Characters</option>
            {characterOptions.map((character) => (
              <option key={character} value={character}>
                {character}
              </option>
            ))}
          </select>
        </label>
        <label className="toolbar-filter">
          <span>Ascension</span>
          <select value={selectedAscension} onChange={(event) => setSelectedAscension(event.target.value)}>
            <option value="">All Ascensions</option>
            {ascensionOptions.map((ascension) => (
              <option key={ascension} value={ascension}>
                {ascension}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="run-explorer-table-wrap">
        <table className="run-explorer-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>
                  <div className="column-header">
                    <span>{column.label}</span>
                    {column.sortValue ? (
                      <button
                        className={`sort-button ${sortKey === column.key ? "sort-button-active" : ""}`}
                        onClick={() => toggleSort(column.key as SortKey)}
                        title={`Sort ${column.label} ${sortKey === column.key && sortDirection === "asc" ? "descending" : "ascending"}`}
                      >
                        {sortKey === column.key ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run) => (
              <Fragment key={run.id}>
                <tr
                  className="run-row"
                  onClick={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}
                >
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(run)}</td>
                  ))}
                </tr>
                {expandedRunId === run.id ? (
                  <tr className="run-detail-row" key={`${run.id}-detail`}>
                    <td colSpan={columns.length}>
                      {isDetailLoading ? (
                        <div className="run-detail-panel">Loading run details...</div>
                      ) : isDetailError ? (
                        <div className="run-detail-panel detail-error">
                          Could not load run details: {getErrorMessage(detailError)}
                        </div>
                      ) : expandedRunDetail ? (
                        <div className="run-detail-panel">
                          <div className="detail-group detail-group-wide">
                            <div className="detail-header-row">
                              <h3>AI Analysis</h3>
                              <button
                                className="detail-action-button"
                                disabled={isAnalysisLoading || appConfig?.allowExternalAiCalls === false}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (appConfig?.allowExternalAiCalls === false) {
                                    return;
                                  }
                                  if (requestedAnalysisIds[run.id]) {
                                    void refetchRunAnalysis();
                                    return;
                                  }
                                  setRequestedAnalysisIds((current) => ({
                                    ...current,
                                    [run.id]: true
                                  }));
                                }}
                              >
                                {appConfig?.allowExternalAiCalls === false
                                  ? "AI Disabled"
                                  : isAnalysisLoading
                                    ? "loading..."
                                    : requestedAnalysisIds[run.id]
                                      ? "Regenerate Analysis"
                                      : "Generate AI Analysis"}
                              </button>
                            </div>
                            {appConfig?.allowExternalAiCalls === false ? (
                              <div className="detail-list">
                                External AI API calls are disabled in Config.
                              </div>
                            ) : !requestedAnalysisIds[run.id] ? (
                              <div className="detail-list">
                                Generate an OpenAI summary for this run from the structured run JSON.
                              </div>
                            ) : isAnalysisLoading ? (
                              <div className="ai-analysis-loading">
                                <span className="loading-spinner" aria-hidden="true" />
                                <span>loading...</span>
                              </div>
                            ) : isAnalysisError ? (
                              <div className="detail-error">
                                Could not generate AI analysis: {getErrorMessage(analysisError)}
                              </div>
                            ) : expandedRunAnalysis ? (
                              <div className="ai-analysis-panel">
                                <TypingText text={expandedRunAnalysis.analysis} />
                              </div>
                            ) : (
                              <div className="detail-list">Analysis unavailable.</div>
                            )}
                          </div>
                          <div className="detail-group">
                            <h3>Cards Used</h3>
                            <div className="detail-list">{expandedRunDetail.cardsUsed.join(", ") || "None recorded"}</div>
                          </div>
                          <div className="detail-group">
                            <h3>Relics Obtained</h3>
                            <div className="detail-list">
                              {expandedRunDetail.relicsObtained.join(", ") || "None recorded"}
                            </div>
                          </div>
                          <div className="detail-group">
                            <h3>Gold</h3>
                            <div className="detail-list">
                              Gained {expandedRunDetail.goldGained} | Spent {expandedRunDetail.goldSpent} | Lost{" "}
                              {expandedRunDetail.goldLost} | Stolen {expandedRunDetail.goldStolen} | Final{" "}
                              {expandedRunDetail.finalGold ?? "Unknown"}
                            </div>
                          </div>
                          <div className="detail-group">
                            <h3>Normal Enemies</h3>
                            <div className="detail-list">
                              {expandedRunDetail.normalEnemies.join(", ") || "None recorded"}
                            </div>
                          </div>
                          <div className="detail-group">
                            <h3>Elites</h3>
                            <div className="detail-list">{expandedRunDetail.elites.join(", ") || "None recorded"}</div>
                          </div>
                          <div className="detail-group detail-group-wide">
                            <h3>Events</h3>
                            {expandedRunDetail.events.length > 0 ? (
                              <div className="event-list">
                                {expandedRunDetail.events.map((event) => (
                                  <div className="event-item" key={`${event.act}-${event.floor}-${event.eventId}`}>
                                    <strong>
                                      Act {event.act}, Floor {event.floor}: {event.eventId}
                                    </strong>
                                    <span>{event.results.join(" | ")}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="detail-list">None recorded</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="run-detail-panel">Run details unavailable.</div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
