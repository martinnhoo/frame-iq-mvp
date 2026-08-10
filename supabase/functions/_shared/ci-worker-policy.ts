type WorkerAction = "select" | "insert" | "update";

export interface WorkerOperation {
  action?: string;
  table?: string;
  rows?: unknown;
  patch?: Record<string, unknown>;
  match?: Record<string, string>;
  filters?: Record<string, string>;
  on_conflict?: string;
}

interface TablePolicy {
  actions: WorkerAction[];
  selectIdentity?: string[];
  insertRequired?: string[];
  updateIdentity?: string[];
  updateColumns?: string[];
  conflicts?: string[];
}

const JOB_UPDATE_COLUMNS = [
  "status", "stage", "progress", "completed_stages", "skipped_stages", "warnings",
  "attempts", "error", "error_code", "next_retry_at", "locked_by", "locked_at",
  "lease_expires_at", "started_at", "finished_at", "llm_provider", "llm_model",
  "llm_input_tokens", "llm_output_tokens", "cost_usd", "asset_id",
  "was_duplicate", "bytes_downloaded", "bytes_total", "bytes_per_second",
];

const TABLE_POLICIES: Record<string, TablePolicy> = {
  ci_ad_media_sources: {
    actions: ["select", "update"], selectIdentity: ["id", "ad_id"], updateIdentity: ["id"],
    updateColumns: ["status", "error", "asset_id"],
  },
  ci_assets: {
    actions: ["select", "insert", "update"], selectIdentity: ["id", "brand_id"],
    insertRequired: ["brand_id", "user_id", "sha256", "storage_key"], updateIdentity: ["id"],
    updateColumns: ["duration_seconds", "width", "height", "fps", "video_codec", "audio_codec", "has_audio", "bitrate", "aspect_ratio", "analysis_version", "analysis_status", "analyzed_at", "thumbnail_key"],
  },
  ci_ad_assets: {
    actions: ["select", "insert"], selectIdentity: ["id", "asset_id", "ad_id"],
    insertRequired: ["ad_id", "asset_id", "user_id"], conflicts: ["ad_id,asset_id,role"],
  },
  ci_ads: {
    actions: ["select", "update"], selectIdentity: ["id"], updateIdentity: ["id"],
    updateColumns: ["analysis_status"],
  },
  ci_analysis_jobs: {
    actions: ["insert", "update"], insertRequired: ["brand_id", "user_id", "asset_id"],
    updateIdentity: ["id", "locked_by"], updateColumns: JOB_UPDATE_COLUMNS,
    conflicts: ["asset_id"],
  },
  ci_analysis_results: {
    actions: ["select", "insert"], selectIdentity: ["id", "asset_id", "ad_asset_id"],
    insertRequired: ["asset_id", "brand_id", "user_id"],
  },
  ci_download_jobs: {
    actions: ["update"], updateIdentity: ["id", "locked_by"], updateColumns: JOB_UPDATE_COLUMNS,
  },
  ci_job_events: {
    actions: ["insert"], insertRequired: ["user_id", "job_kind", "message"],
  },
  ci_keyframes: {
    actions: ["select", "insert"], selectIdentity: ["id", "asset_id"],
    insertRequired: ["asset_id", "brand_id", "user_id", "frame_index"], conflicts: ["asset_id,frame_index"],
  },
  ci_model_runs: {
    actions: ["insert"], insertRequired: ["brand_id", "user_id", "purpose", "provider", "model", "prompt_version"],
  },
  ci_ocr_tracks: {
    actions: ["insert"], insertRequired: ["asset_id", "user_id", "timestamp_s"],
  },
  ci_onscreen_text: {
    actions: ["select", "insert"], selectIdentity: ["asset_id"],
    insertRequired: ["asset_id", "brand_id", "user_id", "track_index"], conflicts: ["asset_id,track_index"],
  },
  ci_scenes: {
    actions: ["select", "insert", "update"], selectIdentity: ["asset_id"],
    insertRequired: ["asset_id", "brand_id", "user_id", "scene_index"], updateIdentity: ["asset_id"],
    updateColumns: ["setting", "setting_kind", "description", "camera_style", "framing", "action", "scene_function", "product_visible", "confidence", "source", "model_version"],
    conflicts: ["asset_id,scene_index"],
  },
  ci_storage_objects: {
    actions: ["insert"], insertRequired: ["brand_id", "user_id", "object_key", "category"],
    conflicts: ["bucket,object_key"],
  },
  ci_taxonomy_terms: {
    actions: ["select", "insert"], selectIdentity: ["id", "brand_id"],
    insertRequired: ["brand_id", "user_id", "kind", "slug"], conflicts: ["brand_id,kind,slug"],
  },
  ci_ad_taxonomy: {
    actions: ["insert"], insertRequired: ["ad_id", "term_id", "brand_id", "user_id"],
    conflicts: ["ad_id,term_id,dedup_key"],
  },
  ci_transcripts: {
    actions: ["select", "insert"], selectIdentity: ["asset_id"],
    insertRequired: ["asset_id", "brand_id", "user_id"], conflicts: ["asset_id"],
  },
  ci_transcript_segments: {
    actions: ["select", "insert"], selectIdentity: ["asset_id", "transcript_id"],
    insertRequired: ["transcript_id", "asset_id", "user_id", "segment_index"],
    conflicts: ["transcript_id,segment_index"],
  },
};

function rowsAsObjects(rows: unknown): Record<string, unknown>[] {
  const values = Array.isArray(rows) ? rows : [rows];
  if (!values.length || values.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Worker rows must be non-empty objects");
  }
  return values as Record<string, unknown>[];
}

function hasIdentity(filters: Record<string, string> | undefined, allowed: string[]): boolean {
  return Boolean(filters && allowed.some((column) => typeof filters[column] === "string"));
}

export function assertWorkerOperationAllowed(operation: WorkerOperation): void {
  const action = operation.action as WorkerAction;
  const policy = operation.table ? TABLE_POLICIES[operation.table] : undefined;
  if (!policy || !policy.actions.includes(action)) throw new Error("Worker table/action is not allowed");

  if (action === "select" && !hasIdentity(operation.filters, policy.selectIdentity ?? [])) {
    throw new Error("Worker select requires an allowed identity filter");
  }

  if (action === "insert") {
    for (const row of rowsAsObjects(operation.rows)) {
      for (const field of policy.insertRequired ?? []) {
        if (row[field] == null || row[field] === "") throw new Error(`Worker insert requires ${field}`);
      }
    }
    if (operation.on_conflict && !(policy.conflicts ?? []).includes(operation.on_conflict)) {
      throw new Error("Worker conflict target is not allowed");
    }
  }

  if (action === "update") {
    if (!hasIdentity(operation.match, policy.updateIdentity ?? [])) {
      throw new Error("Worker update requires an allowed row identity");
    }
    const patchColumns = Object.keys(operation.patch ?? {});
    if (!patchColumns.length || patchColumns.some((column) => !(policy.updateColumns ?? []).includes(column))) {
      throw new Error("Worker update contains a column that is not allowed");
    }
  }
}

const STORAGE_KEY = /^brands\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(originals|keyframes|analysis|thumbnails)\/[A-Za-z0-9._/-]+$/i;

export function isWorkerStorageKeyAllowed(key: string): boolean {
  return STORAGE_KEY.test(key) && !key.includes("..") && !key.includes("//");
}
