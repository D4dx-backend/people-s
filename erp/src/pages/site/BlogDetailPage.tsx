import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { blogs, website } from "@/lib/api";

export default function BlogDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [blogRes, homeRes]: any = await Promise.all([
          blogs.getPublicBySlug(slug as string),
          website.getHome().catch(() => null),
        ]);
        if (!mounted) return;
        setBlog(blogRes?.data || null);
        setSettings(homeRes?.data?.settings || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader donateLink={settings?.donation?.paymentLink} />
      <article className="container mx-auto max-w-3xl px-4 py-10">
        <Button variant="ghost" className="mb-4" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !blog ? (
          <p className="py-20 text-center text-muted-foreground">Article not found.</p>
        ) : (
          <>
            {blog.category && <Badge variant="secondary" className="capitalize">{blog.category}</Badge>}
            <h1 className="mt-3 text-3xl font-bold md:text-4xl">{blog.title}</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              {blog.author}{blog.publishDate ? ` · ${new Date(blog.publishDate).toLocaleDateString()}` : ""}
            </div>
            {blog.coverImageUrl && <img src={blog.coverImageUrl} alt={blog.title} className="mt-6 w-full rounded-2xl object-cover" />}
            <div className="prose prose-neutral mt-8 max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90">
              {blog.content}
            </div>
          </>
        )}
      </article>
      <SiteFooter settings={settings} />
    </div>
  );
}
