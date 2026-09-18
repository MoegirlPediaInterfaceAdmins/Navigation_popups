import { configs } from "@annangela/eslint-config";

export default [
    {
        // Global ignores (exclusive object). Note: neither src/ nor dist/ may
        // appear here — files listed in a global-ignores object are excluded
        // from every other config entry as well.
        ignores: [
            "node_modules",
            ".cache",
            "coverage",
            "**/.*/**",
            // .husky/ 是点目录、会被上一条 `**/.*/**` 整体忽略，而其中的 .mjs 是需要检查的源码，
            // 需显式反忽略才能被 lint（与旧仓同款）。
            "!.husky/*.mjs",
            // tsc es2020 emit 的中间产物（terser-check 门禁生成后即删，此处兜底残留）
            "dist/_compiled",
        ],
    },
    {
        ...configs.base,
    },
    {
        // Sources: full strict typescript-eslint set (strict-type-checked +
        // stylistic-type-checked, as shipped by @annangela/eslint-config).
        ...configs.typescript,
        files: [
            "src/**/*.ts",
            "tests/**/*.ts",
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
                // runtime globals owned by the wikEd gadget when it is present
                wikEdUseWikEd: false,
                WikEdUpdateFrame: false,
                // type-position-only names: no-undef cannot distinguish type
                // positions from value positions, so ambient types must be
                // declared here; a value-position misuse is still caught by
                // tsc (TS2693: "only refers to a type").
                JQuery: false,
                HTMLCollectionOf: false,
                EventListener: false,
                GlobalEventHandlers: false,
            },
        },
        rules: {
            ...configs.typescript.rules,
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
        // The event/XHR flow is callback-driven by design; the
        // interface codes repo turns this rule off for all browser files, so
        // both the sources and the artifact follow suit (keeping it off in
        // the banner would surface as an unused directive over there).
        files: [
            "src/**/*.ts",
            "tests/**/*.ts",
            "dist/**/*",
        ],
        rules: {
            "promise/prefer-await-to-callbacks": "off",
        },
    },
    {
        // The bundled artifact keeps the browser-preset gate. The interface
        // codes repo ignores its own **/dist/** but lints the synced-back
        // artifact (which lands under src/gadgets/Navigation_popups/) with
        // base+browser settings, so this entry mirrors that; every rule the
        // generated output cannot satisfy is disabled in the artifact banner
        // instead (config and banner must not both carry a rule — the losing
        // side would be an unused directive).
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
            ".husky/*.mjs",
            "rollup.config.js",
            "eslint.config.js",
            "commitlint.config.mjs",
            "vitest.config.ts",
        ],
        rules: {
            // Running in trusted environment (same exemptions as MoegirlPediaInterfaceCodes)
            "security/detect-unsafe-regex": "off",
            "security/detect-object-injection": "off",
            "security/detect-non-literal-fs-filename": "off",
            "security/detect-non-literal-regexp": "off",
            "security/detect-child-process": "off",
            "n/no-extraneous-import": "off",
            "n/no-process-exit": "off",

            // Node version specified in package.json (same wiring as MoegirlPediaInterfaceCodes)
            "n/no-unsupported-features/es-builtins": ["error", { version: ">=24.11.0" }],
            "n/no-unsupported-features/node-builtins": ["error", { version: ">=24.11.0" }],
            "n/no-unsupported-features/es-syntax": ["error", { version: ">=24.11.0" }],

            // github api use underscores naming (allow list carried over from
            // MoegirlPediaInterfaceCodes so the ported scripts stay verbatim)
            camelcase: [
                "error",
                {
                    allow: [
                        "pull_number",
                        "issue_number",
                        "head_commit",
                        "commit_long",
                        "state_reason",
                        "workflow_id",
                        "exclude_pull_requests",
                        "commit_sha",
                        "job_id",
                        "run_id",
                        "per_page",
                        "workflow_runs",
                        "key_id",
                        "raw_key",
                    ],
                },
            ],
        },
    },
    // Same rule exemptions MoegirlPediaInterfaceCodes applies to its gadget sources.
    {
        rules: {
            "@stylistic/no-mixed-operators": "off",
        },
    },
    {
        // House type-conversion convention: Boolean(x) → !!x, Number(x) → +x.
        // The selector matches call sites only, so property accesses like
        // Number.MAX_SAFE_INTEGER stay legal.
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector: "CallExpression[callee.name='Boolean']",
                    message: "Use !! instead of Boolean().",
                },
                {
                    selector: "CallExpression[callee.name='Number']",
                    message: "Use unary + instead of Number().",
                },
            ],
        },
    },
];
