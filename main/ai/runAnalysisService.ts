import type { AnalyticsRepository } from "../analytics/analyticsRepository.js";
import type { RunAiAnalysis } from "../../shared/types/run.js";

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.5";

const getOpenAiResponsesUrl = () => {
  const configuredEndpoint = process.env.OPENAI_ENDPOINT?.trim();
  if (!configuredEndpoint) {
    return "https://api.openai.com/v1/responses";
  }

  if (configuredEndpoint.endsWith("/responses")) {
    return configuredEndpoint;
  }

  return `${configuredEndpoint.replace(/\/+$/, "")}/v1/responses`;
};

type OpenAIResponsesRequest = {
  model: string;
  reasoning?: {
    effort: "minimal" | "low" | "medium" | "high" | "xhigh";
  };
  text?: {
    format: { type: "text" };
    verbosity?: "low" | "medium" | "high";
  };
  input: Array<{
    role: "system" | "user";
    content: Array<{
      type: "input_text";
      text: string;
    }>;
  }>;
};

type OpenAIResponseContent = {
  type?: string;
  text?: string;
};

type OpenAIResponseOutput = {
  type?: string;
  content?: OpenAIResponseContent[];
};

type OpenAIResponsesResult = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
  error?: {
    message?: string;
  };
};

const buildSystemPrompt = (payloadJson: string) =>
  [
    "You are an expert Slay the Spire 2 run analyst.",
    "Use only the run JSON below.",
    "Do not invent cards, encounters, relics, upgrades, or outcomes that are not present in the JSON.",
    "When data is sparse or missing, say that clearly.",
    "Run JSON:",
    payloadJson
  ].join("\n\n");

const buildUserPrompt = () =>
  [
    "You are an expert Slay the Spire coach analyzing a player's run.",
    "Your goal is to provide a clear, data-driven review of the run and actionable advice.",
    "Base all analysis strictly on the provided run data in the system prompt",
    "Output a Run Summary with 2-3 lines MAX. Focus on where the player did well or did badly."
  ].join(" ");

const extractOutputText = (response: OpenAIResponsesResult) => {
  if (response.output_text?.trim()) return response.output_text.trim();
  const fallback = (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text?.trim())
    .filter(Boolean)
    .join("\n\n");
  return fallback || "";
};

export class RunAnalysisService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async analyzeRun(runId: string): Promise<RunAiAnalysis> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set. Restart the Electron app after updating .env.");
    }

    const payload = this.analyticsRepository.getRunAnalysisPayload(runId);
    if (!payload) {
      throw new Error("Run analysis payload is unavailable for this run.");
    }

    const payloadJson = JSON.stringify(payload, null, 2);
    const userPrompt = buildUserPrompt();
    const requestBody: OpenAIResponsesRequest = {
      model: DEFAULT_OPENAI_MODEL,
      reasoning: { effort: "medium" },
      text: {
        format: { type: "text" },
        verbosity: "medium"
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt(payloadJson) }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }]
        }
      ]
    };

    const response = await fetch(getOpenAiResponsesUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = (await response.json()) as OpenAIResponsesResult;
    if (!response.ok) {
      throw new Error(data.error?.message ?? `OpenAI request failed with status ${response.status}.`);
    }

    const analysis = extractOutputText(data);
    if (!analysis) {
      throw new Error("OpenAI returned an empty analysis.");
    }

    return {
      runId,
      model: DEFAULT_OPENAI_MODEL,
      payload,
      userPrompt,
      analysis
    };
  }
}
