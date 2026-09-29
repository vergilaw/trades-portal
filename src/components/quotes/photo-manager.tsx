"use client";

import { Camera, Trash, UploadSimple } from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, useRef, useState } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  compressQuotePhoto,
  MAX_QUOTE_PHOTOS,
  PhotoValidationError,
  QUOTE_IMAGES_BUCKET,
  SIGNED_PHOTO_URL_TTL_SECONDS,
  type QuotePhotoView,
} from "@/lib/quotes/photos";
import { createClient } from "@/lib/supabase/client";
import type { QuotePhotoPhase } from "@/types";

type PhotoManagerProps = {
  quoteId: string;
  publicToken: string;
  initialPhotos: QuotePhotoView[];
};

const phaseOptions: Array<{
  value: QuotePhotoPhase;
  label: string;
  description: string;
}> = [
  { value: "before", label: "Before", description: "Condition before work" },
  { value: "after", label: "After", description: "Completed work" },
];

export function PhotoManager({
  quoteId,
  publicToken,
  initialPhotos,
}: PhotoManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initialPhotos);
  const [phase, setPhase] = useState<QuotePhotoPhase>("before");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const remaining = MAX_QUOTE_PHOTOS - photos.length;

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    if (files.length > remaining) {
      setError(
        remaining === 0
          ? "This quote already has the maximum of 10 photos."
          : `Choose no more than ${remaining} additional photo${remaining === 1 ? "" : "s"}.`,
      );
      return;
    }

    setUploading(true);
    setError("");
    const supabase = createClient();
    const failures: string[] = [];

    for (const [index, sourceFile] of files.entries()) {
      setProgress(`Compressing and uploading ${index + 1} of ${files.length}`);
      let storagePath = "";

      try {
        const compressed = await compressQuotePhoto(sourceFile);
        storagePath = `${publicToken}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from(QUOTE_IMAGES_BUCKET)
          .upload(storagePath, compressed.file, {
            cacheControl: "3600",
            contentType: compressed.file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error("Upload failed. Check your connection and try again.");
        }

        const { data: photo, error: metadataError } = await supabase
          .from("quote_photos")
          .insert({
            quote_id: quoteId,
            storage_path: storagePath,
            phase,
            mime_type: "image/webp",
            size_bytes: compressed.file.size,
            width: compressed.width,
            height: compressed.height,
          })
          .select("id, phase, storage_path, width, height, position")
          .single();

        if (metadataError || !photo) {
          await supabase.storage.from(QUOTE_IMAGES_BUCKET).remove([storagePath]);
          throw new Error(
            metadataError?.message.includes("at most 10")
              ? "This quote already has the maximum of 10 photos."
              : "The photo could not be attached to this quote.",
          );
        }

        const { data: signedPhoto, error: signedUrlError } = await supabase.storage
          .from(QUOTE_IMAGES_BUCKET)
          .createSignedUrl(storagePath, SIGNED_PHOTO_URL_TTL_SECONDS);

        if (signedUrlError || !signedPhoto?.signedUrl) {
          throw new Error("The photo was saved but its preview could not be loaded.");
        }

        setPhotos((current) => [
          ...current,
          {
            id: photo.id,
            phase: photo.phase,
            storagePath: photo.storage_path,
            width: photo.width,
            height: photo.height,
            position: photo.position,
            signedUrl: signedPhoto.signedUrl,
          },
        ]);
      } catch (uploadError) {
        const message =
          uploadError instanceof PhotoValidationError ||
          uploadError instanceof Error
            ? uploadError.message
            : "The photo could not be uploaded.";
        failures.push(`${sourceFile.name}: ${message}`);
      }
    }

    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
    setProgress("");
    setError(failures.join(" "));
    router.refresh();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await uploadFiles(Array.from(event.target.files ?? []));
  }

  async function deletePhoto(photo: QuotePhotoView) {
    setDeletingId(photo.id);
    setError("");
    const supabase = createClient();
    const { error: metadataError } = await supabase
      .from("quote_photos")
      .delete()
      .eq("id", photo.id);

    if (metadataError) {
      setError("The photo could not be deleted. Please try again.");
      setDeletingId(null);
      return;
    }

    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    const { error: storageError } = await supabase.storage
      .from(QUOTE_IMAGES_BUCKET)
      .remove([photo.storagePath]);

    if (storageError) {
      setError("The photo was removed from the quote, but storage cleanup failed.");
    }

    setDeletingId(null);
    router.refresh();
  }

  return (
    <section aria-labelledby="job-photos-heading">
      <div className="flex flex-col gap-4 border-b border-zinc-200 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <Camera aria-hidden="true" size={20} className="text-brand-700" />
            <h2 id="job-photos-heading" className="font-semibold text-zinc-950">
              Job photos
            </h2>
          </div>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-zinc-600">
            Add up to 10 before and after photos. Images are resized and
            compressed in your browser before upload.
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm text-zinc-500">
          {photos.length}/{MAX_QUOTE_PHOTOS}
        </span>
      </div>

      <div className="border-b border-zinc-200 bg-zinc-50 p-4 sm:p-6">
        <fieldset>
          <legend className="text-sm font-semibold text-zinc-900">
            Photo type
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {phaseOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={phase === option.value}
                onClick={() => setPhase(option.value)}
                disabled={uploading}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 disabled:opacity-55",
                  phase === option.value
                    ? "border-brand-700 bg-brand-50"
                    : "border-zinc-300 bg-white hover:border-zinc-400",
                )}
              >
                <span className="block text-sm font-semibold text-zinc-950">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            id="quote-photo-input"
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={uploading || remaining === 0}
            className="sr-only"
          />
          <label
            htmlFor="quote-photo-input"
            className={buttonStyles({
              variant: "primary",
              className: cn(
                "w-full cursor-pointer sm:w-auto",
                (uploading || remaining === 0) &&
                  "pointer-events-none opacity-55",
              ),
            })}
          >
            <UploadSimple aria-hidden="true" size={18} weight="bold" />
            {uploading ? "Processing photos..." : "Choose photos"}
          </label>
          <p className="text-xs leading-5 text-zinc-500">
            JPG, PNG, or WebP. Maximum 2MB after compression.
          </p>
        </div>

        <div aria-live="polite">
          {progress && <p className="mt-3 text-sm text-brand-800">{progress}</p>}
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {photos.length === 0 ? (
          <p className="border-l-2 border-zinc-200 pl-3 text-sm text-zinc-500">
            No photos yet. Add evidence of the job before or after the work.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[...photos]
              .sort((left, right) => left.position - right.position)
              .map((photo) => (
                <article
                  key={photo.id}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
                >
                  <Image
                    src={photo.signedUrl}
                    alt={`${photo.phase === "before" ? "Before" : "After"} work photo`}
                    fill
                    sizes="(max-width: 640px) 50vw, 240px"
                    className="object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-md bg-zinc-950/80 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {photo.phase === "before" ? "Before" : "After"}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="danger"
                    onClick={() => deletePhoto(photo)}
                    disabled={deletingId === photo.id || uploading}
                    aria-label={`Delete ${photo.phase} photo`}
                    className="absolute bottom-2 right-2 size-9"
                  >
                    <Trash aria-hidden="true" size={17} weight="bold" />
                  </Button>
                </article>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
