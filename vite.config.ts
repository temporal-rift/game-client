/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const gameService = process.env.GAME_SERVICE_URL ?? 'http://localhost:8080'
const timelineService = process.env.TIMELINE_SERVICE_URL ?? 'http://localhost:8081'
const readService = process.env.READ_SERVICE_URL ?? 'http://localhost:8082'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mirrors the playtest edge routing so the client talks to one origin. The first matching entry
    // wins, so owner-specific paths precede the /api/ fallback.
    proxy: {
      '^/api/v1/games/[^/]+/(state|history)(\\?|$)': readService,
      '^/api/v1/games/[^/]+/chains': timelineService,
      '/ws/': { target: readService, ws: true },
      '^/actuator/health(\\?|$)': gameService,
      '/api/': gameService,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: false,
    // Coverage instrumentation slows the heavy board renders past the default
    // 5s timeout on modest machines; the tests themselves are unchanged.
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/setupTests.ts', 'src/test/**', 'src/api/generated/**'],
    },
  },
})
