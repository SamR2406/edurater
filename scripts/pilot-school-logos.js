import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DEFAULT_BUCKET = "school-logos";
const DEFAULT_LIMIT = 200;
const DEFAULT_DELAY_MS = 200;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 150 * 1024;
const DEFAULT_SIZE = 64;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWebsite(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function getAttr(tag, name) {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return match ? match[1].trim() : "";
}

function extractIconHref(html) {
  const links = html.match(/<link\s+[^>]*>/gi) || [];
  const candidates = [];

  links.forEach((link) => {
    const rel = getAttr(link, "rel").toLowerCase();
    const href = getAttr(link, "href");
    if (!href || !rel.includes("icon")) return;
    candidates.push({ rel, href });
  });

  const preferred = candidates.find(
    (c) =>
      c.rel === "icon" ||
      c.rel.includes("shortcut icon") ||
      c.rel.includes("icon shortcut")
  );
  if (preferred) return preferred.href;

  const apple = candidates.find((c) => c.rel.includes("apple-touch-icon"));
  return (apple || candidates[0])?.href || "";
}

function guessExtension(contentType, url) {
  const lower = (contentType || "").toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("svg")) return "svg";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("icon") || lower.includes("ico")) return "ico";

  const fromUrl = (url || "").split("?")[0].split("#")[0];
  const dot = fromUrl.lastIndexOf(".");
  if (dot > -1) {
    const ext = fromUrl.slice(dot + 1).toLowerCase();
    if (["png", "svg", "jpg", "jpeg", "ico"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  }

  return "ico";
}

async function fetchWithTimeout(url, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "EduRaterLogoBot/0.1",
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureBucket(supabase, bucket) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const exists = (buckets || []).some((b) => b.name === bucket);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
  });
  if (createError) throw createError;
}

async function resolveIconUrl(websiteUrl, timeoutMs) {
  const origin = new URL(websiteUrl).origin;
  let html = "";
  try {
    const res = await fetchWithTimeout(websiteUrl, timeoutMs, {
      Accept: "text/html",
    });
    if (res.ok) {
      html = await res.text();
    }
  } catch (error) {
    return `${origin}/favicon.ico`;
  }

  if (!html) {
    return `${origin}/favicon.ico`;
  }

  const href = extractIconHref(html);
  if (!href) {
    return `${origin}/favicon.ico`;
  }

  try {
    return new URL(href, websiteUrl).toString();
  } catch (error) {
    return `${origin}/favicon.ico`;
  }
}

