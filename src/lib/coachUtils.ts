import type { ProgramType } from './types';

/**
 * Returns the coach's photo URL if available, otherwise generates an SVG initials data URI.
 * Replaces picsum.photos fallbacks which show random stock photos.
 */
export function getCoachPhotoUrl(
  photoUrl: string | null | undefined,
  coachName: string,
  size: number = 200
): string {
  if (photoUrl) return photoUrl;

  const initials = coachName
    .split(' ')
    .map(part => part[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#DBEAFE"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="${Math.round(size * 0.35)}" fill="#3B82F6">${initials}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Maps raw program type to a display-friendly name.
 */
export function getProgramDisplayName(programType: ProgramType | string | null | undefined): string {
  switch (programType) {
    case 'SCALE': return 'Scale';
    case 'GROW': return 'Grow';
    case 'EXEC': return 'Executive Coaching';
    default: return 'coaching';
  }
}
