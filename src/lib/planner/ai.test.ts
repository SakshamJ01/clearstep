import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiGenerationError,
  aiProviderName,
  generateWithAi,
  isAiConfigured,
} from "@/lib/planner/ai";
import { generatePlanDraft } from "@/lib/planner";
import type { DraftContent, PlanningInput } from "@/lib/schemas";

const input: PlanningInput = {
  requestId: "request-12345",
  dump: "Call the dentist, open the brown envelope, and send the form back.",
  outcome: "Finish the life admin",
  horizonDate: null,
  availableMinutesPerWeek: 120,
  constraints: "Evenings only.",
  aiConsent: true,
};

const validContent: DraftContent = {
  title: "Finish the life admin",
  summary: "Three small admin steps, ordered by what unlocks the rest.",
  statedFacts: ["The user needs to call the dentist."],
  assumptions: ["The form can be sent after the envelope is opened."],
  tasks: [
    {
      id: "t1",
      title: "Open the brown envelope",
      description: "Open it and check what the form asks for.",
      effortMin: 5,
      effortMax: 10,
      dependsOn: [],
      rationale: "The form cannot be completed until it is read.",
      isAssumption: false,
    },
    {
      id: "t2",
      title: "Send the form back",
      description: "Fill in the form and send it.",
      effortMin: 20,
      effortMax: 30,
      dependsOn: ["t1"],
      rationale: null,
      isAssumption: false,
    },
    {
      id: "t3",
      title: "Call the dentist",
      description: "Book the next available check-up.",
      effortMin: 10,
      effortMax: 15,
      dependsOn: [],
      rationale: null,
      isAssumption: false,
    },
  ],
  clarifyingQuestion: null,
  startHereTaskId: "t1",
};

