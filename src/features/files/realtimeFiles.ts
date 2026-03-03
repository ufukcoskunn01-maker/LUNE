"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

type FileChangeRow = {
  entity_type?: string | null;
  entity_id?: string | null;
};

type RealtimeFilesArgs = {
  supabase: SupabaseClient;
  entityType: string;
  entityId: string;
  onChange?: (payload: { old: FileChangeRow | null; new: FileChangeRow | null }) => void;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value : "";
}

function rowMatches(row: FileChangeRow | null | undefined, entityType: string, entityId: string) {
  if (!row) return false;
  return normalize(row.entity_type) === entityType && normalize(row.entity_id) === entityId;
}

export function subscribeFilesRealtime(args: RealtimeFilesArgs) {
  const { supabase, entityType, entityId, onChange } = args;
  const channel = supabase.channel(`files:${entityType}:${entityId}:${Date.now()}`);
  const filter = `entity_type=eq.${entityType},entity_id=eq.${entityId}`;

  const handleChange = (payload: { old: FileChangeRow | null; new: FileChangeRow | null }) => {
    const matches = rowMatches(payload.new, entityType, entityId) || rowMatches(payload.old, entityType, entityId);
    if (!matches) return;

    onChange?.(payload);
  };

  channel
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "files", filter },
      (payload) => handleChange(payload as { old: FileChangeRow | null; new: FileChangeRow | null })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "files", filter },
      (payload) => handleChange(payload as { old: FileChangeRow | null; new: FileChangeRow | null })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "files", filter },
      (payload) => handleChange(payload as { old: FileChangeRow | null; new: FileChangeRow | null })
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
