// Evidence upload handling: multipart parsing to local disk (UPLOAD_DIR).
//
// Cloudinary is not configured in this deployment, so assets are stored on a
// mounted volume and served back by the API under /api/v1/uploads/*. Swap this
// module for an object-store uploader (signed URLs) before production.

import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "./http.js";

/** Mime type -> asset kind. Anything else is rejected by the file filter. */
const ALLOWED_MIME: Record<string, "IMAGE" | "VIDEO"> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/heic": "IMAGE",
  "video/mp4": "VIDEO",
  "video/quicktime": "VIDEO",
};

export const MAX_EVIDENCE_FILES = 20;

export const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: env.UPLOAD_DIR,
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || ".bin";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_MB * 1024 * 1024,
    files: MAX_EVIDENCE_FILES,
    fieldSize: 16 * 1024, // small JSON fields only; files go through multer storage
  },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME[file.mimetype]) {
      cb(null, true);
      return;
    }
    cb(new AppError(400, "UNSUPPORTED_FILE_TYPE", `Unsupported file type: ${file.mimetype}`));
  },
});

/** Public URL the client + AI service use to fetch an uploaded file. */
export function assetUrl(filename: string): string {
  return `/api/v1/uploads/${encodeURIComponent(filename)}`;
}

export function classifyMime(mimetype: string): "IMAGE" | "VIDEO" {
  return ALLOWED_MIME[mimetype] ?? "IMAGE";
}

/**
 * Study material / assignment attachments: PDF, DOC/DOCX, PPT/PPTX, TXT (plus
 * images so teachers can include diagrams). Maps to MaterialKind for storage.
 */
const MATERIAL_ALLOWED_MIME: Record<
  string,
  "PDF" | "DOCX" | "PPT" | "TEXT" | "IMAGE" | "VIDEO_LINK"
> = {
  "application/pdf": "PDF",
  "application/msword": "DOCX",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPT",
  "text/plain": "TEXT",
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "video/mp4": "VIDEO_LINK",
};

/** Multer instance for assignment materials + submission attachments. */
export const documentUpload = multer({
  storage: multer.diskStorage({
    destination: env.UPLOAD_DIR,
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || ".bin";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_MB * 1024 * 1024,
    files: 10,
    fieldSize: 16 * 1024,
  },
  fileFilter(_req, file, cb) {
    if (MATERIAL_ALLOWED_MIME[file.mimetype]) {
      cb(null, true);
      return;
    }
    cb(new AppError(400, "UNSUPPORTED_FILE_TYPE", `Unsupported file type: ${file.mimetype}. Use PDF, DOCX, PPT, TXT, image or MP4.`));
  },
});

/** Classify an uploaded material file into its MaterialKind. */
export function classifyMaterialMime(
  mimetype: string,
): "PDF" | "DOCX" | "PPT" | "TEXT" | "IMAGE" | "VIDEO_LINK" | "LINK" {
  return MATERIAL_ALLOWED_MIME[mimetype] ?? "LINK";
}

const ANIMATION_ALLOWED_MIME = new Set([
  "video/webm",
  "video/mp4",
  "video/quicktime",
  "application/octet-stream",
]);

/**
 * Multer instance for student animation video recordings (WebM / MP4) plus an
 * optional JPEG/PNG poster thumbnail. The file filter is field-aware: the
 * "video" field accepts video mimetypes, the "thumbnail" field image ones.
 */
const ANIMATION_THUMBNAIL_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export const animationVideoUpload = multer({
  storage: multer.diskStorage({
    destination: env.UPLOAD_DIR,
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase() || (file.fieldname === "thumbnail" ? ".jpg" : ".webm");
      cb(null, `anim_${crypto.randomUUID()}${ext.startsWith(".") ? ext : `.${ext}`}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 2, // video + optional thumbnail poster
    fieldSize: 16 * 1024,
  },
  fileFilter(_req, file, cb) {
    if (file.fieldname === "thumbnail") {
      if (ANIMATION_THUMBNAIL_MIME.has(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new AppError(400, "UNSUPPORTED_FILE_TYPE", `Unsupported thumbnail format: ${file.mimetype}. Use JPEG, PNG or WebP.`));
      return;
    }
    if (ANIMATION_ALLOWED_MIME.has(file.mimetype) || file.mimetype.startsWith("video/")) {
      cb(null, true);
      return;
    }
    cb(new AppError(400, "UNSUPPORTED_FILE_TYPE", `Unsupported video format: ${file.mimetype}. Expected WebM or MP4.`));
  },
});

