import React from 'react';

export const PaperAirplaneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
);

export const BotIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path fillRule="evenodd" d="M4.5 3.75a3 3 0 00-3 3v10.5a3 3 0 003 3h15a3 3 0 003-3V6.75a3 3 0 00-3-3h-15zm4.125 3a2.625 2.625 0 115.25 0 2.625 2.625 0 01-5.25 0zM17.625 6.75a2.625 2.625 0 100 5.25 2.625 2.625 0 000-5.25zM12 15.75a.75.75 0 00.75-.75v-1.5a.75.75 0 00-1.5 0v1.5a.75.75 0 00.75.75zM14.25 12a.75.75 0 00-.75.75v1.5a.75.75 0 001.5 0v-1.5a.75.75 0 00-.75-.75zM9.75 12a.75.75 0 00-.75.75v1.5a.75.75 0 001.5 0v-1.5A.75.75 0 009.75 12z" clipRule="evenodd" />
        <path d="M11.625 18.75a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
    </svg>
);

export const PlaneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    transform="rotate(90)"
  >
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    <path
      fillRule="evenodd"
      d="M21.625 12a9.625 9.625 0 11-19.25 0 9.625 9.625 0 0119.25 0zM12 3.375c-4.76 0-8.625 3.865-8.625 8.625s3.865 8.625 8.625 8.625 8.625-3.865 8.625-8.625S16.76 3.375 12 3.375z"
      clipRule="evenodd"
    />
  </svg>
);

export const ArrowRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
      clipRule="evenodd"
    />
  </svg>
);

export const BuildingOfficeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M4.5 2.25a.75.75 0 000 1.5v16.5a.75.75 0 00.75.75h13.5a.75.75 0 00.75-.75V3.75a.75.75 0 000-1.5h-15zM9 6a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9zm-.75 3.75A.75.75 0 019 9h.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM9 12a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9zm-.75 3.75a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM13.5 6a.75.75 0 000 1.5h.75a.75.75 0 000-1.5h-.75zm-.75 3.75a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zM13.5 12a.75.75 0 000 1.5h.75a.75.75 0 000-1.5h-.75zm-.75 3.75a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75z"
      clipRule="evenodd"
    />
    <path d="M2.25 21a.75.75 0 00.75.75h18a.75.75 0 00.75-.75V18a.75.75 0 00-.75-.75H3a.75.75 0 00-.75.75v3z" />
  </svg>
);

export const StarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.007z"
      clipRule="evenodd"
    />
  </svg>
);

export const ChatBubbleLeftRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.75 6.75 0 006.75-6.75v-2.506a5.25 5.25 0 01-4.342-5.022 5.25 5.25 0 0110.193.66a1.125 1.125 0 002.094.418 7.5 7.5 0 00-14.13-.941 7.5 7.5 0 00-1.26 13.181 6.707 6.707 0 00.558.261zM17.25 12.75a.75.75 0 000 1.5h.75a4.5 4.5 0 014.5 4.5v.106a2.25 2.25 0 01-1.723 2.193 2.25 2.25 0 01-2.428-1.718 4.48 4.48 0 00-.095-.429 4.5 4.5 0 00-4.5-4.5h-.75a.75.75 0 000-1.5h.75a6 6 0 016 6v.059a3.75 3.75 0 003.352 3.658 3.75 3.75 0 004.148-3.342v-.106a6 6 0 00-6-6h-.75z" clipRule="evenodd" />
    </svg>
);

export const TravelBilliLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="-10 -15 120 135" 
        className={className}
        aria-label="TravelBilli Logo"
    >
        <g stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Cat Head */}
            <path d="M90 40 C90 70, 70 90, 50 90 C30 90, 10 70, 10 40 C10 10, 30 -10, 50 -10 C70 -10, 90 10, 90 40 Z" fill="currentColor" fillOpacity="0.1" />
            {/* Ears */}
            <path d="M20,0 L10,10" />
            <path d="M80,0 L90,10" />
            
            {/* Sunglasses */}
            <circle cx="35" cy="35" r="12" fill="currentColor" />
            <circle cx="65" cy="35" r="12" fill="currentColor" />
            <line x1="47" y1="35" x2="53" y2="35" stroke="currentColor" strokeWidth="3" />

            {/* Skateboard */}
            <path d="M 5 95 C 0 95, 0 100, 5 100 L 95 100 C 100 100, 100 95, 95 95 Z" fill="currentColor" />
            <circle cx="25" cy="105" r="5" fill="currentColor" />
            <circle cx="75" cy="105" r="5" fill="currentColor" />
        </g>
    </svg>
);
