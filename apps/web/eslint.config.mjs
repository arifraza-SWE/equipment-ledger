import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': 'error',
    },
  },
  prettier,
);
