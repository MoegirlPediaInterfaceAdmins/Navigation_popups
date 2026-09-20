// 阶段 2 端到端验收：mock API（XHR 桩）驱动的完整条目预览链路——从
// pipeline.startArticlePreview 发起 revision 查询，经真实的 queries →
// cache/downloader → XHR 桩 → showAPIPreview/insertPreview → pageinfo 统计
// trailer → Previewmaker/showPreview → insta.wiki2html，最终落弹窗槽位。
// 唯一桩：installMw（mw 全局）与 installXhr（网络层）；queries/pipeline/
// cache/downloader/previewmaker/insta/pageinfo 全部真实模块（无 vi.mock）。
// 装配约定照 tests/integration/hover.test.ts（fresh 模块图 + wiki fixtures +
// htmlout 回调注销）与 tests/unit/api/queries.test.ts（站点态直赋）；
// 站点派生正则（image/category/disambig/stub/ipUser）按 legacy init.ts
// setRegexps 公式就地装配。
// 覆盖用例：普通条目完整预览、重定向跟随（二次 revision 查询）、history 表格
// 预览、图片页 imagepagepreview+loadImage 双请求、两条惰性路径（下载/预览）。
import moment from "moment";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { installMw, type MockMw } from "../helpers/mockMw.ts";
import { installXhr, type MockXhrResponse } from "../helpers/mockXhr.ts";
import { buildTitleWikiFixtures, SITEBASE, TITLEBASE } from "../helpers/wikiFixtures.ts";
import { assume } from "../../src/core/tools.ts";
import type * as HtmloutNs from "../../src/core/htmlout.ts";
import type * as ImagesNs from "../../src/preview/images.ts";
import type * as InstaNs from "../../src/preview/insta.ts";
import type * as NamespacesNs from "../../src/title/namespaces.ts";
import type * as OptionsNs from "../../src/core/options.ts";
import type * as PipelineNs from "../../src/preview/pipeline.ts";
import type * as PopupNs from "../../src/core/popup.ts";
import type * as QueriesNs from "../../src/api/queries.ts";
import type * as SiteinfoNs from "../../src/api/siteinfo.ts";
import type * as TitleNs from "../../src/title/title.ts";

type Htmlout = typeof HtmloutNs;
type Images = typeof ImagesNs;
type Insta = typeof InstaNs;
type Namespaces = typeof NamespacesNs;
type OptionsModule = typeof OptionsNs;
type Pipeline = typeof PipelineNs;
type Popup = typeof PopupNs;
type Queries = typeof QueriesNs;
type Siteinfo = typeof SiteinfoNs;
type TitleModule = typeof TitleNs;

interface Fresh {
    htmlout: Htmlout;
    images: Images;
    insta: Insta;
    namespaces: Namespaces;
    options: OptionsModule;
    pipeline: Pipeline;
    popup: Popup;
    queries: Queries;
    siteinfo: Siteinfo;
    title: TitleModule;
    mw: MockMw;
}

interface FreshOptions {
    /** mw.user.options 覆盖（history 的 0|0 时区偏移走格式化确定性路径） */
    userOptions?: Record<string, string>;
    /** window.popupXxx 用户覆盖（惰性开关等；getValueOf 首读前写入） */
    windowOverrides?: Record<string, unknown>;
}

const APIBASE = `https://${SITEBASE}/api.php`;
const ARTICLEBASE = `https://${SITEBASE}/wiki`;
const API_PREFIX = `${APIBASE}?format=json&formatversion=2&action=query&`;

