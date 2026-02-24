import { DEFAULT_AI_MODEL } from "@/lib/ai/constants";

function getOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");
  return apiKey;
}

export async function createEmbedding(input: string): Promise<number[]> {
  const apiKey = getOpenAIKey();
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embedding API error (${res.status}): ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || embedding.length !== 1536) {
    throw new Error("Embedding response is invalid.");
  }

  return embedding;
}

export async function generateAssistantAnswer(args: {
  systemPrompt: string;
  userMessage: string;
  knowledgeContext: string;
  model?: string;
}) {
  const apiKey = getOpenAIKey();
  const model = args.model || DEFAULT_AI_MODEL;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: args.systemPrompt }] },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Knowledge context:\n${args.knowledgeContext}\n\nUser message:\n${args.userMessage}`,
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Responses API error (${res.status}): ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    output_text?: string;
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  };

  const outputText = (json.output_text || "").trim();
  if (!outputText) {
    throw new Error("Responses API returned empty output.");
  }

  const usage = json.usage || {};
  const tokens = Number(usage.total_tokens || (Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0)));

  return { answer: outputText, tokens: Number.isFinite(tokens) ? tokens : null };
}
