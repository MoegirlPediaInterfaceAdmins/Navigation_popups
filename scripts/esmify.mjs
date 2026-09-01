// One-shot helper for the TypeScript/ESM migration:
//   node scripts/esmify.mjs --report   analyze only (side effects, dependency graph, cycles)
//   node scripts/esmify.mjs --apply    weave import statements and export prefixes
// Run from the repo root. Uses the TypeScript AST; the identifier analysis is
// a close approximation (local bindings minus references minus known globals),
// the compiler takes over for anything it misses afterwards.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { configs } from "@annangela/eslint-config";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const apply = process.argv.includes("--report") ? false : process.argv.includes("--apply");
if (!apply) {
    console.log("Mode: report");
}

const KNOWN_GLOBALS = new Set([
    ...Object.keys(configs.browser.languageOptions.globals ?? {}),
    // JS builtins are not part of the browser-globals table
    "Object", "Function", "Array", "String", "Number", "Boolean", "Math", "JSON", "RegExp", "Date", "Promise", "Set", "Map", "WeakSet", "WeakMap", "Symbol", "Proxy", "Reflect", "BigInt", "Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError", "AggregateError", "isNaN", "isFinite", "parseInt", "parseFloat", "encodeURI", "decodeURI", "encodeURIComponent", "decodeURIComponent", "escape", "unescape", "Intl",
    "mw",
    "mediaWiki",
    "jQuery",
    "wgULS",
    "wgUVS",
    "moment",
    "wikEdUseWikEd",
    "WikEdUpdateFrame",
]);

const files = (await fs.promises.readdir(srcDir)).filter((f) => /\.(js|ts)$/.test(f)).sort();
const sources = new Map();
for (const file of files) {
    sources.set(file, await fs.promises.readFile(path.join(srcDir, file), "utf8"));
}

const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);

const bindingNames = (name, into) => {
    if (!name) {
        return;
    }
    if (ts.isIdentifier(name)) {
        into.add(name.text);
    } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
        for (const element of name.elements) {
            if (ts.isBindingElement(element)) {
                bindingNames(element.name, into);
            }
        }
    }
};

const collectLocals = (sf) => {
    const names = new Set();
    const visit = (node) => {
        if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isCatchClause(node)) {
            bindingNames(node.name, names);
        } else if (
            ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)
            || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node)
        ) {
            bindingNames(node.name, names);
        } else if (ts.isImportClause(node) || ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
            bindingNames(node.name, names);
        }
        node.forEachChild(visit);
    };
    sf.forEachChild(visit);
    return names;
};

const collectRefs = (sf) => {
    const refs = new Set();
    const visit = (node) => {
        if (ts.isIdentifier(node)) {
            const parent = node.parent;
            const nonReference
                = ts.isPropertyAccessExpression(parent) && parent.name === node
                    || ts.isPropertyAssignment(parent) && parent.name === node
                    || ts.isPropertyDeclaration?.(parent) && parent.name === node
                    || ts.isGetAccessorDeclaration?.(parent) && parent.name === node
                    || ts.isSetAccessorDeclaration?.(parent) && parent.name === node
                    || ts.isMethodDeclaration(parent) && parent.name === node
                    || ts.isBindingElement(parent) && parent.propertyName === node
                    || ts.isPropertySignature?.(parent) && parent.name === node
                    || ts.isMethodSignature?.(parent) && parent.name === node
                    || ts.isLabeledStatement(parent) && parent.label === node;
            if (!nonReference) {
                refs.add(node.text);
            }
        }
        node.forEachChild(visit);
    };
    sf.forEachChild(visit);
    return refs;
};

const topLevelDeclarations = (sf) => {
    const decls = new Map();
    for (const stmt of sf.statements) {
        if (ts.isVariableStatement(stmt)) {
            // position of the whole statement so an `export` prefix lands
            // before any modifiers, never before a declaration name
            for (const declaration of stmt.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name)) {
                    decls.set(declaration.name.text, stmt.getStart(sf));
                }
            }
        } else if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && stmt.name) {
            decls.set(stmt.name.text, stmt.getStart(sf));
        }
    }
    return decls;
};

