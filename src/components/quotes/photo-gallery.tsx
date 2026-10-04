import Image from "next/image";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";

import type { QuotePhotoView } from "@/lib/quotes/photos";
import type { QuotePhotoPhase } from "@/types";

type PhotoGalleryProps = {
  photos: QuotePhotoView[];
  emptyMessage?: string;
};

const sections: Array<{ phase: QuotePhotoPhase; label: string }> = [
  { phase: "before", label: "Before" },
  { phase: "after", label: "After" },
];

export async function PhotoGallery({
  photos,
  emptyMessage = "No job photos have been added.",
}: PhotoGalleryProps) {
  const locale = await getLocale();
  if (photos.length === 0) {
    return (
      <p className="border-l-2 border-zinc-200 pl-3 text-sm text-zinc-500">
        {translate(emptyMessage, locale)}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {sections.map(({ phase, label }) => {
        const phasePhotos = photos.filter((photo) => photo.phase === phase);
        if (phasePhotos.length === 0) return null;

        return (
          <section key={phase} aria-labelledby={`photo-group-${phase}`}>
            <div className="mb-2.5 flex items-center gap-2">
              <h3
                id={`photo-group-${phase}`}
                className="text-sm font-semibold text-zinc-900"
              >
                {translate(label, locale)}
              </h3>
              <span className="text-xs tabular-nums text-zinc-500">
                {phasePhotos.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {phasePhotos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                >
                  <Image
                    src={photo.signedUrl}
                    alt={translate("{phase} work photo", locale, {
                      phase: translate(label, locale),
                    })}
                    fill
                    sizes="(max-width: 640px) 50vw, 220px"
                    className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
