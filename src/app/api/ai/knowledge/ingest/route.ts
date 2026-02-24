import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/ai/auth";
import { createEmbedding } from "@/lib/ai/openai";
import { toPgVectorLiteral } from "@/lib/ai/citations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IngestBodySchema = z.object({
  id: z.string().uuid().optional(),
  projectCode: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(280),
  content: z.string().trim().min(1).max(60000),
  tags: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const parsed = IngestBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }

    const payload = parsed.data;
    const embedding = await createEmbedding(`${payload.title}\n\n${payload.content}`);

    const upsertPayload: {
      id?: string;
      project_code: string;
      title: string;
      content: string;
      tags: string[] | null;
      embedding: string;
    } = {
      project_code: payload.projectCode,
      title: payload.title,
      content: payload.content,
      tags: payload.tags || null,
      embedding: toPgVectorLiteral(embedding),
    };

    if (payload.id) {
      upsertPayload.id = payload.id;
    }

    const { data, error } = await auth.adminClient
      .from("ai_knowledge")
      .upsert(upsertPayload, { onConflict: "id" })
      .select("id,title,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected ingest error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