function chatResponse(content: unknown, model = "mock-model-2026") {
  return new Response(
    JSON.stringify({
      model,
      choices: [
        {
          message: {
            content: typeof content === "string" ? content : JSON.stringify(content),
          },
          finish_reason: "stop",
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function configureProvider() {
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://provider.example/v1/";
  process.env.LLM_MODEL = "mock-model";
  process.env.LLM_PROVIDER_NAME = "Mock Provider";
}

function configureFallbackProvider() {
  process.env.LLM_FALLBACK_API_KEY = "fallback-key";
  process.env.LLM_FALLBACK_BASE_URL = "https://fallback.example/v1/";
  process.env.LLM_FALLBACK_MODEL = "fallback-model";
  process.env.LLM_FALLBACK_PROVIDER_NAME = "Fallback Provider";
}

beforeEach(configureProvider);

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_PROVIDER_NAME;
  delete process.env.LLM_FALLBACK_API_KEY;
  delete process.env.LLM_FALLBACK_BASE_URL;
  delete process.env.LLM_FALLBACK_MODEL;
  delete process.env.LLM_FALLBACK_PROVIDER_NAME;
});

describe("AI generation", () => {
  it("reports configuration and calls an OpenAI-compatible endpoint", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => chatResponse(validContent),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(isAiConfigured()).toBe(true);
    const result = await generateWithAi(input);

    expect(result.model).toBe("mock-model-2026");
    expect(result.content.tasks).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://provider.example/v1/chat/completions");
    const body = JSON.parse(String((init as RequestInit).body)) as {
      model: string;
      temperature: number;
      response_format: { type: string };
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("mock-model");
    expect(body.temperature).toBe(0.2);
    expect(body.response_format.type).toBe("json_object");
    expect(body.messages[0]?.content).toContain("untrusted data");
    expect(body.messages[1]?.content).toContain(input.dump);
  });

  it("uses the fallback provider when the primary provider fails", async () => {
    configureFallbackProvider();
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => chatResponse(validContent),
    );
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateWithAi(input);

    expect(result.model).toBe("mock-model-2026");
    expect(result.content.title).toBe(validContent.title);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://fallback.example/v1/chat/completions",
    );

    const fallbackBody = JSON.parse(
      String((fetchMock.mock.calls[1]?.[1] as RequestInit).body),
    ) as { model: string };
    expect(fallbackBody.model).toBe("fallback-model");
  });

  it("uses the fallback provider when the primary response is invalid", async () => {
    configureFallbackProvider();
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => chatResponse(validContent),
    );
    fetchMock.mockResolvedValueOnce(chatResponse("not json"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateWithAi(input);

    expect(result.content.title).toBe(validContent.title);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback configuration when the primary is absent", async () => {
    delete process.env.LLM_API_KEY;
    configureFallbackProvider();
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => chatResponse(validContent),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(isAiConfigured()).toBe(true);
    const result = await generateWithAi(input);

    expect(result.content.title).toBe(validContent.title);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://fallback.example/v1/chat/completions",
    );
  });

  it("names both providers in consent copy", () => {
    configureFallbackProvider();

    expect(aiProviderName()).toBe("Mock Provider (fallback: Fallback Provider)");
  });

  it("tolerates fenced JSON around the draft", async () => {
    const fenced = `\`\`\`json\n${JSON.stringify(validContent)}\n\`\`\``;
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse(fenced)));

    const result = await generateWithAi(input);

    expect(result.content.title).toBe(validContent.title);
  });

  it("normalizes invalid dependencies in a valid provider response", async () => {
    const content = structuredClone(validContent);
    content.tasks[0]!.dependsOn = ["t3"];
    content.tasks[1]!.dependsOn = ["t1", "t1", "missing"];
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse(content)));

    const result = await generateWithAi(input);

    expect(result.content.tasks[0]?.dependsOn).toEqual(["t3"]);
    expect(result.content.tasks[1]?.dependsOn).toEqual(["t1"]);
    expect(result.content.assumptions).toContain(
      "A suggested link between steps was removed because it could not form a clear sequence.",
    );
  });

  it("throws an invalid error when the response is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse("not json")));

    await expect(generateWithAi(input)).rejects.toMatchObject({
      name: "AiGenerationError",
      kind: "invalid",
    });
  });

  it("throws an invalid error when the draft fails schema validation", async () => {
    const invalid = { ...validContent, tasks: [validContent.tasks[0]] };
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse(invalid)));

    await expect(generateWithAi(input)).rejects.toBeInstanceOf(AiGenerationError);
    await expect(generateWithAi(input)).rejects.toMatchObject({ kind: "invalid" });
  });

  it("throws a provider error when the endpoint rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 429 })),
    );

    await expect(generateWithAi(input)).rejects.toMatchObject({
      kind: "provider",
    });
  });

  it("throws a timeout error when the request is aborted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(new Error("aborted"), { name: "TimeoutError" });
      }),
    );

    await expect(generateWithAi(input)).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("does not call a provider without configuration", async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_FALLBACK_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(isAiConfigured()).toBe(false);
    await expect(generateWithAi(input)).rejects.toMatchObject({
      kind: "provider",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("generatePlanDraft", () => {
  it("uses the manual planner without consent and never calls a provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePlanDraft({ ...input, aiConsent: false }, "ask");

    expect(result.mode).toBe("manual");
    expect(result.fallbackKind).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honors the manual-only preference even when consent is present", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePlanDraft(input, "manual_only");

    expect(result.mode).toBe("manual");
    expect(result.fallbackReason).toContain("turned off");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back with a reason when the provider returns invalid content", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse("not json")));

    const result = await generatePlanDraft(input, "ask");

    expect(result.mode).toBe("manual_fallback");
    expect(result.fallbackKind).toBe("invalid");
    expect(result.fallbackReason).toContain("could not be validated");
    expect(result.content.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("uses AI content when the provider succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse(validContent)));

    const result = await generatePlanDraft(input, "ask");

    expect(result.mode).toBe("ai");
    expect(result.fallbackKind).toBeNull();
    expect(result.model).toBe("mock-model-2026");
    expect(result.content.title).toBe(validContent.title);
  });

  it("builds a manual fallback when both providers fail", async () => {
    configureFallbackProvider();
    const fetchMock = vi.fn(async () => new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePlanDraft(input, "ask");

    expect(result.mode).toBe("manual_fallback");
    expect(result.fallbackKind).toBe("provider");
    expect(result.content.tasks.length).toBeGreaterThanOrEqual(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
