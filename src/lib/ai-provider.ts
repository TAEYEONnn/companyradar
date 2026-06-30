type Provider = "nvidia" | "openai";

export type ProviderConfig = {
  provider: Provider;
  apiKey: string;
  model: string;
  endpoint: string;
};

export type JsonCompletionInput = {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** "json" adds response_format for OpenAI (default); "text" skips it for plain-text output */
  format?: "json" | "text";
};

export class AiProviderError extends Error {
  status?: number;
  provider: Provider;
  errorCode?: string;

  constructor(
    message: string,
    provider: Provider,
    status?: number,
    errorCode?: string,
  ) {
    super(message);
    this.name = "AiProviderError";
    this.provider = provider;
    this.status = status;
    this.errorCode = errorCode;
  }
}

export function getAiProviderConfig(): ProviderConfig {
  const providerEnv = process.env.AI_PROVIDER ?? "nvidia";
  const provider: Provider = providerEnv === "openai" ? "openai" : "nvidia";

  if (provider === "nvidia") {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      throw new AiProviderError("NVIDIA_API_KEY is not configured", "nvidia");
    }
    return {
      provider: "nvidia",
      apiKey,
      model: process.env.NVIDIA_MODEL ?? "mistralai/mistral-medium-3.5-128b",
      endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiProviderError("OPENAI_API_KEY is not configured", "openai");
  }
  return {
    provider: "openai",
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    endpoint: "https://api.openai.com/v1/chat/completions",
  };
}

export async function createJsonCompletion(
  input: JsonCompletionInput,
): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    temperature = 0.1,
    maxTokens = 8192,
    timeoutMs = 45_000,
  } = input;

  const config = getAiProviderConfig();

  let messages: Array<{ role: string; content: string }>;
  if (config.provider === "nvidia") {
    messages = [
      {
        role: "user",
        content: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt,
      },
    ];
  } else {
    messages = systemPrompt
      ? [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ]
      : [{ role: "user", content: userPrompt }];
  }

  const requestBody: Record<string, unknown> = {
    model: config.model,
    temperature,
    max_tokens: maxTokens,
    messages,
  };

  if (config.provider === "nvidia") {
    requestBody.stream = false;
  } else if ((input.format ?? "json") === "json") {
    requestBody.response_format = { type: "json_object" };
  }

  let response: Response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new AiProviderError(
      err instanceof Error ? err.message : "AI request failed",
      config.provider,
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; type?: string };
    } | null;
    const errorCode = body?.error?.code;
    console.error("[ai-provider] request failed", {
      provider: config.provider,
      status: response.status,
      errorCode,
    });
    throw new AiProviderError(
      "AI request failed",
      config.provider,
      response.status,
      errorCode,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
