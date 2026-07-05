import { useEffect } from "react";

/**
 * Injects the Adsterra Popunder script for as long as the calling page
 * is mounted. Passive site monetization only — not tied to the
 * ad-watch reward system, doesn't pay users or count toward their
 * daily ad quota. Intended only for the home/landing, sign-in, and
 * sign-up pages (the highest-traffic, pre-login pages).
 */
export function usePopunderAd() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://pl30196373.effectivecpmnetwork.com/3b/fe/10/3bfe100f92e01abb1c430124b9c6616e.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);
}
