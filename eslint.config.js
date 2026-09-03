import { configs } from "@annangela/eslint-config";

export default [
    {
        // Global ignores (exclusive object). Note: neither src/ nor dist/ may
        // appear here — files listed in a global-ignores object are excluded
        // from every other config entry as well.
        ignores: [
            "node_modules",
            ".cache",
        ],
    },
    {
        ...configs.base,
    },
    {
        // Sources: full strict typescript-eslint set (strict-type-checked +
        // stylistic-type-checked, as shipped by @annangela/eslint-config).
        // no-undef is off for TS files — unknown names are owned by
        // tsc --noEmit (types-mediawiki/@types/jquery ambient declarations).
        ...configs.typescript,
        files: [
            "src/**/*.ts",
        ],
        languageOptions: {
            ...configs.typescript.languageOptions,
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
            ...configs.typescript.rules,
            "no-undef": "off",
            // Carried-over lint debt: legacy files carry "@ts-nocheck -- <reason>"
            // headers and a blanket eslint-disable, lifted file by file (README).
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": "allow-with-description",
                    "ts-nocheck": "allow-with-description",
                    "ts-ignore": true,
                    minimumDescriptionLength: 3,
                },
            ],
            "@eslint-community/eslint-comments/no-unlimited-disable": "off",
            // Upstream source shape is preserved verbatim where rewriting it
            // would hurt the sync workflow or change module-init order:
            // - no-use-before-define: upstream orders helpers bottom-up; const
            //   arrows cannot be reordered without changing module evaluation
            //   order (the dist banner has always disabled this rule too).
            // - camelcase: upstream identifiers (wpTextbox1, wikEdUseWikEd,
            //   last_attr…) are kept 1:1 so upstream patches still apply.
            "no-use-before-define": "off",
            camelcase: "off",
        },
    },
    {
        // The bundled artifact keeps the browser-preset gate (same config the
        // interface codes repo lints it with); its banner carries the
        // eslint-disable directives.
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
            "rollup.config.mjs",
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
            // Style rules (and this plugin specifically, which chokes on the
            // rollup IIFE wrapper) do not apply to generated output.
            "prefer-arrow-functions/prefer-arrow-functions": "off",
            // The artifact carries its global "use strict" in the banner; the
            // rollup IIFE adds a redundant function-level one.
            strict: "off",
            // esbuild strips plain comments when transpiling, so the upstream
            // "// fall through" notes that satisfy these comment-aware rules
            // in source form are gone from the artifact.
            "no-fallthrough": "off",
            "require-atomic-updates": "off",
            // Pure style rules do not apply to generated output (esbuild
            // prints its own formatting: single quotes, no trailing commas).
            "@stylistic/quotes": "off",
            "@stylistic/comma-dangle": "off",
            "@stylistic/space-before-function-paren": "off",
            "@stylistic/operator-linebreak": "off",
            "@stylistic/max-statements-per-line": "off",
            "@stylistic/indent": "off",
            "@stylistic/multiline-ternary": "off",
            "@stylistic/space-unary-ops": "off",
            "@stylistic/padded-blocks": "off",
        },
    },
];
