import resolve from '@rollup/plugin-node-resolve';
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
  external: (id) => {
    // Externalize React and React DOM and their subpaths
    if (id === 'react' || id === 'react-dom') {
      return true;
    }
    if (id.startsWith('react/') || id.startsWith('react-dom/')) {
      return true;
    }
    // Externalize any other peer dependencies
    if (id.startsWith('@types/')) {
      return true;
    }
    return false;
  },
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: false,
      exports: 'named',
    },
    {
      file: packageJson.module,
      format: 'esm',
      sourcemap: false,
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
      preferBuiltins: false,
    }),
    
    // commonjs plugin removed to prevent React bundling
    // React should be externalized, not processed by commonjs
    
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
