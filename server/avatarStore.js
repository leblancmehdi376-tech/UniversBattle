import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const hasVercelBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function makeFilename(originalname) {
  const ext = path.extname(originalname || "").toLowerCase() || ".jpg";
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
}

// Enregistre un avatar (buffer en mémoire, venant de multer) et renvoie son URL.
// En prod (BLOB_READ_WRITE_TOKEN présent) l'URL est absolue (CDN Vercel Blob).
// En local, l'URL est relative (/uploads/...) et servie via express.static.
export async function saveAvatar(buffer, mimetype, originalname) {
  const filename = makeFilename(originalname);
  if (hasVercelBlob) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: mimetype,
    });
    return blob.url;
  }
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

// Best-effort: supprime un ancien avatar lors du remplacement.
export async function deleteAvatar(avatarUrl) {
  if (!avatarUrl) return;
  try {
    if (/^https?:\/\//i.test(avatarUrl)) {
      const { del } = await import("@vercel/blob");
      await del(avatarUrl);
    } else {
      await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(avatarUrl)));
    }
  } catch {
    // best-effort, on ignore les erreurs (fichier déjà absent, etc.)
  }
}

export { UPLOAD_DIR };
