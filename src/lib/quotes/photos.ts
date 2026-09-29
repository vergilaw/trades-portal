import type { QuotePhotoPhase } from "@/types";

export const QUOTE_IMAGES_BUCKET = "quote-images";
export const MAX_QUOTE_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTO_DIMENSION = 1920;
export const SIGNED_PHOTO_URL_TTL_SECONDS = 60 * 60;

export type QuotePhotoView = {
  id: string;
  phase: QuotePhotoPhase;
  storagePath: string;
  width: number;
  height: number;
  position: number;
  signedUrl: string;
};

export type CompressedPhoto = {
  file: File;
  width: number;
  height: number;
};

const acceptedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export class PhotoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoValidationError";
  }
}

function getExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function detectMimeType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  const header = String.fromCharCode(...bytes);
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
    return "image/webp";
  }

  return null;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new PhotoValidationError("This image could not be opened."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new PhotoValidationError("This browser could not compress the image."));
        }
      },
      "image/webp",
      quality,
    );
  });
}

export async function compressQuotePhoto(file: File): Promise<CompressedPhoto> {
  const extension = getExtension(file.name);

  if (!acceptedExtensions.has(extension) || !acceptedMimeTypes.has(file.type)) {
    throw new PhotoValidationError("Choose a JPG, JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new PhotoValidationError(
      "The original image is too large. Choose a file under 20MB.",
    );
  }

  const detectedMimeType = await detectMimeType(file);
  if (!detectedMimeType || detectedMimeType !== file.type) {
    throw new PhotoValidationError(
      "The file content does not match its image type.",
    );
  }

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const initialScale = Math.min(1, MAX_PHOTO_DIMENSION / longestSide);
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new PhotoValidationError("This browser cannot process images.");
  }

  const qualitySteps = [0.86, 0.76, 0.66, 0.56, 0.46];
  let compressed: Blob | null = null;

  for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualitySteps) {
      compressed = await canvasToBlob(canvas, quality);
      if (compressed.size <= MAX_PHOTO_BYTES) {
        const safeBaseName =
          file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") ||
          "quote-photo";

        return {
          file: new File([compressed], `${safeBaseName}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          }),
          width,
          height,
        };
      }
    }

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  throw new PhotoValidationError(
    "The image is still over 2MB after compression. Choose a smaller image.",
  );
}
