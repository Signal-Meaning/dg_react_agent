import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import cleaner from 'rollup-plugin-cleaner';
import url from '@rollup/plugin-url';
//import packageJson from './package.json' assert { type: 'json' };
import { readFileSync } from 'fs';
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

export default {
  input: 'src/index.ts',
  external: ['react', 'react-dom'],
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: packageJson.module,
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    cleaner({
      targets: ['./dist'],
    }),
    
    peerDepsExternal(),
    
    url({
      include: ['**/*.js'],
      limit: Infinity,
      fileName: '[dirname][name][extname]',
      publicPath: '/',
    }),
    
    resolve({
      browser: true,
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    }),
    
    commonjs(),
    
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      compilerOptions: {
        rootDir: 'src',
      },
    }),
    
    terser(),
  ],
  preserveModules: false,
}; 
