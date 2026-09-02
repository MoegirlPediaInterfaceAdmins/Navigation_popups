// The gadget attaches the popup object to the anchor that opened it.
import type { Navpopup } from "../navpopup.ts";

declare global {
    interface HTMLAnchorElement {
        navpopup?: Navpopup | null;
    }

    interface HTMLDivElement {
        navpopup?: Navpopup;
    }
}

export {};
