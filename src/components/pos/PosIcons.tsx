import React from 'react';

// Geometric 3D Cube Brand Logo
export const BrandLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M24 4L40 13.24V31.76L24 41L8 31.76V13.24L24 4Z"
      fill="#517b64"
      fillOpacity="0.12"
    />
    <path
      d="M24 6L38 14.08V30.92L24 39L10 30.92V14.08L24 6Z"
      stroke="#283e32"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M24 6V22.5M38 14.08L24 22.5M10 14.08L24 22.5"
      stroke="#283e32"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M24 22.5V39M38 30.92L24 22.5M10 30.92L24 22.5"
      stroke="#3c5d4b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="24" cy="22.5" r="3.5" fill="#283e32" />
  </svg>
);

// bKash Origami Bird Icon
export const BkashIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#D12053]`}>
    <path d="M12.8 2L4 10.8l4.4 1.2L12.8 2zm-.8 9.2l-4-1.1L2 16.1l6 .9 4-6zm2.4-7.6l-3.2 7.4 6 1.4-2.8-8.8zm-1.2 8.6l-3.6 5.8 8.8-1.4-5.2-4.4zm6.8 5.6l-6.4 1 2.8 3.2 3.6-4.2z" />
  </svg>
);

// Nagad Flame Icon
export const NagadIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#F7941D]`}>
    <path d="M12 2C8.5 5.5 6 9 6 13a6 6 0 0012 0c0-2-1-4-2.5-5.5L12 2zm0 15a3 3 0 01-3-3c0-1.8 1.5-3.5 3-4.5 1.5 1 3 2.7 3 4.5a3 3 0 01-3 3z" />
  </svg>
);

// Cash Banknote Icon
export const CashIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${className} text-[#3c5d4b]`}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);

// Bank Card Icon
export const CardBankIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${className} text-blue-600`}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
    <line x1="6" y1="15" x2="10" y2="15" />
  </svg>
);

// User Avatar Icon (Green Cap Technician)
export const StaffAvatarIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="16" cy="16" r="16" fill="#e0ebe5" />
    <path d="M16 6C12.5 6 10 8.5 10 11.5C10 12.5 10.5 13.5 11 14C12 15 13.5 16 16 16C18.5 16 20 15 21 14C21.5 13.5 22 12.5 22 11.5C22 8.5 19.5 6 16 6Z" fill="#283e32" />
    <circle cx="16" cy="13" r="4" fill="#FDE68A" />
    <path d="M7 26C7 21.5 11 18 16 18C21 18 25 21.5 25 26" fill="#283e32" />
    <path d="M12 9C13 7.5 15 7 16 7C17 7 19 7.5 20 9" stroke="#517b64" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
