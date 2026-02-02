import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DEFAULT_BUCKET = "school-logos";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  contents.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
    const [rawKey, ...rest] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rest.join("=").trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function parseArgs(args) {
  const out = {};
  args.forEach((arg) => {
    if (!arg.startsWith("--")) return;
    const [key, value] = arg.replace(/^--/, "").split("=");
    out[key] = value ?? true;
  });
  return out;
}

async function listAllFiles(supabase, bucket, prefix = "") {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error) throw error;

  const files = [];
  for (const item of data || []) {
    if (item.id) {
      files.push(prefix ? `${prefix}/${item.name}` : item.name);
    } else {
      const nestedPrefix = prefix ? `${prefix}/${item.name}` : item.name;
      const nested = await listAllFiles(supabase, bucket, nestedPrefix);
      files.push(...nested);
    }
  }
  return files;
}

async function main() {
  loadEnvFile(path.join(ROOT, ".env"));
  loadEnvFile(path.join(ROOT, ".env.local"));

  const args = parseArgs(process.argv.slice(2));
  const bucket = args.bucket || DEFAULT_BUCKET;
  const dryRun = Boolean(args["dry-run"]);

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  if (!dryRun) {
    const files = await listAllFiles(supabase, bucket);
    if (files.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove(files);
      if (removeError) {
        console.error("Failed to remove files:", removeError.message);
      }
    }

    const { error: bucketError } = await supabase.storage.deleteBucket(bucket);
    if (bucketError) {
      console.error("Failed to delete bucket:", bucketError.message);
    }
  }

  if (!dryRun) {
    const { error: updateError } = await supabase
      .from("School data")
      .update({ logo_url: null, logo_source: null, logo_last_checked: null })
      .not("logo_url", "is", null);

    if (updateError) {
      console.error("Failed to reset logo fields:", updateError.message);
    }
  }

  console.log("Rollback finished.");
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
