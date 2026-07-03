import type { SVGProps } from "react";

/**
 * EarnOmni "E" mark — designed to sit inside the app's existing gradient
 * badge boxes (bg-[image:var(--gradient-hero)]), matching how the old
 * Sparkles icon was used. Color comes from currentColor / className.
 * Placeholder design — swap freely once final branding is ready.
 */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="5" y="4" width="3.4" height="16" rx="1.4" />
      <rect x="5" y="4" width="9.5" height="3.6" rx="1.4" />
      <rect x="5" y="10.2" width="7.6" height="3.6" rx="1.4" />
      <rect x="5" y="16.4" width="9.5" height="3.6" rx="1.4" />
    </svg>
  );
}
