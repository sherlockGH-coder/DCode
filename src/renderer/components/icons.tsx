import React from 'react';
export { getFileIcon, IconDocument } from './fileIcons';

interface IconProps {
  size?: number;
  className?: string;
}

export const IconDeepThinking: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
    <path d="M368 51.2A188.8 188.8 0 0 1 556.8 240v476.096a241.472 241.472 0 0 1-238.656 241.344A209.344 209.344 0 0 1 108.8 748.16V608h89.6v140.096a119.744 119.744 0 0 0 130.432 119.296A151.872 151.872 0 0 0 467.2 716.096V240a99.2 99.2 0 0 0-198.4 0v122.688H179.2V240A188.8 188.8 0 0 1 368 51.2z" />
    <path d="M268.8 275.2v89.6c-77.248 0-115.2 42.496-115.2 128 0 76.032 60.288 128 147.2 128v89.6C167.104 710.4 64 621.504 64 492.8c0-132.864 75.648-217.6 204.8-217.6zM341.568 423.296l3.328 0.64a264.192 264.192 0 0 1 211.84 276.672l-89.408-6.016a174.592 174.592 0 0 0-140.032-182.784l-3.264-0.64 17.536-87.872z" />
    <path d="M662.4 51.2A188.8 188.8 0 0 0 473.6 240v476.096a241.472 241.472 0 0 0 238.656 241.344 209.344 209.344 0 0 0 209.28-209.344V608H832v140.096a119.744 119.744 0 0 1-130.368 119.296A151.872 151.872 0 0 1 563.2 716.096V240a99.2 99.2 0 0 1 198.4 0v122.688h89.6V240A188.8 188.8 0 0 0 662.4 51.2z" />
    <path d="M761.6 275.2v89.6c77.248 0 115.2 42.496 115.2 128 0 76.032-60.288 128-147.2 128v89.6c133.696 0 236.8-88.896 236.8-217.6 0-132.864-75.648-217.6-204.8-217.6zM688.832 423.296l-3.328 0.64a264.192 264.192 0 0 0-211.84 276.672l89.408-6.016a174.592 174.592 0 0 1 139.968-182.784l3.328-0.64-17.536-87.872z" />
  </svg>
);

export const IconEdit: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/>
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

export const IconMicrophone: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" stroke="currentColor" strokeWidth="20" aria-hidden>
    <path d="M486.4 972.8v-128.9728A332.8 332.8 0 0 1 179.2 512a25.6 25.6 0 0 1 51.2 0 281.6 281.6 0 0 0 563.2 0 25.6 25.6 0 1 1 51.2 0 332.8 332.8 0 0 1-307.2 331.8272V972.8h153.6a25.6 25.6 0 1 1 0 51.2h-358.4a25.6 25.6 0 1 1 0-51.2h153.6zM512 51.2a153.6 153.6 0 0 0-153.6 153.6v307.2a153.6 153.6 0 0 0 307.2 0V204.8a153.6 153.6 0 0 0-153.6-153.6z m0-51.2a204.8 204.8 0 0 1 204.8 204.8v307.2a204.8 204.8 0 1 1-409.6 0V204.8a204.8 204.8 0 0 1 204.8-204.8z" />
  </svg>
);

export const IconChecklist: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="8" y1="9" x2="16" y2="9" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </svg>
);

export const IconCube: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2.75 20 7.25v9.5l-8 4.5-8-4.5v-9.5L12 2.75Z" />
    <path d="M4.35 7.55 12 12l7.65-4.45" />
    <path d="M12 12v8.75" />
    <path d="M8 5.05 16 9.55" />
    <path d="M8 18.95v-8.9" />
  </svg>
);

