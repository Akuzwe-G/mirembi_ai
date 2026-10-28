import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { offlineShell } from './resources/pwa/build-plugin.mjs';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/main.tsx'],
            refresh: true,
        }),
        tailwindcss(),
        react(),
        offlineShell(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'resources/js',
            filename: 'sw.ts',
            outDir: 'public/build',
            base: '/build/',
            buildBase: '/build/',
            scope: '/',
            injectRegister: false,
            registerType: 'prompt',
            includeAssets: [],
            manifest: {
                id: '/', name: 'Mirembe AI', short_name: 'Mirembe',
                description: 'From overwhelm to clarity, one step at a time.',
                start_url: '/', scope: '/', display: 'standalone',
                theme_color: '#40335B', background_color: '#FAF8F5', lang: 'en',
                icons: [192, 512].flatMap(size => [
                    { src: `/icons/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' },
                    { src: `/icons/maskable-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'maskable' },
                ]),
            },
            injectManifest: {
                globPatterns: ['assets/**/*.{js,css,woff,woff2}', 'offline.html'],
                additionalManifestEntries: ['icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png', 'apple-touch-icon.png'].map(file => ({
                    url: `/icons/${file}`,
                    revision: createHash('sha256').update(readFileSync(`public/icons/${file}`)).digest('hex'),
                })),
                manifestTransforms: [async entries => ({
                    manifest: entries.map(entry => ({ ...entry, url: entry.url.startsWith('/') ? entry.url : `/build/${entry.url}` })),
                    warnings: [],
                })],
            },
            devOptions: { enabled: false },
        }),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
