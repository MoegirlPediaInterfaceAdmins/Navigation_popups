// @ts-nocheck -- typing debt carried over from the upstream-synced JS sources; lifted file by file as the typing effort proceeds (see README)
/* eslint-disable -- legacy upstream-derived code; lint debt is retired file by file together with the ts-nocheck header (see README) */
import { autoEdit } from "./autoedit.ts";
import { setupPopups } from "./init.ts";
export const run = () => {
    autoEdit();
    setupPopups();
};
