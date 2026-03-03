import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./themes/blue-theme.css";
import "./themes/purple-theme.css";
import "./themes/green-theme.css";

const apiUrl = (import.meta.env.VITE_API_URL || "").trim();
const normalizedApiBase = apiUrl.replace(/\/$/, "");
const franchiseSlug = (import.meta.env.VITE_FRANCHISE_SLUG || "people").toLowerCase().trim();

const faviconBySlug: Record<string, string> = {
	bz: `${normalizedApiBase}/assets/logo-baithuzzakath.png`,
	people: `${normalizedApiBase}/assets/logo-peoplefoundation.png`,
};

const fallbackFavicon = "/favicon.ico";
const faviconHref = faviconBySlug[franchiseSlug] || fallbackFavicon;

const setFavicon = (selector: string) => {
	const link = document.querySelector(selector) as HTMLLinkElement | null;
	if (link) {
		link.href = faviconHref;
	}
};

setFavicon("link[rel='icon']");
setFavicon("link[rel='shortcut icon']");
setFavicon("link[rel='apple-touch-icon']");

createRoot(document.getElementById("root")!).render(<App />);
