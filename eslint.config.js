const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');

module.exports = [
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                fetch: 'readonly',
                requestAnimationFrame: 'readonly',
                requestIdleCallback: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            eqeqeq: ['warn', 'always'],
            curly: ['warn', 'all']
        }
    },
    {
        files: ['scripts/**/*.js', 'build.js', 'server.js', 'eslint.config.js'],
        languageOptions: {
            globals: {
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                console: 'readonly'
            }
        }
    },
    {
        files: ['src/sw.js'],
        languageOptions: {
            globals: {
                self: 'readonly',
                caches: 'readonly',
                URL: 'readonly',
                fetch: 'readonly',
                Promise: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly'
            }
        }
    },
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '*.min.js',
            'package-lock.json',
            // 工具产物 / 工作树，不参与 lint
            '.kilo/**',
            '.workbuddy/**',
            '.edgeone/**'
        ]
    }
];
