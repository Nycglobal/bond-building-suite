/**
 * Copies every storage object from the source project to the target project,
 * preserving bucket ids and object paths exactly (product_images.image_path
 * depends on them).
 *
 * Run:
 *   TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... bun migration/scripts/copy-storage.ts
 */
import { createClient } from "@supabase/supabase-js";

const SRC_URL = process.env["SUPABASE_URL"]!;
const SRC_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const DST_URL = process.env["TARGET_SUPABASE_URL"]!;
const DST_KEY = process.env["TARGET_SERVICE_ROLE_KEY"]!;

if (!SRC_URL || !SRC_KEY) throw new Error("Missing source SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
if (!DST_URL || !DST_KEY) throw new Error("Missing TARGET_SUPABASE_URL / TARGET_SERVICE_ROLE_KEY");

const src = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } });
const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } });

const BUCKETS = ["images", "product-images"];

async function listAll(bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await src.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) out.push(...(await listAll(bucket, path)));
      else out.push(path);
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

for (const bucket of BUCKETS) {
  const { error: bucketError } = await dst.storage.createBucket(bucket, { public: false });
  if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError;

  const paths = await listAll(bucket);
  console.log(`[${bucket}] ${paths.length} objects`);

  let done = 0;
  for (const path of paths) {
    let lastError = "";
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { data, error } = await src.storage.from(bucket).download(path);
      if (error) {
        lastError = `download: ${error.message}`;
      } else {
        const body = new Uint8Array(await data.arrayBuffer());
        const { error: upErr } = await dst.storage.from(bucket).upload(path, body, {
          upsert: true,
          contentType: data.type || "application/octet-stream",
        });
        if (!upErr) {
          lastError = "";
          break;
        }
        lastError = `upload: ${upErr.message}`;
      }
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
    if (lastError) throw new Error(`${bucket}/${path} ${lastError}`);
    if (++done % 25 === 0) console.log(`  ${done}/${paths.length}`);
  }

  console.log(`[${bucket}] copied ${done}`);
}

console.log("Storage copy complete.");
