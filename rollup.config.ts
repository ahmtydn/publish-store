import { defineConfig } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    sourcemap: true,
    exports: 'named',
  },
  plugins: [
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true,
    }),
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),
    commonjs(),
  ],
  external: [
    // Node.js built-ins
    'node:fs',
    'node:path',
    'node:process',
    'node:util',
    'node:crypto',
    'node:os',
    'fs',
    'path',
    'process',
    'util',
    'crypto',
    'os',
    // GitHub Actions
    '@actions/core',
    '@actions/github',
    // Large external dependencies that should remain external
    'googleapis',
    'jsonwebtoken',
    'axios',
    'form-data',
    'zod',
  ],
});
