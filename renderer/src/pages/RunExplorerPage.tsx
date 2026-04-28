import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RunListItem } from "@shared/types/run";
import {
  getCharacterDisplayName,
  getCharacterIconUrl,
  getCharacterPortraitUrl
} from "../assets/characterIconMap";

type SortDirection = "asc" | "desc" | null;
type SortKey = "id" | "ascension" | "runTimestamp";

const formatRunPlayedAt = (runTimestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(runTimestamp * 1000));

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
    key: "runTimestamp",
    label: "Played",
    value: (run) => formatRunPlayedAt(run.runTimestamp),
    render: (run) => formatRunPlayedAt(run.runTimestamp),
    sortValue: (run) => run.runTimestamp
  },
  {
    key: "victory",
    label: "Victory",
    value: (run) => (run.victory ? "Yes" : "No"),
    render: (run) => (run.victory ? "Yes" : "No")
  },
  {
    key: "killedByEncounter",
    label: "Lost To",
    value: (run) => run.killedByEncounter ?? "(None)",
    render: (run) => run.killedByEncounter ?? ""
  }
];

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

const getColumnClassName = (key: string) => {
  if (key === "id") return "column-id";
  if (key === "character") return "column-character";
  if (key === "__spacer") return "column-spacer";
  return "column-metric";
};

const visibleColumns = [
  columns[0],
  columns[1],
  { key: "__spacer", label: "", render: () => null },
  ...columns.slice(2)
] as const;

const PAGE_SIZE = 50;

