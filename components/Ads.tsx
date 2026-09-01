import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const adsVariants = cva(
  "flex items-center justify-center rounded-lg border border-dashed border-border/60 bg-subtle/40 text-subtle-foreground text-center",
  {
    variants: {
      variant: {
        rail: "w-full h-[250px]",
        bottom: "w-full h-14 sm:h-16",
      },
    },
    defaultVariants: { variant: "bottom" },
  },
);

// Container classes for status="live" ad slots — a real ad network's markup
// will render inside this box, so it gets a subtle card-like frame (rounded
// corners, faint border, low-contrast background) consistent with the rest
// of the shell instead of the dashed placeholder look, while keeping the
// exact same sizing as the placeholder variant so layout never shifts.
const liveAdContainer =
  "overflow-hidden rounded-lg border border-border/50 bg-card/40 shadow-sm";

export interface AdsProps extends VariantProps<typeof adsVariants> {
  status?: "placeholder" | "live";
  className?: string;
}

const AD_LABEL = {
  rail: "Sidebar advertisement space",
  bottom: "Footer advertisement space",
} as const;

export function Ads({ variant = "bottom", status = "placeholder", className }: AdsProps) {
  const v = variant ?? "bottom";

  // No ad network is wired up yet — render nothing rather than a fake
  // placeholder box, so visitors never see empty "Advertisement" chrome.
  // Once a real ad network is integrated, pass status="live" and put the
  // actual ad unit's markup where this div is (keep the same size classes
  // via adsVariants so layout doesn't shift).
  if (status !== "live") {
    return null;
  }

  return (
    <div
      className={cn(adsVariants({ variant: v }), liveAdContainer, className)}
      aria-label={AD_LABEL[v]}
      data-ad-status="live"
      data-ad-slot={v}
    />
  );
}
