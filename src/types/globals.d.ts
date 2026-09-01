// Ambient declarations for site-provided globals (zh.moegirl.org.cn site-lib
// and gadgets) that have no public type packages. Types start loose and get
// tightened as the typing effort proceeds. This file is a global script
// declaration file on purpose (no imports/exports), so the declarations below
// land in the global scope.
declare const wgULS: (cn: string, tw: string) => string;
declare const wgUVS: (cn: string, tw: string) => string;
declare const moment: unknown;
declare const wikEdUseWikEd: boolean;
declare const WikEdUpdateFrame: () => void;

interface Window {
    pg?: unknown;
    popupDebug?: boolean;
    popupStrings?: Record<string, string>;
    popupNoTranslation?: Set<string>;
}

interface Element {
    // ad-hoc marker property the gadget sets on tooltip containers
    ranSetupTooltipsAlready?: boolean;
}
