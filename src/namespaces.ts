import { pg } from "./globals.ts";
import { upcaseFirst } from "./tools.ts";
export const setNamespaces = () => {
    pg.nsSpecialId = -1;
    pg.nsMainspaceId = 0;
    pg.nsImageId = 6;
    pg.nsUserId = 2;
    pg.nsUsertalkId = 3;
    pg.nsCategoryId = 14;
    pg.nsTemplateId = 10;
};
export const setRedirs = () => {
    const r = "redirect";
    const R = "REDIRECT";
    const redirLists: Partial<Record<string, (string | RegExp)[]>> = {
        ar: [R, "تحويل"],
        be: [r, "перанакіраваньне"],
        bg: [r, "пренасочване", "виж"],
        bs: [r, "Preusmjeri", "preusmjeri", "PREUSMJERI"],
        bn: [R, "পুনর্নির্দেশ"],
        cs: [R, "PŘESMĚRUJ"],
        cy: [r, "ail-cyfeirio"],
        de: [R, "WEITERLEITUNG"],
        el: [R, "ΑΝΑΚΑΤΕΥΘΥΝΣΗ"],
        eo: [R, "ALIDIREKTU", "ALIDIREKTI"],
        es: [R, "REDIRECCIÓN"],
        et: [r, "suuna"],
        ga: [r, "athsheoladh"],
        gl: [r, "REDIRECCIÓN", "REDIRECIONAMENTO"],
        he: [R, "הפניה"],
        hu: [R, "ÁTIRÁNYÍTÁS"],
        is: [r, "tilvísun", "TILVÍSUN"],
        it: [R, "RINVIA", "Rinvia"],
        ja: [R, "転送"],
        mk: [r, "пренасочување", "види"],
        nds: [r, "wiederleiden"],
        "nds-nl": [R, "DEURVERWIEZING", "DUURVERWIEZING"],
        nl: [R, "DOORVERWIJZING"],
        nn: [r, "omdiriger"],
        pl: [R, "PATRZ", "PRZEKIERUJ", "TAM"],
        pt: [R, "redir"],
        ru: [R, "ПЕРЕНАПРАВЛЕНИЕ", "ПЕРЕНАПР"],
        sk: [r, "presmeruj"],
        sr: [r, "Преусмери", "преусмери", "ПРЕУСМЕРИ", "Preusmeri", "preusmeri", "PREUSMERI"],
        tt: [R, "yünältü", "перенаправление", "перенапр"],
        uk: [R, "ПЕРЕНАПРАВЛЕННЯ", "ПЕРЕНАПР"],
        vi: [r, "đổi"],
        yi: [R, "ווייטערפירן"],
        zh: [R, "重定向"],
    };
    const redirList: (string | RegExp)[] = redirLists[pg.wiki.lang] ?? [r, R];
    pg.re.redirect = RegExp(`^\\s*[#](${redirList.join("|")}).*?\\[{2}([^\\|\\]]*)(|[^\\]]*)?\\]{2}\\s*(.*)`, "i");
};
export const setInterwiki = () => {
    if (pg.wiki.lang === "zh") {
        pg.wiki.interwiki = "en|ja";
    } else if (pg.wiki.lang === "en") {
        pg.wiki.interwiki = "zh|ja";
    } else if (pg.wiki.lang === "ja") {
        pg.wiki.interwiki = "zh|en";
    }
    pg.re.interwiki = RegExp(`^${pg.wiki.interwiki}:`);
};
export const nsRe = (namespaceId?: number) => {
    const imageNamespaceVariants: string[] = [];
    $.each(mw.config.get("wgNamespaceIds"), (_localizedNamespaceLc: string, _namespaceId: number) => {
        const localizedNamespaceLc = upcaseFirst(_localizedNamespaceLc);
        if (_namespaceId !== namespaceId) {
            return;
        }
        imageNamespaceVariants.push(mw.util.escapeRegExp(localizedNamespaceLc).split(" ").join("[ _]"));
        imageNamespaceVariants.push(mw.util.escapeRegExp(encodeURI(localizedNamespaceLc)));
    });
    return `(?:${imageNamespaceVariants.join("|")})`;
};
export const nsReImage = () => nsRe(pg.nsImageId);