export const IconPlug: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
    <path d="M443.778345 54.433329A183.161704 183.161704 0 0 1 654.075116 18.402567c34.430816 16.639428 62.909837 43.710497 81.4692 77.437339 18.559362 33.726841 26.431091 72.381512 22.39923 110.780191a179.001847 179.001847 0 0 1 107.836293 20.991279c32.958867 18.111377 59.517954 46.206412 75.901391 80.253241a184.057673 184.057673 0 0 1-34.366819 208.632828l-333.940521 337.268407 102.972461 103.932427a40.510607 40.510607 0 0 1-2.239923 54.39813 39.614638 39.614638 0 0 1-53.886148 2.303921l-131.003497-132.283453a40.318614 40.318614 0 0 1 0-56.702051L851.18834 459.987388a102.844465 102.844465 0 0 0-2.687907-141.627132 100.732537 100.732537 0 0 0-140.155182-3.19989l-3.19989 3.19989v0.127996l-257.335154 259.19109a39.678636 39.678636 0 0 1-48.190344 6.079791 39.806632 39.806632 0 0 1-12.607567-11.967588c-0.639978-0.895969-1.023965-1.855936-1.599945-2.751906a39.998625 39.998625 0 0 1-4.735837-25.855111l0.383987-2.111927a40.062623 40.062623 0 0 1 5.567809-13.823525l5.119824-6.271785 257.079163-259.19109 7.295749-8.127721a107.324311 107.324311 0 0 0-11.711598-145.594995 104.892394 104.892394 0 0 0-144.57103 2.943899L131.21309 483.538578a39.422645 39.422645 0 0 1-55.550091-0.511982 40.318614 40.318614 0 0 1-0.511982-56.126071L443.842343 54.433329h-0.063998z m102.908463 103.356447a39.422645 39.422645 0 0 1 55.742084 1.023965 40.318614 40.318614 0 0 1-0.383987 56.318064L339.973913 473.554922a107.836293 107.836293 0 0 0-33.406851 76.733362 108.79626 108.79626 0 0 0 31.038933 77.693329 106.620335 106.620335 0 0 0 76.733362 31.742909 105.852361 105.852361 0 0 0 76.093384-33.278856l261.047027-266.870826a39.486643 39.486643 0 0 1 54.270134 1.343953 40.318614 40.318614 0 0 1 2.175926 54.846115l-261.047027 266.934824a186.041605 186.041605 0 0 1-132.219455 56.510058 184.505658 184.505658 0 0 1-132.667439-55.486093 188.153532 188.153532 0 0 1-54.078142-134.39538A189.625482 189.625482 0 0 1 284.615816 416.020899l262.070992-258.231123z" />
  </svg>
);

export const IconClock: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2" />
    <path d="M5 3 2 6" />
    <path d="M19 3l3 3" />
    <path d="M6.38 18.72 4 21" />
    <path d="M17.62 18.72 20 21" />
  </svg>
);

export const IconPanels: React.FC<IconProps> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);

export const IconSidebarToggle: React.FC<IconProps> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);

export const IconPanelsRight: React.FC<IconProps> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);

export const IconChevronDown: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const IconChevronLeft: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const IconChevronRight: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const IconChat: React.FC<IconProps> = ({ size = 14, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3C6.48 3 2 6.8 2 11.5C2 13.86 3.1 15.96 4.9 17.42L3.8 20.72C3.66 21.14 4.14 21.52 4.54 21.32L8.3 19.82C9.46 20.22 10.72 20.5 12 20.5C17.52 20.5 22 16.7 22 12C22 7.3 17.52 3 12 3Z" />
  </svg>
);

export const IconCode: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="7.5 8.5 4 12 7.5 15.5" />
    <polyline points="16.5 15.5 20 12 16.5 8.5" />
    <line x1="13.5" y1="5.5" x2="10.5" y2="18.5" />
  </svg>
);

export const IconExternalOpen: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

export const IconDots: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);

export const IconTrash: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

export const IconGear: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <g>
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
    </g>
  </svg>
);

export const IconSidebarTerminal: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect width="20" height="20" x="2" y="2" rx="4" />
    <polyline points="7 9 10 12 7 15" />
    <line x1="12" y1="15" x2="17" y2="15" />
  </svg>
);

export const IconFile: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const IconCheck: React.FC<IconProps> = ({ size = 14, className = 'shrink-0 text-green-600' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const IconX: React.FC<IconProps> = ({ size = 14, className = 'shrink-0 text-current' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconFolder: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
  </svg>
);

export const IconFolderSoft: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 8a2 2 0 0 1 2-2h4.17a2 2 0 0 1 1.41.59l1.24 1.23A2 2 0 0 0 13.23 8.4H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
  </svg>
);

export const IconProjectFolder: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 8a2 2 0 0 1 2-2h4.17a2 2 0 0 1 1.41.59l1.24 1.23A2 2 0 0 0 13.23 8.4H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
    <path d="M4 12h16" />
  </svg>
);

export const IconFolderOpen: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {                                      }
    <path fill="var(--bg-sidebar)" d="M3 8a2 2 0 0 1 2-2h4.17a2 2 0 0 1 1.41.59l1.24 1.23A2 2 0 0 0 13.23 8.4H19a2 2 0 0 1 2 2V20H3V8Z" />
    {                                                  }
    <path fill="var(--bg-sidebar)" d="M4 20l2-8a2 2 0 0 1 2-1h14a1 1 0 0 1 1 2l-2 7H4z" />
  </svg>
);

