export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GenericRow = Record<string, unknown>;
type GenericTable = {
  Row: GenericRow;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type FilesRow = {
  [key: string]: unknown;
  id: string;
  owner_id: string | null;
  bucket: string | null;
  path: string | null;
  mime_type: string | null;
  size: number | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  project_id: string | null;
  type: string | null;
  logical_name: string | null;
  revision: number | null;
  storage_path: string | null;
  original_filename: string | null;
  checksum_sha256: string | null;
  byte_size: number | null;
  meta: Record<string, unknown> | null;
};

export type Database = {
  public: {
    Tables: {
      [key: string]: GenericTable;
      files: {
        Row: FilesRow;
        Insert: Partial<FilesRow>;
        Update: Partial<FilesRow>;
        Relationships: [];
      };
      projects: {
        Row: {
          [key: string]: unknown;
          id: string;
          code: string;
          name: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      profiles: {
        Row: {
          [key: string]: unknown;
          user_id: string;
          email: string | null;
          username: string | null;
          must_change_password: boolean | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      transport_plates: {
        Row: {
          [key: string]: unknown;
          plate: string;
          project_code: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      transport_runs: {
        Row: {
          [key: string]: unknown;
          id: string;
          project_code: string;
          work_date: string;
          shift: string;
          plate: string;
          trips: number;
          photo_path: string | null;
          photo_file_id: string | null;
          comment: string | null;
          reported_by: string;
          reported_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      transport_reporters: {
        Row: {
          [key: string]: unknown;
          user_id: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      attendance_records: {
        Row: {
          [key: string]: unknown;
          work_date: string | null;
          project_id: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      import_jobs: {
        Row: {
          [key: string]: unknown;
          id: string;
          project_id: string | null;
          file_id: string | null;
          type: string | null;
          status: string | null;
          started_at: string | null;
          finished_at: string | null;
          request_meta: Json | null;
          log: Json | null;
          warnings_count: number | null;
          errors_count: number | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
