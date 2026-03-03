"use client";

import { useCallback, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { uploadFile as uploadFileImpl, type FileRow, type UploadFileInput } from "@/features/files/uploadFile";
import { filesCacheKey, invalidateFilesCache } from "@/features/files/useFiles";

type ClientUploadFileInput = Omit<UploadFileInput, "supabase">;

type UseUploadFileResult = {
  uploadFile: (input: ClientUploadFileInput) => Promise<FileRow>;
  isUploading: boolean;
  error: Error | null;
};

export function useUploadFile(): UseUploadFileResult {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = useCallback(async (input: ClientUploadFileInput) => {
    setIsUploading(true);
    setError(null);

    try {
      const row = await uploadFileImpl({
        ...input,
        supabase: supabaseBrowser(),
        data: input.data ?? input.file,
        contentType: input.contentType ?? input.file?.type,
        fileName: input.fileName ?? input.file?.name,
      });
      invalidateFilesCache(filesCacheKey(input.entityType, input.entityId));
      return row;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
      throw nextError;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    uploadFile,
    isUploading,
    error,
  };
}
