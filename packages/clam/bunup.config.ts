import { defineConfig } from 'bunup';

// Skip bundling picocolors on Windows due to Bun bundler bug with Windows paths
// See: https://github.com/oven-sh/bun/issues/15007
const isWindows = process.platform === 'win32';

export default defineConfig([
  // Library entry point
  {
    name: 'index',
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: 'linked',
    target: 'node',
    minify: false,
  },
  // CLI binary - ESM entry
  // Bundle picocolors for faster startup (except on Windows where it causes crashes)
  {
    name: 'bin',
    entry: ['src/bin.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: 'linked',
    target: 'node',
    minify: false,
    banner: '#!/usr/bin/env bun',
    noExternal: isWindows ? [] : ['picocolors'],
  },
]);