async function downloadIcon(url, timeoutMs, maxBytes) {
  let res;
  try {
    res = await fetchWithTimeout(url, timeoutMs, {
      Accept: "image/*",
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return { error: "Timeout", buffer: null, contentType: "" };
    }
    return { error: error?.message || "Fetch failed", buffer: null, contentType: "" };
  }
  if (!res.ok) {
    return { error: `HTTP ${res.status}`, buffer: null, contentType: "" };
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    return { error: "Not an image", buffer: null, contentType };
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    return { error: "Image too large", buffer: null, contentType };
  }

  return { error: null, buffer: Buffer.from(arrayBuffer), contentType };
}

async function main() {
  loadEnvFile(path.join(ROOT, ".env"));
  loadEnvFile(path.join(ROOT, ".env.local"));

  const args = parseArgs(process.argv.slice(2));
  const limit = Number(args.limit) || DEFAULT_LIMIT;
  const maxTotal = Number(args.max) || 0;
  const startAfter = args["start-after"] || "";
  const bucket = args.bucket || DEFAULT_BUCKET;
  const delayMs = Number(args.delay) || DEFAULT_DELAY_MS;
  const timeoutMs = Number(args.timeout) || DEFAULT_TIMEOUT_MS;
  const maxBytes = Number(args["max-bytes"]) || DEFAULT_MAX_BYTES;
  const size = Number(args.size) || DEFAULT_SIZE;
  const dryRun = Boolean(args["dry-run"]);
  const markMissing = args["mark-missing"] !== "false";
  const fallbackOnly = Boolean(args["fallback-only"]);
  const retryMissing = Boolean(args["retry-missing"]);

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch (error) {
    console.error("Missing sharp. Run: npm install");
    process.exit(1);
  }

  if (!dryRun) {
    await ensureBucket(supabase, bucket);
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  let lastUrn = startAfter;

  while (true) {
    let query = supabase
      .from("School data")
      .select("URN, EstablishmentName, SchoolWebsite, logo_url, logo_source")
      .is("logo_url", null)
      .not("SchoolWebsite", "is", null)
      .neq("SchoolWebsite", "")
      .order("URN", { ascending: true })
      .limit(limit);

    if (retryMissing) {
      query = query.eq("logo_source", "missing");
    }

    if (lastUrn) {
      query = query.gt("URN", lastUrn);
    }

    const { data: schools, error } = await query;

    if (error) {
      console.error("Failed to load schools:", error.message);
      process.exit(1);
    }

    if (!schools || schools.length === 0) {
      break;
    }

    for (const school of schools) {
      processed += 1;
      if (maxTotal && processed > maxTotal) {
        break;
      }
    try {
      const website = normalizeWebsite(school.SchoolWebsite);
      if (!website || !school.URN) {
        skipped += 1;
        continue;
      }

      const originFavicon = `${new URL(website).origin}/favicon.ico`;
      const primaryIconUrl = fallbackOnly
        ? originFavicon
        : await resolveIconUrl(website, timeoutMs);

      let { error: iconError, buffer, contentType } = await downloadIcon(
        primaryIconUrl,
        timeoutMs,
        maxBytes
      );

      if (iconError && !fallbackOnly) {
        const fallbackResult = await downloadIcon(
          originFavicon,
          timeoutMs,
          maxBytes
        );
        iconError = fallbackResult.error;
        buffer = fallbackResult.buffer;
        contentType = fallbackResult.contentType;
      }

      if (iconError || !buffer) {
        failed += 1;
        if (!dryRun && markMissing) {
          await supabase
            .from("School data")
            .update({
              logo_source: `missing:${iconError || "unknown"}`,
              logo_last_checked: new Date().toISOString(),
            })
            .eq("URN", school.URN);
        }
        continue;
      }

      let pngBuffer;
      try {
        pngBuffer = await sharp(buffer)
          .resize(size, size, { fit: "inside" })
          .png({ compressionLevel: 9 })
          .toBuffer();
      } catch (error) {
        failed += 1;
        console.error(`Resize failed for ${school.URN}:`, error.message);
        if (!dryRun && markMissing) {
          await supabase
            .from("School data")
            .update({
              logo_source: `resize:${error?.message || "error"}`,
              logo_last_checked: new Date().toISOString(),
            })
            .eq("URN", school.URN);
        }
        continue;
      }

      const pathKey = `${school.URN}.png`;

      if (!dryRun) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(pathKey, pngBuffer, {
            upsert: true,
            contentType: "image/png",
          });

        if (uploadError) {
          console.error(`Upload failed for ${school.URN}:`, uploadError.message);
          failed += 1;
          continue;
        }

        const { data: publicUrl } = supabase.storage
          .from(bucket)
          .getPublicUrl(pathKey);

        const { error: updateError } = await supabase
          .from("School data")
          .update({
            logo_url: publicUrl.publicUrl,
            logo_source: "favicon",
            logo_last_checked: new Date().toISOString(),
          })
          .eq("URN", school.URN);

        if (updateError) {
          console.error(`Update failed for ${school.URN}:`, updateError.message);
          failed += 1;
          continue;
        }
      }

      success += 1;
      await sleep(delayMs);
    } catch (error) {
      failed += 1;
      console.error(`Unhandled error for ${school?.URN || "unknown"}`, error);
    }
      lastUrn = school.URN;
    }

    if (maxTotal && processed >= maxTotal) {
      break;
    }
  }

  console.log(
    `Done. Success: ${success}, Failed: ${failed}, Skipped: ${skipped}`
  );
  if (lastUrn) {
    console.log(`Last URN processed: ${lastUrn}`);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
