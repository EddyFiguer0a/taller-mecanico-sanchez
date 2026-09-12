import { useState } from 'react';
import { resolveBrandLogo } from '../data/mockData';

/**
 * BrandLogo — renders a car manufacturer logo from /logos/{brand}.svg
 * Falls back to a branded initial badge if the image fails to load.
 *
 * Props:
 *   make  {string}  — Brand name, e.g. "Toyota", "Mercedes Benz"
 *   size  {'sm'|'md'|'lg'} — Display size
 *   light {boolean} — Use light background (for dark card backgrounds)
 */
export default function BrandLogo({ make, size = 'md', light = false }) {
  const [failed, setFailed] = useState(false);

  const initial = make ? make.charAt(0).toUpperCase() : '?';
  const logoPath = resolveBrandLogo(make);

  const dimensionMap = {
    sm: { container: 'w-8 h-8',   img: 'w-7 h-7',   text: 'text-xs' },
    md: { container: 'w-10 h-10', img: 'w-9 h-9',   text: 'text-sm' },
    lg: { container: 'w-full h-full', img: 'max-w-full max-h-full', text: 'text-lg' },
  };

  const dim = dimensionMap[size] || dimensionMap.md;

  if (!make || !logoPath || failed) {
    return (
      <div
        className={`${dim.container} flex items-center justify-center rounded-xl font-black ${dim.text} select-none`}
        style={{ background: light ? '#1e293b' : '#334155', color: '#94a3b8' }}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={logoPath}
      alt={make}
      className="w-full h-full object-contain"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
