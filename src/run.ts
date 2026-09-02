import { autoEdit } from "./autoedit.ts";
import { setupPopups } from "./init.ts";
export const run = () => {
    autoEdit();
    setupPopups();
};