const ownerOf = new Map();
const fileData = new Map();
for (const [file, text] of sources) {
    const sf = parse(file, text);
    const decls = topLevelDeclarations(sf);
    for (const name of decls.keys()) {
        ownerOf.set(name, file);
    }
    fileData.set(file, {
        sf,
        decls,
        locals: collectLocals(sf),
        refs: collectRefs(sf),
    });
}

// --- top-level side effects (statements that do something at module scope)
console.log("\n== Top-level side effects (review: DOM access? order-sensitive? idempotent on double load?) ==");
for (const [file, { sf }] of fileData) {
    for (const stmt of sf.statements) {
        const isDeclaration = ts.isVariableStatement(stmt) || ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt);
        const isImport = ts.isImportDeclaration?.(stmt) ?? false;
        if (isDeclaration || isImport) {
            continue;
        }
        const line = sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1;
        const text = stmt.getText(sf).split("\n")[0].slice(0, 100);
        console.log(`${file}:${line}: ${text}`);
    }
}

// --- dependency graph
const dependencies = new Map();
const unresolved = new Map();
for (const [file, { locals, refs }] of fileData) {
    const needs = new Map();
    const missing = new Set();
    for (const ref of refs) {
        if (locals.has(ref) || KNOWN_GLOBALS.has(ref) || ref === "undefined") {
            continue;
        }
        const owner = ownerOf.get(ref);
        if (owner === undefined || owner === file) {
            if (owner === undefined) {
                missing.add(ref);
            }
            continue;
        }
        if (!needs.has(owner)) {
            needs.set(owner, new Set());
        }
        needs.get(owner).add(ref);
    }
    dependencies.set(file, needs);
    unresolved.set(file, missing);
}

// --- cycles
const cycleEdges = [];
const state = new Map();
const dfs = (node, stack) => {
    state.set(node, 1);
    for (const target of dependencies.get(node)?.keys() ?? []) {
        if (state.get(target) === 1) {
            cycleEdges.push([...stack.slice(stack.indexOf(target)), target].join(" -> "));
        } else if (!state.has(target)) {
            dfs(target, [...stack, target]);
        }
    }
    state.set(node, 2);
};
for (const file of files) {
    if (!state.has(file)) {
        dfs(file, [file]);
    }
}

console.log("\n== Import plan ==");
for (const [file, needs] of dependencies) {
    const lines = [...needs.entries()].map(([owner, names]) => `${owner}: { ${[...names].sort().join(", ")} }`);
    console.log(`${file}\n    ${lines.join("\n    ")}`);
    const missing = unresolved.get(file);
    if (missing.size > 0) {
        console.log(`    UNRESOLVED (add to KNOWN_GLOBALS or fix): ${[...missing].sort().join(", ")}`);
    }
}
console.log("\n== Cycles ==");
if (cycleEdges.length === 0) {
    console.log("(none)");
} else {
    for (const edge of [...new Set(cycleEdges)]) {
        console.log(edge);
    }
}

if (apply) {
    for (const [file, { decls }] of fileData) {
        const text = sources.get(file);
        const needs = dependencies.get(file);
        const exportedNames = new Set();
        for (const needs of dependencies.values()) {
            for (const nameSet of needs.values()) {
                for (const name of nameSet) {
                    if (ownerOf.get(name) === file) {
                        exportedNames.add(name);
                    }
                }
            }
        }
        const importLines = [];
        for (const [owner, names] of [...needs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            importLines.push(`import { ${[...names].sort().join(", ")} } from "./${path.basename(owner).replace(/\.(js|ts)$/, "")}.ts";`);
        }
        const sortedDeclPositions = [...decls.entries()]
            .filter(([name]) => exportedNames.has(name))
            .map(([, pos]) => pos)
            .sort((a, b) => b - a);
        let output = text;
        for (const position of sortedDeclPositions) {
            // Insertions happen in descending position order, so earlier
            // insertions (further down the file) never shift these positions.
            if (output.slice(position, position + 7) === "export ") {
                continue;
            }
            output = `${output.slice(0, position)}export ${output.slice(position)}`;
        }
        if (importLines.length > 0) {
            output = `${importLines.join("\n")}\n${output}`;
        }
        if (output !== text) {
            await fs.promises.writeFile(path.join(srcDir, file), output);
            console.log(`Wrote ${file}: ${importLines.length} import line(s), ${sortedDeclPositions.length} export(s)`);
        }
    }
}