// legacy options.ts 的选项默认值（站点派生正则的模式源）
const DAB_REGEXP_SOURCE = "disambiguation\\}\\}|\\{\\{\\s*(d(ab|isamb(ig(uation)?)?)|(((geo|hn|road?|school|number)dis)|[234][lc][acw]|(road|ship)index))\\s*(\\|[^}]*)?\\}\\}|is a .*disambiguation.*page";
const STUB_REGEXP_SOURCE = "(sect)?stub[}][}]|This .*-related article is a .*stub";
const IMAGE_VARS_REGEXP = "image|image_(?:file|skyline|name|flag|seal)|cover|badge|logo";
// legacy init.ts setRegexps 的 IP 用户名匹配常量（editPreviewTable 的 IP 分支）
const IP_USER_REGEXP_SOURCE = "^(?::(?::|(?::[0-9A-Fa-f]{1,4}){1,7})|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6}::|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){7})|(((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9]))$";

// 普通条目 wikitext：多句 + 管道内链 + 模板（无子页面/文件/分类链——正文
// 无文件链时 insertPreviewNow 不发图查询，pending 只在 revision 一次上下浮动）
const ARTICLE_WIKITEXT = "'''Alpha''' is the first sentence. Second sentence links to [[Target page|another article]]. Third sentence mentions {{Cleanup}} a template.";
// 重定向目标 wikitext（同样无双括号文件链）
const TARGET_WIKITEXT = "'''Target''' is the redirect target body. It has a [[Link page|link]].";
// 重定向条目的 revision 正文（命中 nsState.re.redirect 的 zh 分支）
const REDIRECT_WIKITEXT = "#REDIRECT [[Target page]]";
// 图片页 wikitext（File 命名空间只走 killHTML 分支，wiki 标记原样进 wiki2html）
const FILE_WIKITEXT = "'''示例文件''' 的说明文字。第二句。";

let windowOptionKeys: string[] = [];

const fresh = async (opts: FreshOptions = {}): Promise<Fresh> => {
    vi.resetModules();
    // exactOptionalPropertyTypes：未给的键不能显式落 undefined
    const installed = installMw({
        ...opts.userOptions ? { userOptions: opts.userOptions } : {},
    });
    // 站点运行时由站点注入全局 moment；测试用 node_modules 里的真 moment
    // （getPageInfo 的「最后修改」过滤器必需）
    vi.stubGlobal("moment", moment);
    const [htmlout, images, insta, namespaces, options, pipeline, popup, queries, siteinfo, title] = await Promise.all([
        import("../../src/core/htmlout.ts"),
        import("../../src/preview/images.ts"),
        import("../../src/preview/insta.ts"),
        import("../../src/title/namespaces.ts"),
        import("../../src/core/options.ts"),
        import("../../src/preview/pipeline.ts"),
        import("../../src/core/popup.ts"),
        import("../../src/api/queries.ts"),
        import("../../src/api/siteinfo.ts"),
        import("../../src/title/title.ts"),
    ]);
    namespaces.setNamespaces();
    namespaces.setRedirs();
    options.setOptions();
    buildTitleWikiFixtures(installed.mw, title.wiki, namespaces);
    // 站点态直赋而非调 site.setSiteInfo/setTitleBase：setter 取 location.hostname
    // （jsdom 的 localhost）会与 fixtures 的 zh.moegirl.org.cn 基址错位
    siteinfo.siteState.apiwikibase = APIBASE;
    siteinfo.siteState.articlebase = ARTICLEBASE;
    siteinfo.siteState.titlebase = TITLEBASE;
    // 站点派生正则（legacy init.ts setRegexps 公式）：image/category 供
    // getPageInfo 统计与 getValidImageFromWikiText，disambig/stub 供过滤器，
    // ipUser 供 editPreviewTable
    const im = namespaces.nsRe(namespaces.nsState.imageId);
    title.wiki.re.image = RegExp(
        `(^|\\[\\[)${im}: *([^|\\]]*[^|\\] ])([^0-9\\]]*([0-9]+) *px)?|(?:\\n *[|]?|[|]) *(${IMAGE_VARS_REGEXP}) *= *(?:\\[\\[ *)?(?:${im}:)?([^|]*?)(?:\\]\\])? *[|]? *\\n`,
        "img",
    );
    title.wiki.re.imageBracketCount = 6;
    title.wiki.re.category = RegExp(`\\[\\[${namespaces.nsRe(namespaces.nsState.categoryId)}: *([^|\\]]*[^|\\] ]) *`, "i");
    title.wiki.re.categoryBracketCount = 1;
    title.wiki.re.disambig = RegExp(DAB_REGEXP_SOURCE, "im");
    title.wiki.re.stub = RegExp(STUB_REGEXP_SOURCE, "im");
    title.wiki.re.ipUser = RegExp(IP_USER_REGEXP_SOURCE);
    // wiki2html 的条目链接基址（previewmaker 读 instaConf.paths.articles）
    insta.setupLivePreview({
        articlePath: "/wiki",
        interwiki: "en|ja",
        imageNamespace: "File",
        categoryNamespace: "Category",
    });
    htmlout.registerPositionChecker(null);
    htmlout.registerTooltipScanner(null);
    for (const [key, value] of Object.entries(opts.windowOverrides ?? {})) {
        (window as unknown as Record<string, unknown>)[key] = value;
        windowOptionKeys.push(key);
    }
    return { htmlout, images, insta, namespaces, options, pipeline, popup, queries, siteinfo, title, mw: installed.mw };
};

