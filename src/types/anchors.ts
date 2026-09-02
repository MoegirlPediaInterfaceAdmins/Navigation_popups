// The gadget attaches the popup object to the anchor that opened it.
import type { Navpopup } from "../navpopup.ts";

declare global {
    interface HTMLAnchorElement {
        navpopup?: Navpopup | null;
        // ad-hoc markers the gadget sets on tooltip anchors
        originalTitle?: string | null;
        popData?: ({ owner?: Navpopup } & Record<string, unknown>) | null;
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
