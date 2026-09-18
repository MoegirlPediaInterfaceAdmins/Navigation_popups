// The gadget attaches the popup object to the anchor that opened it.
import type { Navpopup } from "../modules/navpopup.ts";

declare global {
    interface HTMLAnchorElement {
        navpopup?: Navpopup | null;
        // ad-hoc markers the gadget sets on tooltip anchors
        originalTitle?: string | null;
        // `| undefined`: addTooltip(a) without popData assigns undefined here
        popData?: { owner?: Navpopup | undefined } & Record<string, unknown> | null | undefined;
        inNopopupSpan?: boolean;
        simpleNoMore?: boolean;
        hasPopup?: boolean;
        modifierKeyHandler?: (evt: Event) => void;
    }

    interface HTMLDivElement {
        navpopup?: Navpopup;
    }
}

export {};