export const RunExplorerPage = () => {
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [isCharacterMenuOpen, setIsCharacterMenuOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [requestedAnalysisIds, setRequestedAnalysisIds] = useState<Record<string, boolean>>({});
  const characterMenuRef = useRef<HTMLDivElement | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["runs", selectedCharacter, currentPage],
    queryFn: () =>
      window.sts2Api.getRuns({
        character: selectedCharacter || undefined,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE
      }),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });
  const { data: appConfig } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => window.sts2Api.getConfig(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });
  const { data: filterOptionsData } = useQuery({
    queryKey: ["run-filter-options"],
    queryFn: () => window.sts2Api.getRunFilterOptions(),
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

  useEffect(() => {
    setCurrentPage(1);
    setExpandedRunId(null);
  }, [selectedCharacter]);

  useEffect(() => {
    if (!isCharacterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!characterMenuRef.current?.contains(event.target as Node)) {
        setIsCharacterMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isCharacterMenuOpen]);

  const runs = data?.runs ?? [];
  const totalRuns = data?.totalRuns ?? 0;
  const characterOptions = filterOptionsData?.characters ?? [];
  const selectedCharacterPortraitUrl = selectedCharacter
    ? getCharacterPortraitUrl(selectedCharacter)
    : undefined;
  const selectedCharacterLabel = selectedCharacter
    ? getCharacterDisplayName(selectedCharacter)
    : "All Characters";

  const filteredRuns = useMemo(() => {
    const nextRuns = runs;

    if (!sortKey || !sortDirection) return nextRuns;

    const sortedRuns = [...nextRuns];
    const sortColumn = columns.find((column) => column.key === sortKey);
    if (!sortColumn?.sortValue) return nextRuns;

    sortedRuns.sort((left, right) => {
      const leftValue = sortColumn.sortValue?.(left) ?? 0;
      const rightValue = sortColumn.sortValue?.(right) ?? 0;
      return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
    });

    return sortedRuns;
  }, [runs, selectedCharacter, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(totalRuns / PAGE_SIZE));
  const rangeStart = totalRuns === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalRuns === 0 ? 0 : rangeStart + filteredRuns.length - 1;
  const paginationPages = useMemo(() => {
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    const adjustedStart = Math.max(1, endPage - 4);
    return Array.from({ length: endPage - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }, [currentPage, totalPages]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("desc");
      return;
    }

    if (sortDirection === "desc") {
      setSortDirection("asc");
      return;
    }

    if (sortDirection === "asc") {
      setSortKey(null);
      setSortDirection(null);
      return;
    }

    setSortDirection("desc");
  };

  if (isLoading) return <section className="page">Loading runs...</section>;

  return (
    <section className="page">
      <div className="run-explorer-toolbar">
        <label className="toolbar-filter">
          <span>Character</span>
          <div className="character-filter-menu" ref={characterMenuRef}>
            <button
              type="button"
              className={`character-filter-trigger ${isCharacterMenuOpen ? "character-filter-trigger-open" : ""}`}
              onClick={() => setIsCharacterMenuOpen((current) => !current)}
            >
              {selectedCharacterPortraitUrl ? (
                <img
                  className="character-filter-portrait"
                  src={selectedCharacterPortraitUrl}
                  alt={selectedCharacterLabel}
                />
              ) : (
                <span className="character-filter-portrait character-filter-portrait-empty">All</span>
              )}
              <span className="character-filter-trigger-label">{selectedCharacterLabel}</span>
              <span className="character-filter-trigger-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {isCharacterMenuOpen ? (
              <div className="character-filter-dropdown">
                <button
                  type="button"
                  className={`character-filter-option ${selectedCharacter === "" ? "character-filter-option-active" : ""}`}
                  onClick={() => {
                    setSelectedCharacter("");
                    setIsCharacterMenuOpen(false);
                  }}
                >
                  <span className="character-filter-portrait character-filter-portrait-empty">All</span>
                  <span>All Characters</span>
                </button>
                {characterOptions.map((character) => (
                  <button
                    key={character}
                    type="button"
                    className={`character-filter-option ${
                      selectedCharacter === character ? "character-filter-option-active" : ""
                    }`}
                    onClick={() => {
                      setSelectedCharacter(character);
                      setIsCharacterMenuOpen(false);
                    }}
                  >
                    <img
                      className="character-filter-portrait"
                      src={getCharacterPortraitUrl(character)}
                      alt={getCharacterDisplayName(character)}
                    />
                    <span>{getCharacterDisplayName(character)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </label>
      </div>
      <div className="run-explorer-summary">
        #{rangeStart.toLocaleString()} ~ #{rangeEnd.toLocaleString()} / Total {totalRuns.toLocaleString()} Runs
      </div>
      <div className="run-explorer-table-wrap">
        <table className="run-explorer-table">
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.key} className={getColumnClassName(column.key)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column.key} className={getColumnClassName(column.key)}>
                  {"sortValue" in column && column.sortValue ? (
                    <button
                      type="button"
                      className={`column-header column-sort-trigger ${
                        sortKey === column.key ? "column-sort-trigger-active" : ""
                      }`}
                      onClick={() => toggleSort(column.key as SortKey)}
                      title={`Sort ${column.label}`}
                    >
                      <span>{column.label}</span>
                      <span className="column-sort-indicator" aria-hidden="true">
                        {sortKey === column.key
                          ? sortDirection === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </button>
                  ) : (
                    <div className="column-header">
                      <span>{column.label}</span>
                    </div>
                  )}
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
                  {visibleColumns.map((column) => (
                    <td key={column.key} className={getColumnClassName(column.key)}>
                      {"render" in column ? column.render(run) : null}
                    </td>
                  ))}
                </tr>
                {expandedRunId === run.id ? (
                  <tr className="run-detail-row" key={`${run.id}-detail`}>
                    <td colSpan={visibleColumns.length}>
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
      <div className="pagination-bar">
        <button
          className="pagination-button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
        >
          Prev
        </button>
        {paginationPages.map((page) => (
          <button
            key={page}
            className={`pagination-button ${page === currentPage ? "pagination-button-active" : ""}`}
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        ))}
        <button
          className="pagination-button"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
        >
          Next
        </button>
      </div>
    </section>
  );
};
