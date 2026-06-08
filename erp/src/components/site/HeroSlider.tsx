import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Banner {
  _id: string;
  title?: string;
  description?: string;
  imageUrl: string;
  link?: string;
}

interface HeroSliderProps {
  banners: Banner[];
  hero?: {
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    secondaryCtaText?: string;
    secondaryCtaLink?: string;
  };
}

export function HeroSlider({ banners, hero }: HeroSliderProps) {
  const [index, setIndex] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count]);

  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);

  const open = (link?: string) => {
    if (!link) return;
    if (link.startsWith("http")) window.open(link, "_blank");
    else window.location.assign(link);
  };

  return (
    <section className="relative h-[70vh] min-h-[460px] w-full overflow-hidden bg-gradient-hero">
      {/* Slides */}
      {banners.map((b, i) => (
        <div
          key={b._id}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
        >
          <img src={b.imageUrl} alt={b.title || "banner"} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </div>
      ))}

      {/* Overlay content */}
      <div className="container relative z-10 mx-auto flex h-full flex-col justify-center px-4">
        <div className="max-w-2xl space-y-5 text-white animate-in fade-in slide-in-from-bottom-6 duration-700">
          <h1 className="text-3xl font-extrabold leading-tight drop-shadow md:text-5xl lg:text-6xl">
            {hero?.title || banners[index]?.title}
          </h1>
          <p className="text-base text-white/90 drop-shadow md:text-xl">
            {hero?.subtitle || banners[index]?.description}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {hero?.ctaText && (
              <Button size="lg" className="rounded-full shadow-glow" onClick={() => open(hero.ctaLink)}>
                {hero.ctaText}
              </Button>
            )}
            {hero?.secondaryCtaText && (
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/60 bg-white/10 text-white hover:bg-white hover:text-foreground"
                onClick={() => open(hero.secondaryCtaLink)}
              >
                {hero.secondaryCtaText}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      {count > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur transition hover:bg-white/40"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur transition hover:bg-white/40"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-2 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
