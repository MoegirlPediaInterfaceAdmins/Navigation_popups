// Core interface for the pg global object (module 1 of the typing effort).
// Domains start as loose records: every module stores heterogeneous runtime
// state on pg, and each domain gets a precise shape as the typing proceeds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional escape hatch: pg domains carry heterogeneous legacy state; each domain is tightened to a precise shape as the typing effort proceeds
export type AnyRecord = Record<string, any>;

export interface Pg {
    api: AnyRecord;
    re: AnyRecord;
    ns: AnyRecord;
    string: AnyRecord;
    wiki: AnyRecord;
    user: AnyRecord;
    misc: AnyRecord;
    option: AnyRecord;
    optionDefault: AnyRecord;
    flag: AnyRecord;
    cache: AnyRecord;
    structures: AnyRecord;
    timer: AnyRecord;
    counter: AnyRecord;
    current: AnyRecord;
    fn: AnyRecord;
    endoflist: null;
}
