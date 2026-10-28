import React from 'react';

interface NeutronLogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  withTagline?: boolean;
}

export const NeutronLogo: React.FC<NeutronLogoProps> = ({
  size = 28,
  className = '',
  withText = false,
  withTagline = false,
}) => {
  return (
    <div className={`neutron-brand-wrapper ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Main Dark Charcoal N Body */}
        <path
          d="M 28 22 
             C 24 22, 22 24, 22 28 
             V 92 
             C 22 96, 24 98, 28 98 
             H 38 
             C 42 98, 44 96, 44 92 
             V 52 
             L 86 96 
             C 88 98, 92 98, 96 96 
             C 98 94, 98 90, 98 86 
             V 58 
             H 82 
             V 74 
             L 42 30 
             C 40 28, 38 22, 32 22 
             Z"
          fill="#DDE2EC"
        />

        {/* Electric Blue Accent Triangle in Top-Right Corner */}
        <path
          d="M 64 22 
             H 94 
             C 97 22, 98 23, 98 26 
             V 52 
             Z"
          fill="#2563EB"
        />
      </svg>

      {withText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: `${Math.max(14, size * 0.58)}px`,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#EDEDF0',
              lineHeight: 1.1,
            }}
          >
            NEUTRON
          </span>
          {withTagline && (
            <span
              style={{
                fontSize: '10px',
                color: '#6B7280',
                letterSpacing: '0.04em',
                fontWeight: 500,
              }}
            >
              Intelligence in Action
            </span>
          )}
        </div>
      )}
    </div>
  );
};
