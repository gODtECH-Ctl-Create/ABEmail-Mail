import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ABEmail Mail',
    short_name: 'ABEmail',
    description: 'Waste2Light business email workspace',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f5f7',
    theme_color: '#111827',
  };
}