export const IconFolderPlus: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v5" />
    <line x1="18" y1="14" x2="18" y2="22" />
    <line x1="14" y1="18" x2="22" y2="18" />
  </svg>
);

export const IconFolderCode: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 8a2 2 0 0 1 2-2h4.17a2 2 0 0 1 1.41.59l1.24 1.23A2 2 0 0 0 13.23 8.4H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
    <path d="m8 11-2 2 2 2" />
    <path d="m14 11 2 2-2 2" />
    <line x1="12" y1="10" x2="10" y2="16" />
  </svg>
);

export const IconComet: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m11.5 11.5-6-6" />
    <path d="m16 8.5-10-5" />
    <path d="m8.5 16-5-10" />
    <circle cx="17" cy="17" r="3" />
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({ size = 14, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconPlan: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <line x1="8" y1="8" x2="16" y2="8" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="16" x2="12" y2="16" />
  </svg>
);

export const IconKey: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

export const IconShield: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const IconMemory: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 7a4 4 0 0 1 8 0v10a4 4 0 0 1-8 0V7Z" />
    <path d="M8 9H6.5a2.5 2.5 0 0 0 0 5H8" />
    <path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16" />
    <path d="M11 6v12" />
    <path d="M13 6v12" />
  </svg>
);

export const IconInfo: React.FC<IconProps> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const IconAsk: React.FC<IconProps> = ({ size = 20, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <line x1="10" y1="10" x2="10.01" y2="10" />
    <path d="M10 10a2 2 0 0 1 4 0c0 2-3 3-3 5" />
  </svg>
);

export const IconAllow: React.FC<IconProps> = ({ size = 20, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-5" />
  </svg>
);

export const IconUnlock: React.FC<IconProps> = ({ size = 20, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

export const IconDeny: React.FC<IconProps> = ({ size = 20, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

export const IconGlobe: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const IconGithub: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.36 6.84 9.72.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.22-3.37-1.22-.45-1.2-1.11-1.52-1.11-1.52-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.34 9.34 0 0 1 12 6.93c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.95.68 1.91 0 1.38-.01 2.5-.01 2.83 0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
  </svg>
);

export const IconSparkles: React.FC<IconProps> = ({ size = 20, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);

export const IconCopy: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M9 5V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1" />
  </svg>
);

export const IconBroom: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m4.5 11 10.5 10.5" />
    <path d="m5 16 1.5 1.5" />
    <path d="m6 10 1.5 1.5" />
    <path d="M14.5 5.5 16 7" />
    <path d="m15.5 10 1.5 1.5" />
    <path d="M16 5c.8-1 1.2-2.3 3.5-3s3 2.7 2.2 5c-.7 2.3-2 2.7-3 3.5" />
    <path d="M8 22c-.5-1.1-1.3-1.8-2.2-2.2H2v-4.4C2.4 14.5 3.1 13.7 4.2 13.2" />
  </svg>
);

export const IconArchive: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect width="20" height="5" x="2" y="3" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
);

export const IconBolt: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

export const IconLayers: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
    <path d="M704 349.866667a34.133333 34.133333 0 0 1 34.133333 34.133333c0 56.661333-14.037333 97.109333-36.224 124.074667-22.016 26.752-50.474667 38.058667-73.728 38.058666-35.370667 0-57.472-21.888-70.869333-44.885333a134.4 134.4 0 0 1-15.872 20.437333c-11.818667 12.245333-29.44 24.448-52.352 24.448-23.466667 0-40.832-12.672-52.181333-25.813333a116.053333 116.053333 0 0 1-11.946667-17.109333c-2.730667 4.693333-5.546667 9.301333-8.832 13.525333-10.325333 13.482667-27.946667 29.397333-53.461333 29.397333a34.133333 34.133333 0 0 1-3.328-68.138666c0.554667-0.554667 1.493333-1.322667 2.56-2.730667 4.394667-5.717333 9.258667-15.274667 13.866666-28.16a389.376 389.376 0 0 0 16.384-68.096l1.493334-6.186667a34.133333 34.133333 0 0 1 66.176 7.808c1.962667 19.456 7.168 48.256 15.914666 71.168 4.437333 11.52 8.96 19.413333 12.8 23.893334 0.384 0.426667 0.810667 0.682667 1.109334 0.981333 0.682667-0.554667 1.578667-1.28 2.602666-2.346667 4.821333-4.992 10.410667-13.44 16.042667-25.173333 11.221333-23.253333 19.328-52.266667 23.168-71.765333A34.133333 34.133333 0 0 1 599.082667 384c0 18.986667 2.944 46.805333 10.666666 68.565333 8.704 24.490667 16.768 25.301333 18.432 25.301334 2.090667 0 11.52-1.578667 21.034667-13.141334 9.386667-11.434667 20.650667-34.986667 20.650667-80.725333a34.133333 34.133333 0 0 1 34.133333-34.133333z" />
    <path d="M682.666667 89.6A166.4 166.4 0 0 1 849.066667 256v430.933333H896a38.4 38.4 0 0 1 38.4 38.4c0 94.506667-27.136 153.429333-77.610667 184.021334-45.312 27.434667-101.333333 25.002667-134.997333 25.002666L362.666667 934.4a145.066667 145.066667 0 0 1-145.066667-145.066667V166.442667c-20.053333 0.256-31.189333 4.394667-37.205333 8.106666a26.112 26.112 0 0 0-11.306667 14.293334c-5.12 14.464-2.474667 36.266667 4.138667 53.418666a38.4 38.4 0 0 1-71.68 27.477334c-9.813333-25.472-18.602667-67.712-4.821334-106.581334a102.826667 102.826667 0 0 1 43.050667-53.76c21.12-13.184 47.36-19.498667 77.824-19.754666L682.666667 89.6zM294.4 789.333333a68.266667 68.266667 0 0 0 61.269333 67.925334l6.997334 0.341333c15.061333 0 31.872-8.618667 46.72-32 14.890667-23.466667 25.130667-58.624 25.130666-100.266667a38.4 38.4 0 0 1 38.4-38.4H772.266667V256A89.6 89.6 0 0 0 682.666667 166.4H294.4v622.933333z m214.613333-25.6c-4.224 34.602667-14.165333 66.816-29.354666 93.866667h242.133333c41.002667 0 72.106667 0 95.232-13.994667 14.762667-8.96 32.597333-28.330667 38.528-79.872H509.013333z" />
  </svg>
);

export const IconHistory: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export const IconUndo: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="9 3 4 7 9 11" />
    <path d="M4 7h12a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6H8" />
  </svg>
);

export const IconBranch: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
    <path d="M303.146667 648.96A128.042667 128.042667 0 1 1 213.333333 647.253333V376.746667a128.042667 128.042667 0 1 1 85.333334 0V512c35.669333-26.794667 79.957333-42.666667 128-42.666667h170.666666a128.042667 128.042667 0 0 0 123.52-94.293333 128.042667 128.042667 0 1 1 86.698667 2.730667A213.376 213.376 0 0 1 597.333333 554.666667h-170.666666a128.042667 128.042667 0 0 0-123.52 94.293333zM256 725.333333a42.666667 42.666667 0 1 0 0 85.333334 42.666667 42.666667 0 0 0 0-85.333334zM256 213.333333a42.666667 42.666667 0 1 0 0 85.333334 42.666667 42.666667 0 0 0 0-85.333334z m512 0a42.666667 42.666667 0 1 0 0 85.333334 42.666667 42.666667 0 0 0 0-85.333334z" />
  </svg>
);

