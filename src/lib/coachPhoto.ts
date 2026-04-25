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
