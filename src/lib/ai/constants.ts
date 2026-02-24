export const DEFAULT_AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const DAILY_MESSAGE_LIMIT = Number(process.env.AI_DAILY_MESSAGE_LIMIT || 200);
export const KNOWLEDGE_MATCH_COUNT = Number(process.env.AI_KNOWLEDGE_MATCH_COUNT || 6);