// 弹窗夹具：Navpopup 实例 + 真实骨架（popupHTML 产出，槽 id 契约
// popup<槽名><idNumber>）+ #content 语境下的宿主锚点。骨架注入对应真实装配里
// events.simplePopupContent 的动作（悬停装配属阶段 3），此处按该产出手工装配。
const popupFor = (f: Fresh, name: string, visible = true, alt?: string): { navpop: PopupNs.Navpopup; article: TitleNs.Title; anchor: HTMLAnchorElement } => {
    const anchor = document.createElement("a");
    anchor.href = `${TITLEBASE}${name}`;
    if (alt) {
        // 图片链接形态（parentAnchor.childNodes[0] 是 img）：APIimagepagePreviewHTML
        // 的 alt 分支据此取文本
        const img = document.createElement("img");
        img.alt = alt;
        anchor.append(img);
    } else {
        anchor.append(document.createTextNode(name));
    }
    document.body.append(anchor);
    const navpop = new f.popup.Navpopup();
    navpop.idNumber = 1;
    navpop.visible = visible;
    const article = new f.title.Title(name);
    navpop.article = article;
    navpop.parentAnchor = anchor;
    // popupHTML 只消费 PopupLike 的 idNumber/parentAnchor
    navpop.setInnerHTML(f.htmlout.popupHTML({ navpopup: { idNumber: 1, parentAnchor: anchor } }));
    return { navpop, article, anchor };
};

const slot = (name: string): string => document.getElementById(`${name}1`)?.innerHTML ?? "";
const ok = (responseText: string): MockXhrResponse => ({ status: 200, responseText });

interface RevisionFixture {
    wikibaseItem?: string;
    timestamp?: string;
    user?: string;
    comment?: string;
}

// action=query&prop=revisions|pageprops 的单页响应（formatversion=2 形态；
// revisions[0].slots.main.content 承载 wikitext，pageprops 供 wikibase 过滤器）
const revisionJson = (title: string, content: string, fixture: RevisionFixture = {}): string => JSON.stringify({
    query: {
        pages: {
            1: {
                title,
                revisions: [
                    {
                        revid: 101,
                        timestamp: fixture.timestamp ?? "2026-01-02T03:04:05Z",
                        user: fixture.user ?? "Alice",
                        comment: fixture.comment ?? "修订摘要",
                        slots: { main: { contentmodel: "wikitext", content } },
                    },
                ],
                ...fixture.wikibaseItem ? { pageprops: { wikibase_item: fixture.wikibaseItem } } : {},
            },
        },
        // meta=wikibase：pageinfo 的 wikibase 过滤器据此拼 link（base + articlepath）
        wikibase: { repo: { url: { base: "https://www.wikibase.org/wiki/", articlepath: "$1" } } },
    },
});

