import { defineConfig } from 'tsdown';

// Common options for ESM-only build
const commonOptions = {
  format: ['esm'] as 'esm'[],
  platform: 'node' as const,
  target: 'node22' as const,
  sourcemap: true,
  dts: true,
};

export default defineConfig([
  // Library entry point
  {
    ...commonOptions,
    entry: {
      index: 'src/index.ts',
    },
    clean: true,
  },
  // CLI binary - ESM entry
  // Bundle all dependencies for faster startup
  {
    ...commonOptions,
    entry: { bin: 'src/bin.ts' },
    banner: '#!/usr/bin/env node',
    clean: false,
    noExternal: ['picocolors'],
    inlineOnly: false,
  },
]);
