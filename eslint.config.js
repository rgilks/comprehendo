import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

const removeGlobal = (globalsObj, globalToRemove) => {
  const rest = { ...globalsObj };
  delete rest[globalToRemove];
  return rest;
};

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'public/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.config.cjs',
    ],
  },
  eslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...removeGlobal(globals.browser, 'AudioWorkletGlobalScope '),
        ...globals.node,
        AudioWorkletGlobalScope: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },

  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...removeGlobal(globals.browser, 'AudioWorkletGlobalScope '),
        AudioWorkletGlobalScope: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      react: reactPlugin,
      'react-hooks': hooksPlugin,
    },
    languageOptions: {
      globals: {
        ...removeGlobal(globals.browser, 'AudioWorkletGlobalScope '),
        AudioWorkletGlobalScope: 'readonly',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...hooksPlugin.configs.recommended.rules,
      '@next/next/no-html-link-for-pages': 'warn',
      '@next/next/no-sync-scripts': 'warn',
      'react-hooks/exhaustive-deps': 'error',
      'react/no-unescaped-entities': 'error',
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  {
    files: ['**/playwright.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    rules: prettierConfig.rules,
  }
);
