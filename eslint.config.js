import { configs } from "@annangela/eslint-config";

export default [
    {
        // Global ignores (exclusive object). src/ fragments are syntactically
        // incomplete slices (the file opens in _header.js and closes in run.js);
        // only the concatenated artifact in dist/ is lintable.
        ignores: [
            "node_modules",
            ".cache",
            "src",
        ],
    },
    {
        ...configs.base,
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
