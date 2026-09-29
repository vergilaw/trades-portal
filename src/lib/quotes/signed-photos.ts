import {
  QUOTE_IMAGES_BUCKET,
  SIGNED_PHOTO_URL_TTL_SECONDS,
  type QuotePhotoView,
} from "@/lib/quotes/photos";
import { createClient } from "@/lib/supabase/server";
import type { QuotePhotoPhase } from "@/types";

type PhotoMetadata = {
  id: string;
  phase: QuotePhotoPhase;
  storagePath: string;
  width: number;
  height: number;
  position: number;
};

export async function createSignedPhotoViews(
  photos: PhotoMetadata[],
): Promise<QuotePhotoView[]> {
  if (photos.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(QUOTE_IMAGES_BUCKET)
    .createSignedUrls(
      photos.map((photo) => photo.storagePath),
      SIGNED_PHOTO_URL_TTL_SECONDS,
    );

  if (error || !data) return [];

  const urlsByPath = new Map(
    data.flatMap((item) =>
      item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );

  return photos.flatMap((photo) => {
    const signedUrl = urlsByPath.get(photo.storagePath);
    return signedUrl ? [{ ...photo, signedUrl }] : [];
  });
}