export const IconDiff: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 7h10" />
    <path d="M7 17h10" />
    <path d="m14 4 3 3-3 3" />
    <path d="m10 14-3 3 3 3" />
  </svg>
);

export const IconRobot: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="12" y1="12" x2="12" y2="12.01" />
    <line x1="8" y1="12" x2="8" y2="12.01" />
    <line x1="16" y1="12" x2="16" y2="12.01" />
    <circle cx="12" cy="16" r="1" />
  </svg>
);

export const IconWrench: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

export const IconCompress: React.FC<IconProps> = ({ size = 16, className = 'shrink-0' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="10" y1="14" x2="3" y2="21" />
  </svg>
);

export const IconReactAtom: React.FC<IconProps> = ({ size = 14, className = 'shrink-0 text-[#149ECA]' }) => (
  <svg className={className} width={size} height={size} viewBox="-12 -12 24 24" fill="none" aria-hidden>
    <circle cx="0" cy="0" r="2.8" fill="currentColor" />
    <ellipse rx="9.5" ry="4.5" stroke="currentColor" strokeWidth="2.2" />
    <ellipse rx="9.5" ry="4.5" stroke="currentColor" strokeWidth="2.2" transform="rotate(60)" />
    <ellipse rx="9.5" ry="4.5" stroke="currentColor" strokeWidth="2.2" transform="rotate(120)" />
  </svg>
);

export const IconBookOpen: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
