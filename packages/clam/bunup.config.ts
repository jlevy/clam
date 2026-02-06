import { defineConfig } from 'bunup';

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
  // Bundle picocolors for faster startup
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
    noExternal: ['picocolors'],
  },
]);
