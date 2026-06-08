import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { gallery, website } from "@/lib/api";

export default function GalleryAlbumPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [albumRes, homeRes]: any = await Promise.all([
          gallery.getPublicById(id as string),
          website.getHome().catch(() => null),
        ]);
        if (!mounted) return;
        setAlbum(albumRes?.data || null);
        setSettings(homeRes?.data?.settings || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader donateLink={settings?.donation?.paymentLink} />
      <div className="container mx-auto px-4 py-10">
        <Button variant="ghost" className="mb-4" onClick={() => navigate("/#gallery")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Gallery
        </Button>
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !album ? (
          <p className="py-20 text-center text-muted-foreground">Album not found.</p>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{album.title}</h1>
            {album.description && <p className="mt-2 max-w-2xl text-muted-foreground">{album.description}</p>}
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {(album.images || []).map((img: any) => (
                <button key={img._id} onClick={() => setLightbox(img.imageUrl)}
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-muted">
                  <img src={img.imageUrl} alt={img.caption || album.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <SiteFooter settings={settings} />

      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white"><X className="h-6 w-6" /></button>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