// history 响应：同日两行 + 跨日第三行（日期行/奇偶行类/IP 用户/隐藏版本全覆盖）
const HISTORY_JSON = JSON.stringify({
    query: {
        pages: {
            1: {
                title: "Foo",
                revisions: [
                    { revid: 100, timestamp: "2026-01-02T03:04:05Z", user: "Alice", comment: "修订摘要", minor: true },
                    { revid: 99, timestamp: "2026-01-02T02:00:00Z", user: "192.0.2.5", comment: "/* 章节 */ 内容补充" },
                    { revid: 98, timestamp: "2025-12-31T23:00:00Z", user: "Bob", userhidden: true, commenthidden: true },
                ],
            },
        },
    },
});

// imagepagepreview 响应：wikitext 正文（预览段）+ imagerepository=local
// （不触发 mw.loader 的共享资源页加载）；imageusage 缺省 → popupPostPreview
// 收到「未找到文件链接」
const IMAGEPAGE_JSON = JSON.stringify({
    query: {
        pages: {
            6: {
                title: "File:Example.jpg",
                imagerepository: "local",
                revisions: [
                    {
                        revid: 7,
                        timestamp: "2026-01-02T03:04:05Z",
                        user: "Uploader",
                        comment: "上传",
                        slots: { main: { contentmodel: "wikitext", content: FILE_WIKITEXT } },
                    },
                ],
            },
        },
    },
});

// loadImage 的 imageinfo 响应（thumburl 命中 → popupImg.src 取缩略图）
const IMAGEINFO_JSON = JSON.stringify({
    query: {
        pages: {
            6: {
                imageinfo: [
                    {
                        thumburl: "https://img.example/thumb.jpg",
                        url: "https://img.example/full.jpg",
                        mime: "image/jpeg",
                        descriptionurl: "https://zh.moegirl.org.cn/index.php?title=File:Example.jpg",
                    },
                ],
            },
        },
    },
});

// 时区敏感断言（trailer 的「最后修改」过滤器经 moment 本地日历字段）锁 UTC；
// history 的日期/时间走 userOptions timecorrection=0|0 的 UTC 偏移路径，本身
// 与环境时区无关。
beforeAll(() => {
    vi.stubEnv("TZ", "UTC");
});

afterAll(() => {
    vi.unstubAllEnvs();
});

afterEach(() => {
    for (const key of windowOptionKeys) {
        Reflect.deleteProperty(window, key);
    }
    windowOptionKeys = [];
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
});

