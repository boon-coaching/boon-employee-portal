// Boon's `coaches.photo_url` (and SF Contact.Profile_Photo_URL__c) for most
// coaches points to a 1920x1080 marketing slide — headshot is in the right
// ~32% of the image, with title/bio filling the left side.
//
// When we crop that to a 1:1 circular avatar with default `object-fit: cover`
// (centered), the face is cut off entirely and we render the coach's name
// text instead. Detect the slide URL pattern and bias the crop toward the
// face so the avatar shows the actual person.
//
// Real fix is upstream — Boon ops should swap `coaches.photo_url` to point
// to actual headshot crops. Until then this keeps the portal looking right.

const SLIDE_URL_PATTERNS = [
  /Boon%20Coach%20Profile_/i,
  /Boon Coach Profile_/i,
  /\/New%20Coach%20Profile%20Images\//i,
  /\/New Coach Profile Images\//i,
];

export function isCoachProfileSlideUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return SLIDE_URL_PATTERNS.some((pat) => pat.test(url));
}

// CSS object-position value for a coach avatar img. Use as an inline style
// (Tailwind arbitrary-value classes from a function return don't survive the
// JIT content scan).
//
//   <img style={{ objectPosition: coachAvatarObjectPosition(url) }} ... />
export function coachAvatarObjectPosition(url: string | null | undefined): string {
  if (isCoachProfileSlideUrl(url)) {
    // Face center sits at roughly (80%, 38%) of the 1920x1080 slide.
    return '85% 38%';
  }
  return 'center';
}

// Some coach photos in the GCS bucket are 4-6 MB originals (3024x4032
// portrait orientation off a phone). Rendered at 40-200px on screen, that's
// a 100x to 200x bandwidth waste — catastrophic on mobile.
//
// images.weserv.nl is a free Cloudflare-backed image proxy that does
// on-the-fly resize + WebP/AVIF encoding. Wrapping a 4.4 MB photo through
// it with w=400 returns ~20 KB.
//
// Pass the desired display *width* in CSS pixels. The proxy is requested at
// 2x for retina, capped at 800 (the largest practical render in the portal).
//
// HubSpot / Cloudinary URLs (already optimized) are passed through
// untouched — there's no benefit and an extra hop costs latency.
const PROXY_BYPASS_PATTERNS = [
  /res\.cloudinary\.com/i,
  /hubspotusercontent/i,
];

export function optimizeCoachPhoto(
  url: string | null | undefined,
  displayWidth: number
): string | null {
  if (!url) return null;
  if (PROXY_BYPASS_PATTERNS.some((pat) => pat.test(url))) return url;
  // Strip protocol — weserv accepts the rest
  const stripped = url.replace(/^https?:\/\//, '');
  const target = Math.min(800, Math.round(displayWidth * 2));
  // Reading slide-shaped images? object-position bias still applies;
  // the proxy returns a square-cropped image which we then position in CSS.
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${target}&h=${target}&fit=cover&output=webp&q=85`;
}
