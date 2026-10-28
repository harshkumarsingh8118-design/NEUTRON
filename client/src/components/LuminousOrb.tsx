import React from 'react';

interface LuminousOrbProps {
  size?: number;
}

export const LuminousOrb: React.FC<LuminousOrbProps> = ({ size = 96 }) => {
  return (
    <div
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        margin: '0 auto 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Ambient Radial Bloom */}
      <div
        style={{
          position: 'absolute',
          width: `${size * 1.6}px`,
          height: `${size * 1.6}px`,
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(99, 102, 241, 0.2) 40%, rgba(56, 189, 248, 0.15) 70%, transparent 80%)',
          borderRadius: '50%',
          filter: 'blur(20px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Iridescent 3D Floating Orb */}
      <div
        className="luminous-orb-sphere"
        style={{
          position: 'relative',
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.6) 18%, transparent 42%),
            radial-gradient(circle at 75% 75%, #3b82f6 0%, #8b5cf6 40%, #ec4899 75%, #f43f5e 100%)
          `,
          boxShadow: `
            inset -10px -10px 25px rgba(30, 27, 75, 0.6),
            inset 10px 10px 25px rgba(255, 255, 255, 0.7),
            0 14px 28px rgba(236, 72, 153, 0.28),
            0 6px 14px rgba(99, 102, 241, 0.22)
          `,
          zIndex: 1,
          animation: 'floatOrb 4s ease-in-out infinite',
        }}
      >
        {/* Specular Highlight Glint */}
        <div
          style={{
            position: 'absolute',
            top: '18%',
            left: '26%',
            width: `${size * 0.28}px`,
            height: `${size * 0.16}px`,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, #ffffff 40%, rgba(255, 255, 255, 0) 100%)',
            transform: 'rotate(-35deg)',
            filter: 'blur(1px)',
          }}
        />

        {/* Secondary Soft Rim Light */}
        <div
          style={{
            position: 'absolute',
            bottom: '14%',
            right: '18%',
            width: `${size * 0.32}px`,
            height: `${size * 0.22}px`,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(56, 189, 248, 0.8) 0%, transparent 80%)',
            filter: 'blur(3px)',
          }}
        />
      </div>
    </div>
  );
};
