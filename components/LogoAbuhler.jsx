'use client';

export default function LogoAbuhler({ height = 44, invertido = true, className = '' }) {
  return (
    <img
      src="/logo-abuhler.png"
      alt="A. Bühler Genuine Leather"
      style={{
        height,
        width: 'auto',
        maxWidth: '100%',
        display: 'block',
        alignSelf: 'flex-start',
        filter: invertido ? 'brightness(0) invert(1)' : 'none',
        imageRendering: 'crisp-edges',
      }}
      className={className}
    />
  );
}
