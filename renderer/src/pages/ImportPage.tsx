import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { TeamSource } from "@shared/types/run";

const defaultPathPlaceholder =
  "/Users/<name>/Library/Application Support/Steam/steamapps/common/SlayTheSpire2/runs";

export const ImportPage = () => {
  const [sources, setSources] = useState<TeamSource[]>([{ playerName: "", steamPath: "" }]);
  const [previewOutput, setPreviewOutput] = useState<string>("");
  const [importOutput, setImportOutput] = useState<string>("");

  const previewMutation = useMutation({
    mutationFn: () => window.sts2Api.previewImport({ sources }),
    onSuccess: (result) => {
      setPreviewOutput(
        `Seen: ${result.filesSeen} | Importable: ${result.importable} | Already imported: ${result.alreadyImported} | Invalid: ${result.invalidFiles.length}`
      );
    }
  });

  const importMutation = useMutation({
    mutationFn: () => window.sts2Api.importRuns({ sources }),
    onSuccess: (result) => {
      setImportOutput(
        `Imported: ${result.filesImported} / Seen: ${result.filesSeen} | Failed: ${result.filesFailed}`
      );
    }
  });

  return (
    <section className="page">
      <h2>Import & Sources</h2>
      {sources.map((source, index) => (
        <div className="source-row" key={`${index}-${source.playerName}`}>
          <input
            placeholder="Player name"
            value={source.playerName}
            onChange={(event) => {
              const next = [...sources];
              next[index] = { ...next[index], playerName: event.target.value };
              setSources(next);
            }}
          />
          <input
            placeholder={defaultPathPlaceholder}
            value={source.steamPath}
            onChange={(event) => {
              const next = [...sources];
              next[index] = { ...next[index], steamPath: event.target.value };
              setSources(next);
            }}
          />
        </div>
      ))}

      <div className="actions">
        <button onClick={() => setSources([...sources, { playerName: "", steamPath: "" }])}>
          Add Source
        </button>
        <button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
          Preview Import
        </button>
        <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
          Import Runs
        </button>
      </div>

      <p>{previewOutput}</p>
      <p>{importOutput}</p>
    </section>
  );
};
