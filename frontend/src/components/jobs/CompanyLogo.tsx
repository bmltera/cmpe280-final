'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  company: string;
  size?: number;
  className?: string;
}

const TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

function Monogram({
  company,
  size,
  className,
}: {
  company: string;
  size: number;
  className?: string;
}) {
  const initial = (company?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground',
        className
      )}
      style={{ width: size, height: size }}
      aria-label={`${company || 'Company'} logo placeholder`}
    >
      {initial}
    </div>
  );
}

export function CompanyLogo({ company, size = 40, className }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [company]);

  if (!TOKEN || !company?.trim()) {
    return <Monogram company={company || '?'} size={size} className={className} />;
  }

  if (failed) {
    return <Monogram company={company} size={size} className={className} />;
  }

  const url = `https://img.logo.dev/name/${encodeURIComponent(company.trim())}?token=${TOKEN}&size=${size * 2}&format=png&retina=true`;

  return (
    <img
      src={url}
      alt={`${company} logo`}
      width={size}
      height={size}
      loading="lazy"
      className={cn(
        'shrink-0 rounded-lg bg-white object-contain ring-1 ring-border/40',
        className
      )}
      onError={() => setFailed(true)}
    />
  );
}
