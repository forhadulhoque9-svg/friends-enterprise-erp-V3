import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import companyLogoPng from '../assets/images/company_logo.png';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', iconOnly = false, size = 'md' }: LogoProps) {
  const profile = useLiveQuery(() => db.businessProfiles.get('bp_default'));
  const companyName = profile?.businessName || 'মেসার্স ফাহিম এন্টারপ্রাইজ';
  const logo = profile?.logoBase64 || companyLogoPng;

  // Determine height classes based on size prop and iconOnly
  let logoHeightClass = 'h-9 w-9';
  if (iconOnly) {
    if (size === 'sm') logoHeightClass = 'h-7 w-7';
    if (size === 'lg') logoHeightClass = 'h-11 w-11';
  } else {
    if (size === 'sm') logoHeightClass = 'h-8';
    if (size === 'lg') logoHeightClass = 'h-12';
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="relative shrink-0 flex items-center justify-center">
        <img 
          src={logo} 
          alt={companyName} 
          className={`object-contain rounded-lg transition-transform duration-200 hover:scale-105 ${
            iconOnly 
              ? `${logoHeightClass} p-0.5 bg-white shadow-xs border border-slate-200/80` 
              : `${logoHeightClass} w-auto max-h-12`
          }`}
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback to bundled PNG logo if custom logo string fails
            (e.currentTarget as HTMLImageElement).src = companyLogoPng;
          }}
        />
      </div>
      {!iconOnly && (
        <div className="flex flex-col min-w-0">
          <span className="font-sans font-black text-slate-900 tracking-tight leading-none text-sm md:text-base truncate">
            {companyName}
          </span>
          <span className="font-mono text-[9px] text-emerald-600 font-extrabold mt-1 tracking-widest uppercase">
            ERP v3
          </span>
        </div>
      )}
    </div>
  );
}
