import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OverviewPage } from "./pages/OverviewPage";
import { RunExplorerPage } from "./pages/RunExplorerPage";
import { ProfileSelectPage } from "./pages/ProfileSelectPage";
import { LoadingPage } from "./pages/LoadingPage";
import type { ProfileCandidate } from "@shared/types/run";

const tabs = ["Overview", "Run Explorer"] as const;
type Tab = (typeof tabs)[number];
type AppStage = "selectProfile" | "loadingProfile" | "ready";

export const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [stage, setStage] = useState<AppStage>("selectProfile");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadDetail, setLoadDetail] = useState("Waiting for selection...");

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => window.sts2Api.listProfiles()
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
    return "Slay the Spire 2 Data Loader";
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
          onSelect={(profile) => bootstrapMutation.mutate(profile)}
          loading={bootstrapMutation.isPending}
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
      <nav className="tabs">
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
    </main>
  );
};