describe("端到端：条目预览（阶段 2 验收）", () => {
    it("普通条目：revision 查询 → 统计 trailer + wiki2html 渲染落槽，pending 归零", async () => {
        const f = await fresh();
        const { sent } = installXhr(() => ok(revisionJson("Foo", ARTICLE_WIKITEXT, { wikibaseItem: "Q42" })));
        const { navpop, article } = popupFor(f, "Foo");
        f.pipeline.startArticlePreview(article, null, navpop);
        // 请求已发出、任务计数 +1（下载回调尚未跑，pending 未平衡）
        expect(sent).toHaveLength(1);
        expect(navpop.pending).toBe(1);
        expect(navpop.originalArticle).toBe(article);
        await vi.waitFor(() => {
            expect(navpop.pending).toBe(0);
        });
        // 立即路径（visible=true）：不挂任何惰性 hook
        expect(navpop.hookIds).toEqual({});
        // 唯一请求 = revision 查询（无 oldid → titles 分支）；正文无文件链 → 无图查询
        expect(sent).toHaveLength(1);
        expect(sent[0].url).toBe(`${API_PREFIX}titles=Foo&prop=revisions|pageprops|info|images|categories&meta=wikibase&rvslots=main&rvprop=ids|timestamp|flags|comment|user|content&cllimit=max&imlimit=max`);
        // wiki2html 产物落 popupPreview 槽：段落包裹、粗体、内链 href 走 insta 基址
        const preview = slot("popupPreview");
        expect(preview).toContain("<p>");
        expect(preview).toContain("<b>Alpha</b>");
        expect(preview).toContain('href="/wiki/Target page"');
        expect(preview).toContain(">another article</a>");
        // 模板被 killTemplates 清掉，仅剩前后正文
        expect(preview).toContain("Third sentence mentions");
        expect(preview).not.toContain("Cleanup");
        expect(preview).not.toContain("{{");
        // 全文进预览（未截断）→ 分隔线与 more 槽契约
        expect(document.getElementById("popupPrePreviewSep1")?.innerHTML).toBe("<hr>");
        expect(slot("popupPreviewMore")).toBe("");
        // 统计 trailer（getPageInfo：字节/链/文件/分类/最后修改/wikibase 顺序，逗号连接）
        const trailer = slot("popupData");
        expect(trailer).toMatch(/\d+&nbsp;字节/);
        expect(trailer).toContain("1&nbsp;个内部链接");
        expect(trailer).toContain("0&nbsp;个文件");
        expect(trailer).toContain("0&nbsp;个分类");
        expect(trailer).toContain('href="https://www.wikibase.org/wiki/Q42"');
        expect(trailer).toContain(">Q42</a>");
        expect(navpop.redir).toBe(0);
    });

    it("重定向条目：首次 revision 返回 #REDIRECT → 自动二次查询目标，提示槽与目标预览就位", async () => {
        const f = await fresh();
        const { sent } = installXhr((request) => ok(request.url.includes("titles=Target_page")
            ? revisionJson("Target page", TARGET_WIKITEXT)
            : revisionJson("Foo", REDIRECT_WIKITEXT)));
        const { navpop, article } = popupFor(f, "Foo");
        f.pipeline.startArticlePreview(article, null, navpop);
        await vi.waitFor(() => {
            expect(navpop.redir).toBe(1);
        });
        const target = assume(navpop.redirTarget);
        expect(target.value).toBe("Target page");
        // 弹窗当前条目换成目标、originalArticle 不被跟随后的 loadPreview 覆写
        expect(navpop.article).toBe(target);
        expect(navpop.originalArticle).toBe(article);
        // 重定向提示槽：redirLink 默认形态（hr + 重定向至）；innerHTML 往返去自闭合斜杠
        expect(slot("popupWarnRedir")).toBe("<hr>重定向至");
        // 跟随后的第二次 revision 查询（oldid 归零 → titles 分支，空格转下划线）
        expect(sent).toHaveLength(2);
        expect(sent[0].url).toContain("titles=Foo&prop=revisions");
        expect(sent[1].url).toContain("titles=Target_page&prop=revisions");
        expect(sent[1].url).not.toContain("revids=");
        // 目标条目内容接管预览槽与统计槽，两次下载计数平衡
        await vi.waitFor(() => {
            expect(slot("popupPreview")).toContain("redirect target body");
        });
        expect(slot("popupPreview")).toContain("<b>Target</b>");
        expect(slot("popupPreview")).toContain('href="/wiki/Link page"');
        expect(slot("popupData")).toContain("1&nbsp;个内部链接");
        expect(navpop.pending).toBe(0);
        expect(navpop.hookIds).toEqual({});
    });

    it("历史预览：history 查询 JSON → editPreviewTable 表格结构落 popupPreview 槽", async () => {
        // 0|0 → formattedDate/Time 走 UTC 偏移路径，日期/时间断言与环境时区无关
        const f = await fresh({ userOptions: { timecorrection: "0|0" } });
        const { sent } = installXhr(() => ok(HISTORY_JSON));
        const { navpop } = popupFor(f, "Foo");
        f.queries.loadAPIPreview("history", new f.title.Title("Foo"), navpop);
        await vi.waitFor(() => {
            expect(slot("popupPreview")).toContain("popup_history_date");
        });
        expect(sent).toHaveLength(1);
        expect(sent[0].url).toBe(`${API_PREFIX}titles=Foo&prop=revisions&rvlimit=25`);
        const html = slot("popupPreview");
        // 日期行：同日第二行不重复出日期行，跨日出新日期行
        expect(html).toContain('<span class="popup_history_date">2026-01-02</span>');
        expect(html).toContain('<span class="popup_history_date">2025-12-31</span>');
        // 行奇偶类 + 时间链接（UTC）
        expect(html).toContain('class="popup_history_row_even"');
        expect(html).toContain('class="popup_history_row_odd"');
        expect(html).toContain(">03:04:05</a>");
        expect(html).toContain(">02:00:00</a>");
        // 首列 cur/last 链接（firstRevid=100 进 diff 参数）
        expect(html).toContain(`href="${TITLEBASE}Foo&amp;diff=100&amp;oldid=100">当前</a>`);
        expect(html).toContain(`href="${TITLEBASE}Foo&amp;diff=prev&amp;oldid=99">之前</a>`);
        expect(html).toContain("&nbsp;|&nbsp;");
        // 用户列（普通用户 / IP 用户走 Special:Contributions）
        expect(html).toContain(`href="${TITLEBASE}User:Alice">Alice</a>`);
        expect(html).toContain("Special:Contributions&amp;target=192.0.2.5");
        // 摘要列：普通文本、/* 章节 */ 的 autocomment 渲染、隐藏版本回退文案
        expect(html).toContain("修订摘要");
        expect(html).toContain('class="autocomment"');
        expect(html).toContain("章节");
        expect(html).toContain("历史版本被隐藏");
        expect(html).toContain("<b>小 </b>");
        expect(navpop.pending).toBe(0);
    });

    it("图片页预览：imagepagepreview 与 loadImage 双请求 → 预览槽 + popupImg 更新", async () => {
        const f = await fresh();
        const { sent } = installXhr((request) => ok(request.url.includes("iiprop=url|mime")
            ? IMAGEINFO_JSON
            : IMAGEPAGE_JSON));
        const { navpop, article } = popupFor(f, "File:Example.jpg", true, "示例缩略图");
        // popupImage 槽的 img 骨架：槽填充器（navlinks 域注册）尚未接线，按
        // htmlout.imageHTML 的同一产物预置（id 双契约 popupImageLink/popupImg）
        const imageHost = document.getElementById("popupImage1");
        expect(imageHost).not.toBeNull();
        assume(imageHost).innerHTML = f.htmlout.imageHTML(1);
        f.queries.loadAPIPreview("imagepagepreview", article, navpop);
        f.images.loadImage(article, navpop);
        await vi.waitFor(() => {
            expect(slot("popupPreview")).toContain("示例文件");
        });
        // 双请求：revisions|imageinfo 正文查询 与 imageinfo 缩略图查询
        expect(sent).toHaveLength(2);
        expect(sent[0].url).toBe(`${API_PREFIX}titles=File:Example.jpg&prop=revisions|imageinfo&rvslots=main&rvprop=content&list=imageusage&iutitle=File:Example.jpg`);
        expect(sent[1].url).toBe(`${API_PREFIX}prop=imageinfo&iiprop=url|mime&iiurlwidth=200&titles=File:Example.jpg`);
        // alt 分支（parentAnchor 首子节点是提前置入的 img）+ File 命名空间正文
        const preview = slot("popupPreview");
        expect(preview).toContain("替换文本（Alt）：</b> 示例缩略图");
        expect(preview).toContain("<b>示例文件</b>");
        expect(preview).toContain("的说明文字");
        expect(slot("popupData")).toContain("0&nbsp;个内部链接");
        // imagelinks 内槽走无 imageusage 路径
        expect(slot("popupPostPreview")).toContain("未找到文件链接");
        // 缩略图回填 popupImg：src/display/宽度 与容器链接行为
        const img = document.getElementById("popupImg1") as HTMLImageElement | null;
        expect(img).not.toBeNull();
        expect(assume(img).src).toBe("https://img.example/thumb.jpg");
        expect(assume(img).style.display).toBe("inline");
        expect(assume(img).width).toBe(60);
        const imageLink = document.getElementById("popupImageLink1") as HTMLAnchorElement | null;
        expect(imageLink).not.toBeNull();
        expect(assume(imageLink).title).toBe("点击切换图片大小");
        expect(typeof assume(imageLink).onclick).toBe("function");
        // imagerepository=local：不加载共享资源页
        expect(f.mw.loader.load).not.toHaveBeenCalled();
        // 图片查询的 pending 不计回（legacy images.ts 原样：callback 不调
        // completedNavpopTask）——正文查询完成后的余量 1 保持
        expect(navpop.pending).toBe(1);
    });

    it("惰性下载（默认）：不可见时不发请求，挂 DOWNLOAD hook；unhide 后照常渲染", async () => {
        const f = await fresh();
        const { sent } = installXhr(() => ok(revisionJson("Foo", ARTICLE_WIKITEXT)));
        const { navpop, article } = popupFor(f, "Foo", false);
        f.pipeline.startArticlePreview(article, null, navpop);
        expect(sent).toHaveLength(0);
        expect(navpop.hookIds["unhide|before|DOWNLOAD_revision_QUERY_DATA"]).toBe(true);
        expect(navpop.pending).toBe(1);
        expect(slot("popupData")).toBe("");
        expect(slot("popupPreview")).toBe("");
        navpop.unhide();
        await vi.waitFor(() => {
            expect(slot("popupData")).toContain("个内部链接");
        });
        expect(sent).toHaveLength(1);
        expect(slot("popupPreview")).toContain("<b>Alpha</b>");
        // 下载完成时弹窗已可见：预览走立即路径，不挂 PREVIEW_HOOK
        expect(navpop.hookIds["unhide|after|PREVIEW_HOOK"]).toBeUndefined();
        expect(navpop.pending).toBe(0);
    });

    it("惰性预览：下载立即、不可见时挂 PREVIEW_HOOK，unhide 触发落槽", async () => {
        const f = await fresh({ windowOverrides: { popupLazyDownloads: false } });
        installXhr(() => ok(revisionJson("Foo", ARTICLE_WIKITEXT)));
        const { navpop, article } = popupFor(f, "Foo", false);
        f.pipeline.startArticlePreview(article, null, navpop);
        await vi.waitFor(() => {
            expect(navpop.hookIds["unhide|after|PREVIEW_HOOK"]).toBe(true);
        });
        // 预览挂起：统计与预览槽均为空（下载已完成）
        expect(navpop.pending).toBe(0);
        expect(slot("popupData")).toBe("");
        expect(slot("popupPreview")).toBe("");
        navpop.unhide();
        expect(slot("popupData")).toContain("个内部链接");
        expect(slot("popupPreview")).toContain("<b>Alpha</b>");
        // hook 返回 true：执行后自注销
        expect(navpop.hookIds["unhide|after|PREVIEW_HOOK"]).toBeUndefined();
    });

    it("两条惰性开关全关：不可见也立即下载并渲染，无 hook 挂载", async () => {
        const f = await fresh({ windowOverrides: { popupLazyDownloads: false, popupLazyPreviews: false } });
        const { sent } = installXhr(() => ok(revisionJson("Foo", ARTICLE_WIKITEXT)));
        const { navpop, article } = popupFor(f, "Foo", false);
        f.pipeline.startArticlePreview(article, null, navpop);
        await vi.waitFor(() => {
            expect(slot("popupPreview")).toContain("<b>Alpha</b>");
        });
        expect(sent).toHaveLength(1);
        expect(slot("popupData")).toContain("个内部链接");
        expect(navpop.hookIds).toEqual({});
        expect(navpop.pending).toBe(0);
    });
});
