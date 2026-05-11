import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sistema de Laudos Técnicos - A. Bühler',
    short_name: 'Laudos A.Bühler',
    description: 'Sistema profissional de gestão de laudos técnicos',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait',
    icons: [
      {
        src: '/logo-abuhler.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
