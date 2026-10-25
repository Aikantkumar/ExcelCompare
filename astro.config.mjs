import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://excelcomparecolumns.com',
  integrations: [
    react(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en-US',
          es: 'es-ES',
          zh: 'zh-CN',
          ja: 'ja-JP',
          fr: 'fr-FR',
          de: 'de-DE',
          pt: 'pt-PT',
          ko: 'ko-KR',
          it: 'it-IT',
        },
      },
      filter: (page) => !page.includes('/404') && !page.includes('/500'),
    }),
  ],
  vite: {
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    plugins: [
      tailwindcss(),
      visualizer({
        filename: 'dist/stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    ],
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'xlsx',
        'lucide-react',
        '@tanstack/react-virtual',
      ],
    },
  },
});
