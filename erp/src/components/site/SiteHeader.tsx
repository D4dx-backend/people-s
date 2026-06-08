import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/contexts/ConfigContext";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import defaultLogo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/#about" },
  { label: "Projects", to: "/#projects" },
  { label: "News", to: "/#news" },
  { label: "Gallery", to: "/#gallery" },
  { label: "Videos", to: "/#videos" },
  { label: "FAQ", to: "/#faq" },
  { label: "Contact", to: "/#contact" },
];

interface SiteHeaderProps {
  donateLink?: string;
}

export function SiteHeader({ donateLink }: SiteHeaderProps) {
  const { org } = useConfig();
  const orgLogoUrl = useOrgLogoUrl();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleNav = (to: string) => {
    setOpen(false);
    if (to.startsWith("/#")) {
      const id = to.slice(2);
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 100);
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(to);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 shadow-sm backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <button onClick={() => handleNav("/")} className="flex items-center gap-3">
          <img
            src={orgLogoUrl}
            alt={org.erpTitle}
            className="h-11 w-11 rounded-2xl shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }}
          />
          <div className="text-left">
            <h1 className="text-base font-bold leading-tight md:text-lg">{org.displayName || org.erpTitle}</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">{org.tagline}</p>
          </div>
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <button
              key={l.to}
              onClick={() => handleNav(l.to)}
              className="rounded-full px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {donateLink && (
            <Button
              className="hidden rounded-full shadow-glow sm:inline-flex"
              onClick={() => window.open(donateLink, "_blank")}
            >
              <Heart className="mr-1 h-4 w-4" /> Donate
            </Button>
          )}
          <Button variant="outline" className="rounded-full" onClick={() => navigate("/login")}>
            Login
          </Button>
          <button
            className="rounded-full p-2 hover:bg-muted lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={cn("lg:hidden", open ? "block" : "hidden")}>
        <nav className="container mx-auto flex flex-col gap-1 px-4 pb-4">
          {NAV_LINKS.map((l) => (
            <button
              key={l.to}
              onClick={() => handleNav(l.to)}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground/80 hover:bg-muted"
            >
              {l.label}
            </button>
          ))}
          {donateLink && (
            <Button className="mt-2 rounded-full" onClick={() => window.open(donateLink, "_blank")}>
              <Heart className="mr-1 h-4 w-4" /> Donate
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
