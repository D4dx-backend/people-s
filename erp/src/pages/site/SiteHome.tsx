import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart, Users, GraduationCap, Home as HomeIcon, Briefcase, Stethoscope, HandHeart,
  ArrowRight, Download, Play, Quote, FileText, ChevronRight, Sparkles, Target, Eye, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useConfig } from "@/contexts/ConfigContext";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { HeroSlider } from "@/components/site/HeroSlider";
import { useSiteData, getYouTubeId, videoThumb } from "@/hooks/useSiteData";
import { contactMessages, volunteers } from "@/lib/api";

const ICONS: Record<string, any> = {
  users: Users, heart: Heart, education: GraduationCap, graduation: GraduationCap,
  home: HomeIcon, housing: HomeIcon, briefcase: Briefcase, livelihood: Briefcase,
  health: Stethoscope, healthcare: Stethoscope, hands: HandHeart, target: Target, eye: Eye,
};
const iconFor = (name?: string) => ICONS[(name || "").toLowerCase()] || Sparkles;

// Project category images mapping (matches admin panel)
const CATEGORY_IMAGES: Record<string, string> = {
  education: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
  healthcare: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
  housing: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
  livelihood: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
  emergency_relief: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80",
  infrastructure: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80",
  social_welfare: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
  other: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80",
};
const categoryImage = (category?: string) => CATEGORY_IMAGES[category || "other"] || CATEGORY_IMAGES.other;

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow && (
        <span className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </span>
      )}
      <h2 className="text-2xl font-bold md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export default function SiteHome() {
  const navigate = useNavigate();
  const { org } = useConfig();
  const { toast } = useToast();
  const { data, isLoading } = useSiteData();
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const s = data?.settings || {};
  const banners = data?.banners || [];
  const counts = s.counts || [];
  const values = s.values || [];
  const projects = data?.projects || [];
  const schemes = data?.schemes || [];
  const news = data?.news || [];
  const blogs = data?.blogs || [];
  const gallery = data?.gallery || [];
  const videos = data?.videos || [];
  const partners = data?.partners || [];
  const brochures = data?.brochures || [];
  const faqs = data?.faqs || [];
  const mediaItems = data?.media || [];
  const donation = s.donation || {};
  const donateLink = donation.paymentLink || s.hero?.ctaLink;

  // ── Contact form ──────────────────────────────────────────────────────────
  const [contact, setContact] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.name || !contact.message || (!contact.email && !contact.phone)) {
      toast({ title: "Please fill required fields", description: "Name, message and an email or phone are required.", variant: "destructive" });
      return;
    }
    setContactSubmitting(true);
    try {
      await contactMessages.submit(contact);
      toast({ title: "Message sent", description: "Thank you! We will get back to you soon." });
      setContact({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch {
      toast({ title: "Failed to send", description: "Please try again later.", variant: "destructive" });
    } finally {
      setContactSubmitting(false);
    }
  };

  // ── Volunteer form ────────────────────────────────────────────────────────
  const [vol, setVol] = useState({ name: "", phone: "", email: "", area: "", message: "" });
  const [volSubmitting, setVolSubmitting] = useState(false);
  const submitVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vol.name || !vol.phone) {
      toast({ title: "Please fill required fields", description: "Name and phone are required.", variant: "destructive" });
      return;
    }
    setVolSubmitting(true);
    try {
      await volunteers.submit(vol);
      toast({ title: "Thank you for volunteering!", description: "We will contact you soon." });
      setVol({ name: "", phone: "", email: "", area: "", message: "" });
    } catch {
      toast({ title: "Failed to submit", description: "Please try again later.", variant: "destructive" });
    } finally {
      setVolSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader donateLink={donateLink} />

      {/* HERO */}
      {banners.length > 0 ? (
        <HeroSlider banners={banners} hero={s.hero} />
      ) : (
        <section className="relative overflow-hidden bg-gradient-hero py-24 text-center text-primary-foreground">
          <div className="container mx-auto px-4">
            <h1 className="mx-auto max-w-3xl text-3xl font-extrabold md:text-5xl">
              {s.hero?.title || org.displayName || org.erpTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/90">
              {s.hero?.subtitle || org.tagline}
            </p>
            {donateLink && (
              <Button size="lg" className="mt-8 rounded-full shadow-glow" onClick={() => window.open(donateLink, "_blank")}>
                <Heart className="mr-2 h-4 w-4" /> Donate Now
              </Button>
            )}
          </div>
        </section>
      )}

      {/* IMPACT COUNTERS */}
      {counts.length > 0 && (
        <section className="border-b border-border/40 bg-card py-12">
          <div className="container mx-auto grid grid-cols-2 gap-6 px-4 md:grid-cols-4">
            {counts.map((c, i) => {
              const Icon = iconFor(c.icon);
              return (
                <div key={c._id || i} className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-3xl font-extrabold text-foreground md:text-4xl">{c.count.toLocaleString()}+</div>
                  <div className="mt-1 text-sm text-muted-foreground">{c.title}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ABOUT + VISION / MISSION */}
      <section id="about" className="scroll-mt-20 py-20">
        <div className="container mx-auto grid items-center gap-12 px-4 lg:grid-cols-2">
          <div className="space-y-5">
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              About Us
            </span>
            <h2 className="text-3xl font-bold md:text-4xl">{s.aboutUs?.title || `About ${org.displayName || org.erpTitle}`}</h2>
            <p className="leading-relaxed text-muted-foreground">{s.aboutUs?.description || org.aboutText || org.tagline}</p>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              {s.vision?.description && (
                <Card className="border-border/60">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Eye className="h-5 w-5" /></div>
                    <h3 className="font-semibold">{s.vision?.title || "Our Vision"}</h3>
                    <p className="text-sm text-muted-foreground">{s.vision.description}</p>
                  </CardContent>
                </Card>
              )}
              {s.mission?.description && (
                <Card className="border-border/60">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="h-5 w-5" /></div>
                    <h3 className="font-semibold">{s.mission?.title || "Our Mission"}</h3>
                    <p className="text-sm text-muted-foreground">{s.mission.description}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          <div className="relative">
            {s.aboutUs?.imageUrl ? (
              <img src={s.aboutUs.imageUrl} alt="about" className="w-full rounded-3xl object-cover shadow-xl" />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-3xl bg-gradient-hero">
                <HandHeart className="h-24 w-24 text-primary-foreground/70" />
              </div>
            )}
          </div>
        </div>

        {/* Values */}
        {values.length > 0 && (
          <div className="container mx-auto mt-16 grid gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => {
              const Icon = iconFor(v.icon);
              return (
                <Card key={i} className="border-border/60 transition-shadow hover:shadow-lg">
                  <CardContent className="space-y-3 p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                    <h3 className="font-semibold">{v.title}</h3>
                    <p className="text-sm text-muted-foreground">{v.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* PROJECTS */}
      {projects.length > 0 && (
        <section id="projects" className="scroll-mt-20 bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <SectionHeading eyebrow="What we do" title="Our Projects" subtitle="Initiatives transforming lives in our communities." />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Card key={p._id} className="group overflow-hidden border-border/60 transition-shadow hover:shadow-xl">
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={categoryImage(p.category)}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                  <CardContent className="space-y-2 p-6">
                    {p.category && <Badge variant="secondary" className="capitalize">{p.category.replace(/_/g, " ")}</Badge>}
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SCHEMES */}
      {schemes.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <SectionHeading eyebrow="Support programs" title="Schemes & Programs" subtitle="Programs you or your community can apply for." />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {schemes.map((sc) => (
                <Card key={sc._id} className="border-border/60 transition-shadow hover:shadow-lg">
                  <CardContent className="space-y-2 p-6">
                    {sc.category && <Badge variant="secondary" className="capitalize">{sc.category.replace(/_/g, " ")}</Badge>}
                    <h3 className="text-lg font-semibold">{sc.name || sc.title}</h3>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{sc.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button variant="outline" className="rounded-full" onClick={() => navigate("/public-schemes")}>
                View all schemes <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* NEWS & EVENTS */}
      {news.length > 0 && (
        <section id="news" className="scroll-mt-20 bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <SectionHeading eyebrow="Updates" title="News & Events" subtitle="Latest happenings and announcements." />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {news.map((n) => (
                <Card key={n._id} className="group overflow-hidden border-border/60 transition-shadow hover:shadow-xl">
                  {n.imageUrl ? (
                    <img src={n.imageUrl} alt={n.title} className="h-44 w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-gradient-hero"><Sparkles className="h-12 w-12 text-primary-foreground/70" /></div>
                  )}
                  <CardContent className="space-y-2 p-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {n.category && <Badge variant="outline" className="capitalize">{n.category.replace(/_/g, " ")}</Badge>}
                      {n.publishDate && <span>{new Date(n.publishDate).toLocaleDateString()}</span>}
                    </div>
                    <h3 className="text-lg font-semibold">{n.title}</h3>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{n.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section id="gallery" className="scroll-mt-20 py-20">
          <div className="container mx-auto px-4">
            <SectionHeading eyebrow="Moments" title="Gallery" subtitle="Glimpses from our work on the ground." />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {gallery.map((a) => (
                <button
                  key={a._id}
                  onClick={() => navigate(`/gallery/${a._id}`)}
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-muted"
                >
                  {a.coverImageUrl ? (
                    <img src={a.coverImageUrl} alt={a.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-hero"><Sparkles className="h-10 w-10 text-primary-foreground/70" /></div>
                  )}
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-sm font-medium text-white">{a.title}{a.imageCount ? ` · ${a.imageCount}` : ""}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VIDEOS */}
      {videos.length > 0 && (
        <section id="videos" className="scroll-mt-20 bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <SectionHeading eyebrow="Watch" title="Videos" subtitle="Stories of change in motion." />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <button
                  key={v._id}
                  onClick={() => setActiveVideo(v.videoUrl)}
                  className="group overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition-shadow hover:shadow-xl"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-muted">
                    {videoThumb(v.videoUrl, v.thumbnailUrl) ? (
                      <img src={videoThumb(v.videoUrl, v.thumbnailUrl)} alt={v.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-hero" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition-transform group-hover:scale-110">
                        <Play className="h-6 w-6 translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 p-5">
                    <h3 className="font-semibold">{v.title}</h3>
                    {v.description && <p className="line-clamp-2 text-sm text-muted-foreground">{v.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BLOGS */}
      {blogs.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <SectionHeading eyebrow="Read" title="From our Blog" subtitle="Perspectives, insights and stories." />
            <div className="grid gap-6 md:grid-cols-3">
              {blogs.map((b) => (
                <Card key={b._id} className="group cursor-pointer overflow-hidden border-border/60 transition-shadow hover:shadow-xl" onClick={() => navigate(`/blog/${b.slug}`)}>
                  {b.coverImageUrl ? (
                    <img src={b.coverImageUrl} alt={b.title} className="h-44 w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-gradient-hero"><Quote className="h-12 w-12 text-primary-foreground/70" /></div>
                  )}
                  <CardContent className="space-y-2 p-6">
                    <div className="text-xs text-muted-foreground">{b.author}{b.publishDate ? ` · ${new Date(b.publishDate).toLocaleDateString()}` : ""}</div>
                    <h3 className="text-lg font-semibold">{b.title}</h3>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{b.excerpt}</p>
                    <span className="inline-flex items-center text-sm font-medium text-primary">Read more <ChevronRight className="h-4 w-4" /></span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* RESOURCES / BROCHURES */}
      {brochures.length > 0 && (
        <section className="bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <SectionHeading eyebrow="Downloads" title="Reports & Publications" subtitle="Download our reports, brochures and guidelines." />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {brochures.map((br) => (
                <a key={br._id} href={br.fileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-shadow hover:shadow-lg">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-6 w-6" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{br.title}</h3>
                    {br.description && <p className="line-clamp-1 text-sm text-muted-foreground">{br.description}</p>}
                  </div>
                  <Download className="h-5 w-5 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MEDIA COVERAGE */}
      {mediaItems.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <SectionHeading eyebrow="In the news" title="Media Coverage" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {mediaItems.map((m) => (
                <a key={m._id} href={m.link || "#"} target="_blank" rel="noreferrer"
                  className="group overflow-hidden rounded-2xl border border-border/60 bg-card transition-shadow hover:shadow-lg">
                  {m.imageUrl && <img src={m.imageUrl} alt={m.title} className="h-36 w-full object-cover" />}
                  <div className="space-y-1 p-4">
                    {m.source && <span className="text-xs font-medium uppercase tracking-wide text-primary">{m.source}</span>}
                    <h3 className="line-clamp-2 text-sm font-semibold">{m.title}</h3>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DONATION */}
      {donation.enabled && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground md:p-12">
              <div className="grid items-center gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold md:text-4xl">{donation.heading || "Support Our Mission"}</h2>
                  <p className="text-primary-foreground/90">{donation.description}</p>
                  {donation.paymentLink && (
                    <Button size="lg" variant="secondary" className="rounded-full" onClick={() => window.open(donation.paymentLink, "_blank")}>
                      <Heart className="mr-2 h-4 w-4" /> Donate Now
                    </Button>
                  )}
                </div>
                <Card className="border-none">
                  <CardContent className="grid gap-3 p-6 text-sm text-foreground">
                    {donation.accountName && <Row label="Account Name" value={donation.accountName} />}
                    {donation.accountNumber && <Row label="Account No." value={donation.accountNumber} />}
                    {donation.bankName && <Row label="Bank" value={donation.bankName} />}
                    {donation.ifsc && <Row label="IFSC" value={donation.ifsc} />}
                    {donation.upiId && <Row label="UPI ID" value={donation.upiId} />}
                    {donation.qrImageUrl && <img src={donation.qrImageUrl} alt="Donation QR" className="mx-auto mt-2 h-40 w-40 rounded-xl object-contain" />}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PARTNERS */}
      {partners.length > 0 && (
        <section className="border-y border-border/40 bg-muted/30 py-14">
          <div className="container mx-auto px-4">
            <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">Our Associates & Partners</p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {partners.map((p) => (
                p.logoUrl ? (
                  <a key={p._id} href={p.link || "#"} target="_blank" rel="noreferrer" className="grayscale transition hover:grayscale-0">
                    <img src={p.logoUrl} alt={p.name} className="h-12 w-auto object-contain" />
                  </a>
                ) : (
                  <span key={p._id} className="text-sm font-medium text-muted-foreground">{p.name}</span>
                )
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section id="faq" className="scroll-mt-20 py-20">
          <div className="container mx-auto max-w-3xl px-4">
            <SectionHeading eyebrow="Help" title="Frequently Asked Questions" />
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f) => (
                <AccordionItem key={f._id} value={f._id}>
                  <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* CONTACT + VOLUNTEER */}
      <section id="contact" className="scroll-mt-20 bg-muted/30 py-20">
        <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Reach out" title="Contact Us" subtitle="We'd love to hear from you." />
            <form onSubmit={submitContact} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input placeholder="Your name *" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                <Input placeholder="Phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input type="email" placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                <Input placeholder="Subject" value={contact.subject} onChange={(e) => setContact({ ...contact, subject: e.target.value })} />
              </div>
              <Textarea placeholder="Your message *" rows={5} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} />
              <Button type="submit" disabled={contactSubmitting} className="rounded-full">
                {contactSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Message
              </Button>
            </form>
          </div>
          <div>
            <SectionHeading eyebrow="Get involved" title="Become a Volunteer" subtitle="Join hands and make a difference." />
            <form onSubmit={submitVolunteer} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input placeholder="Your name *" value={vol.name} onChange={(e) => setVol({ ...vol, name: e.target.value })} />
                <Input placeholder="Phone *" value={vol.phone} onChange={(e) => setVol({ ...vol, phone: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input type="email" placeholder="Email" value={vol.email} onChange={(e) => setVol({ ...vol, email: e.target.value })} />
                <Input placeholder="Area / Location" value={vol.area} onChange={(e) => setVol({ ...vol, area: e.target.value })} />
              </div>
              <Textarea placeholder="How would you like to help?" rows={5} value={vol.message} onChange={(e) => setVol({ ...vol, message: e.target.value })} />
              <Button type="submit" disabled={volSubmitting} className="rounded-full">
                {volSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} <HandHeart className="mr-1 h-4 w-4" /> Join as Volunteer
              </Button>
            </form>
          </div>
        </div>
      </section>

      <SiteFooter settings={s} />

      {/* Video lightbox */}
      <Dialog open={!!activeVideo} onOpenChange={(o) => !o && setActiveVideo(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          {activeVideo && (
            getYouTubeId(activeVideo) ? (
              <div className="aspect-video w-full">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${getYouTubeId(activeVideo)}?autoplay=1`}
                  title="Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <video src={activeVideo} controls autoPlay className="aspect-video w-full" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
