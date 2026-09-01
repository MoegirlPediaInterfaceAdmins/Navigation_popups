import { configs } from "@annangela/eslint-config";

export default [
    {
        // Global ignores (exclusive object).
        ignores: [
            "node_modules",
            ".cache",
        ],
    },
    {
        ...configs.base,
    },
    {
        ...configs.browser,
        files: [
            "src/**/*",
        ],
        linterOptions: {
            // _header.js keeps the eslint-disable header for the *artifact's*
            // sake (it is a byte of the build output); in src linting those
            // rules are already off, so the directive is "unused" here.
            reportUnusedDisableDirectives: "off",
        },
        languageOptions: {
            ...configs.browser.languageOptions,
            globals: {
                ...configs.browser.languageOptions.globals,
                mw: false,
                mediaWiki: false,
                wgULS: false,
                wgUVS: false,
                moment: false,
            },
        },
        rules: {
            // Config-level equivalent of the eslint-disable header the original
            // single-file gadget carried: fragments reference each other's
            // top-level identifiers freely. Once sources become TypeScript
            // modules, unknown-name checking moves to tsc --noEmit.
            "no-undef": "off",
            "no-unused-vars": "off",
            "no-use-before-define": "off",
            camelcase: "off",
            // The concatenated artifact gets one global "use strict" from
            // _header.js (later from the bundler banner); fragments themselves
            // carry no directive.
            strict: "off",
            // Fragments keep the inner (4-space) indentation they had inside
            // the jQuery-ready wrapper of the original single file; sources get
            // re-printed when they become TypeScript modules.
            "@stylistic/indent": "off",
            // Same exemption MoegirlPediaInterfaceCodes applies to gadget sources.
            "promise/prefer-await-to-callbacks": "off",
        },
    },
    {
        ...configs.browser,
        files: [
            "dist/**/*",
        ],
        languageOptions: {
            ...configs.browser.languageOptions,
            globals: {
                ...configs.browser.languageOptions.globals,
                mw: false,
                mediaWiki: false,
                wgULS: false,
                wgUVS: false,
                moment: false,
            },
        },
    },
    {
        ...configs.node,
        files: [
            "scripts/**/*",
            "eslint.config.js",
        ],
        rules: {
            // Running in trusted environment (same exemptions as MoegirlPediaInterfaceCodes)
            "security/detect-unsafe-regex": "off",
            "security/detect-object-injection": "off",
            "security/detect-non-literal-fs-filename": "off",
            "security/detect-non-literal-regexp": "off",
            "security/detect-child-process": "off",
        },
    },
    // Same rule exemptions MoegirlPediaInterfaceCodes applies to its gadget sources.
    {
        rules: {
            "@stylistic/no-mixed-operators": "off",
        },
    },
    {
        files: [
            "dist/**/*",
        ],
        rules: {
            "promise/prefer-await-to-callbacks": "off",
        },
    },
];
