"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { FileRow } from "@/features/files/uploadFile";
import { subscribeFilesRealtime } from "@/features/files/realtimeFiles";

export type FilesCacheKey = readonly ["files", string, string];

type UseFilesArgs = {
  entityType: string;
  entityId: string;
  enabled?: boolean;
};

type UseFilesResult = {
  cacheKey: FilesCacheKey;
  data: FileRow[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<FileRow[]>;
};

type CacheEntry = {
  data: FileRow[];
  loadedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<FileRow[]>>();
const listeners = new Map<string, Set<() => void>>();

function keyToString(key: FilesCacheKey) {
  return key.join("::");
}

function notify(keyString: string) {
  const callbacks = listeners.get(keyString);
  if (!callbacks) return;
  for (const callback of callbacks) {
    callback();
  }
}

export function filesCacheKey(entityType: string, entityId: string): FilesCacheKey {
  return ["files", entityType, entityId];
}

export function invalidateFilesCache(key: FilesCacheKey) {
  const keyString = keyToString(key);
  cache.delete(keyString);
  inFlight.delete(keyString);
  notify(keyString);
}

async function fetchFiles(entityType: string, entityId: string, force: boolean): Promise<FileRow[]> {
  const key = filesCacheKey(entityType, entityId);
  const keyString = keyToString(key);

  if (!force) {
    const cached = cache.get(keyString);
    if (cached) {
      return cached.data;
    }

    const existing = inFlight.get(keyString);
    if (existing) {
      return existing;
    }
  }

  const request = (async () => {
    const supabase = supabaseBrowser();
    const result = await supabase
      .from("files")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (result.error) {
      throw new Error(`Failed to load files: ${result.error.message}`);
    }

    const rows = (result.data ?? []) as FileRow[];
    cache.set(keyString, { data: rows, loadedAt: Date.now() });
    return rows;
  })();

  inFlight.set(keyString, request);
  request.finally(() => {
    if (inFlight.get(keyString) === request) {
      inFlight.delete(keyString);
    }
  });

  const rows = await request;
  notify(keyString);
  return rows;
}

function subscribeToFiles(key: FilesCacheKey, callback: () => void) {
  const keyString = keyToString(key);
  let set = listeners.get(keyString);
  if (!set) {
    set = new Set();
    listeners.set(keyString, set);
  }
  set.add(callback);
  return () => {
    const current = listeners.get(keyString);
    if (!current) return;
    current.delete(callback);
    if (current.size === 0) {
      listeners.delete(keyString);
    }
  };
}

export function useFiles(args: UseFilesArgs): UseFilesResult {
  const enabled = args.enabled ?? true;
  const supabase = useMemo(() => supabaseBrowser(), []);
  const cacheKey = useMemo(() => filesCacheKey(args.entityType, args.entityId), [args.entityId, args.entityType]);
  const cacheKeyString = keyToString(cacheKey);

  const [data, setData] = useState<FileRow[]>(() => cache.get(cacheKeyString)?.data ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(() => enabled && !cache.has(cacheKeyString));
  const [error, setError] = useState<Error | null>(null);

  const readFromCache = useCallback(() => {
    const cached = cache.get(cacheKeyString);
    if (cached) {
      setData(cached.data);
      setIsLoading(false);
    }
    return cached;
  }, [cacheKeyString]);

  const runFetch = useCallback(
    async (force: boolean) => {
      if (!enabled) {
        return [] as FileRow[];
      }
      setIsLoading(true);
      try {
        const rows = await fetchFiles(args.entityType, args.entityId, force);
        setData(rows);
        setError(null);
        return rows;
      } catch (cause) {
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        setError(nextError);
        throw nextError;
      } finally {
        setIsLoading(false);
      }
    },
    [args.entityId, args.entityType, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    return subscribeFilesRealtime({
      supabase,
      entityType: args.entityType,
      entityId: args.entityId,
      onChange: () => {
        invalidateFilesCache(cacheKey);
        void runFetch(false);
      },
    });
  }, [args.entityId, args.entityType, cacheKey, enabled, runFetch, supabase]);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeToFiles(cacheKey, () => {
      const cached = readFromCache();
      if (!cached) {
        void runFetch(false);
      }
    });
    return unsubscribe;
  }, [cacheKey, enabled, readFromCache, runFetch]);

  useEffect(() => {
    if (!enabled) return;
    if (!readFromCache()) {
      void runFetch(false);
    }
  }, [enabled, readFromCache, runFetch]);

  const refetch = useCallback(async () => runFetch(true), [runFetch]);

  return {
    cacheKey,
    data,
    isLoading,
    error,
    refetch,
  };
}
