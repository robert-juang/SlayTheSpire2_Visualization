import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const ConfigPage = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => window.sts2Api.getConfig(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  const updateConfigMutation = useMutation({
    mutationFn: (allowExternalAiCalls: boolean) =>
      window.sts2Api.updateConfig({ allowExternalAiCalls }),
    onSuccess: (nextConfig) => {
      queryClient.setQueryData(["app-config"], nextConfig);
    }
  });

  if (isLoading || !data) {
    return <section className="page">Loading config...</section>;
  }

  return (
    <section className="page">
      <div className="config-panel">
        <div className="config-row">
          <div className="config-copy">
            <h2>External AI API Calls</h2>
            <p>Allow the app to send run data to an external AI endpoint for analysis.</p>
          </div>
          <label className="config-toggle">
            <input
              type="checkbox"
              checked={data.allowExternalAiCalls}
              disabled={updateConfigMutation.isPending}
              onChange={(event) => updateConfigMutation.mutate(event.target.checked)}
            />
            <span className="config-toggle-track">
              <span className="config-toggle-thumb" />
            </span>
          </label>
        </div>
      </div>
    </section>
  );
};
