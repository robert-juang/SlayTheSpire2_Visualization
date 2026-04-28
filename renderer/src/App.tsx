import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OverviewPage } from "./pages/OverviewPage";
import { RunExplorerPage } from "./pages/RunExplorerPage";
import { ProfileSelectPage } from "./pages/ProfileSelectPage";
import { LoadingPage } from "./pages/LoadingPage";
import { ConfigPage } from "./pages/ConfigPage";
import { MetricCard } from "./components/charts/MetricCard";
import type { ProfileCandidate } from "@shared/types/run";

const tabs = ["Overview", "Run Explorer", "Config"] as const;
type Tab = (typeof tabs)[number];
type AppStage = "selectProfile" | "loadingProfile" | "ready";

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [stage, setStage] = useState<AppStage>("selectProfile");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadDetail, setLoadDetail] = useState("Waiting for selection...");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => window.sts2Api.listProfiles()
  });
  const overviewQuery = useQuery({
    queryKey: ["overview-shell-v2"],
    queryFn: () => window.sts2Api.getOverview(),
    enabled: stage === "ready"
  });

  const bootstrapMutation = useMutation({
    mutationFn: async (profile: ProfileCandidate) => {
      setLoadProgress(45);
      setLoadDetail("Importing and normalizing run data...");
      const result = await window.sts2Api.bootstrapProfile({
        displayName: profile.displayName,
        steamPath: profile.steamPath
      });
      setLoadProgress(85);
      setLoadDetail("Finalizing analytics indexes...");
      return result;
    },
    onMutate: () => {
      setStage("loadingProfile");
      setLoadProgress(15);
      setLoadDetail("Scanning profile and parsing runs...");
    },
    onSuccess: (result) => {
      setLoadProgress(100);
      setLoadDetail(
        `Loaded ${result.filesImported} runs from ${result.filesSeen} files (${result.filesFailed} failed).`
      );
      setTimeout(() => setStage("ready"), 300);
    }
  });

  const headerText = useMemo(() => {
    if (stage === "ready") return "Slay the Spire 2 Visualizer";
    return "Slay the Spire 2 Visualizer";
  }, [stage]);

  if (profilesQuery.isLoading) {
    return (
      <main className="container">
        <LoadingPage title="Loading Profiles" progress={20} detail="Detecting local Steam profiles..." />
      </main>
    );
  }

  if (stage === "selectProfile") {
    return (
      <main className="container">
        <h1>{headerText}</h1>
        <ProfileSelectPage
          profiles={profilesQuery.data ?? []}
          onSelect={(profile) => {
            setSelectedProfileId(profile.id);
            bootstrapMutation.mutate(profile);
          }}
          loading={bootstrapMutation.isPending}
          selectedProfileId={selectedProfileId}
        />
      </main>
    );
  }

  if (stage === "loadingProfile") {
    return (
      <main className="container">
        <LoadingPage title="Importing Run Data" progress={loadProgress} detail={loadDetail} />
      </main>
    );
  }

  return (
    <main className="container">
      <h1>{headerText}</h1>
      <section className="app-summary-strip">
        <div className="metric-grid">
          <MetricCard label="Runs" value={String(overviewQuery.data?.totalRuns ?? 0)} />
          <MetricCard label="Win Rate" value={formatPercent(overviewQuery.data?.winRate ?? 0)} />
          <MetricCard label="Avg Floor" value={(overviewQuery.data?.averageFloor ?? 0).toFixed(1)} />
          <MetricCard label="Avg Deck Size" value={(overviewQuery.data?.averageDeckSize ?? 0).toFixed(1)} />
          <MetricCard
            label="Avg Duration"
            value={`${Math.round((overviewQuery.data?.averageDurationSeconds ?? 0) / 60)} min`}
          />
        </div>
      </section>
      <nav className="tabs tabs-menu">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      {activeTab === "Overview" && <OverviewPage />}
      {activeTab === "Run Explorer" && <RunExplorerPage />}
      {activeTab === "Config" && <ConfigPage />}
    </main>
  );
};
