import { Facebook, Instagram, Youtube, Twitter, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useConfig } from "@/contexts/ConfigContext";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import defaultLogo from "@/assets/logo.png";
import type { SiteSettings } from "@/hooks/useSiteData";

interface SiteFooterProps {
  settings?: SiteSettings;
}

export function SiteFooter({ settings }: SiteFooterProps) {
  const { org } = useConfig();
  const orgLogoUrl = useOrgLogoUrl();
  const contact = settings?.contactDetails || {};
  const social = settings?.socialMedia || {};
  const footer = settings?.footer || {};
  const year = new Date().getFullYear();

  const socials = [
    { url: social.facebook, Icon: Facebook, label: "Facebook" },
    { url: social.instagram, Icon: Instagram, label: "Instagram" },
    { url: social.youtube, Icon: Youtube, label: "YouTube" },
    { url: social.twitter, Icon: Twitter, label: "Twitter" },
    { url: social.linkedin, Icon: Linkedin, label: "LinkedIn" },
  ].filter((s) => s.url);

  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="container mx-auto grid gap-10 px-4 py-14 md:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={orgLogoUrl}
              alt={org.erpTitle}
              className="h-12 w-12 rounded-2xl"
              onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }}
            />
            <span className="text-lg font-bold">{org.displayName || org.erpTitle}</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {footer.description || org.aboutText || org.tagline}
          </p>
          {socials.length > 0 && (
            <div className="flex gap-2 pt-1">
              {socials.map(({ url, Icon, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-foreground/70 shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Explore</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              { label: "About Us", href: "/#about" },
              { label: "Projects", href: "/#projects" },
              { label: "News & Events", href: "/#news" },
              { label: "Gallery", href: "/#gallery" },
              { label: "FAQ", href: "/#faq" },
              { label: "Contact", href: "/#contact" },
            ].map((l) => (
              <li key={l.label}>
                <a href={l.href} className="transition-colors hover:text-primary">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Custom links */}
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Information</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(footer.links && footer.links.length > 0
              ? footer.links
              : [
                  { label: "Privacy Policy", url: "/privacy-policy" },
                  { label: "Terms & Conditions", url: "#" },
                ]
            ).map((l, i) => (
              <li key={i}>
                {l.url?.startsWith("/") ? (
                  <Link to={l.url} className="transition-colors hover:text-primary">{l.label}</Link>
                ) : (
                  <a href={l.url} className="transition-colors hover:text-primary">{l.label}</a>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Get in Touch</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {(contact.address || org.address) && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{contact.address || org.address}</span>
              </li>
            )}
            {(contact.phone || org.phone) && (
              <li className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a href={`tel:${contact.phone || org.phone}`} className="hover:text-primary">{contact.phone || org.phone}</a>
              </li>
            )}
            {(contact.email || org.email) && (
              <li className="flex gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a href={`mailto:${contact.email || org.email}`} className="hover:text-primary">{contact.email || org.email}</a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-border/40 py-5">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          {footer.copyrightText || `© ${year} ${org.displayName || org.erpTitle}. All rights reserved.`}
        </div>
      </div>
    </footer>
  );
}
