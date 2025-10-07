import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import cleaner from 'rollup-plugin-cleaner';
import url from '@rollup/plugin-url';
import commonjs from '@rollup/plugin-commonjs';
import { readFileSync } from 'fs';
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

const external = (id) => {
  // Externalize React to use the same instance as the host app
  if (id === 'react' || id === 'react-dom') {
    return true;
  }
  if (id.startsWith('react/') || id.startsWith('react-dom/')) {
    return true;
  }
  if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') {
    return true;
  }
  // Also externalize other peer dependencies
  if (id === 'react-hook-form' || id.startsWith('react-hook-form/')) {
    return true;
  }
  return false;
};

const plugins = [
  
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
  
  commonjs({
    include: ['node_modules/**'],
    exclude: ['node_modules/react/**', 'node_modules/react-dom/**']
  }),
  
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: 'dist',
    compilerOptions: {
      rootDir: 'src',
    },
  }),
  
  terser(),
];

export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    external,
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: false,
    },
    plugins: [
      ...plugins,
      cleaner({
        targets: ['./dist'],
      }),
    ],
    preserveModules: false,
  },
  // ESM build
  {
    input: 'src/index.ts',
    external,
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: false,
    },
    plugins,
    preserveModules: false,
  }
]; 
