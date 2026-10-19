import type { ManifestOptions } from 'vite-plugin-pwa'

const BRAND_COLOR = '#1976d2'

export const manifest: Partial<ManifestOptions> = {
  name: 'Housely',
  short_name: 'Housely',
  description: 'Share the chores of your flat: a fair weekly rotation for every zone and person.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: BRAND_COLOR,
  background_color: '#ffffff',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
