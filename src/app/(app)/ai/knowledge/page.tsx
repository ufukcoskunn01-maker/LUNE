"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAccessToken } from "@/lib/ai/client-auth";

const PROJECT_OPTIONS = ["A27", "A25", "A24", "A23", "A22"];

type KnowledgeRow = {
  id: string;
  project_code: string;
  title: string;
  tags: string[] | null;
  updated_at: string;
};

async function apiCall<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  return json.data as T;
}

export default function AIKnowledgePage() {
  const [token, setToken] = useState<string | null>(null);
  const [projectCode, setProjectCode] = useState("A27");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [rows, setRows] = useState<KnowledgeRow[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAccessToken().then((nextToken) => setToken(nextToken));
  }, []);

  const loadRows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiCall<KnowledgeRow[]>(`/api/ai/knowledge?projectCode=${encodeURIComponent(projectCode)}`, token);
      setRows(data);
      setIsAdmin(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load knowledge.");
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [token, projectCode]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setError("Admin authentication is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiCall("/api/ai/knowledge/ingest", token, {
        method: "POST",
        body: JSON.stringify({
          projectCode,
          title,
          content,
          tags: tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      setTitle("");
      setContent("");
      setTags("");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ingest knowledge.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>AI Knowledge Admin</CardTitle>
          <CardDescription>Create project knowledge entries for RAG retrieval.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {isAdmin ? (
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Project</span>
                  <select
                    value={projectCode}
                    onChange={(event) => setProjectCode(event.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {PROJECT_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Tags (comma separated)</span>
                  <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="risk, schedule, cost" />
                </label>
              </div>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Title</span>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Content</span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  required
                  rows={8}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </label>

              <Button type="submit" disabled={saving || !title.trim() || !content.trim()}>
                {saving ? "Saving..." : "Add knowledge card"}
              </Button>
            </form>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
              Admin access is required for knowledge ingest.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Knowledge Cards</CardTitle>
          <CardDescription>Existing records used by the AI assistant.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
          {!loading && isAdmin && rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No knowledge entries yet.</div>
          ) : null}
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{row.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {row.id} • {new Date(row.updated_at).toLocaleString()}
                </div>
                {row.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.tags.map((tag) => (
                      <Badge key={`${row.id}-${tag}`}>{tag}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
          {!token ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
              Sign in as an admin to manage knowledge.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
