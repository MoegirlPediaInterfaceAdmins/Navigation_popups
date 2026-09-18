# 功能基准清单（functional spec）

本文档是重写版的**功能验收基准**：重写实现与上游同步评估都以本清单为准（模块划分、加载顺序等实现细节不在对照范围内）。基准来源 = 上游 enwiki [oldid=1322962085] 的功能 + 全部萌百定制 − 萌百已删项，即移植版（commit 02c8dec）的行为。

标注约定：〔萌百〕= 萌百定制行为，必须保留；〔默认〕给出选项默认值。

## 1. 启动、链接绑定与动态内容

- 入口时序：ready 后 `readyState === "complete"` 直接启动，否则等 window load；启动 = autoEdit（编辑页自动操作）+ setupPopups（初始化）。
- 双载入守卫：`window.pg` 已存在且非元素节点 ⇒ 静默退出；守卫通过后立即装配 `window.pg`。
- 动态内容重扫：`mw.hook("wikipage.content")` 每段内容重置标记后重新绑定（首个 `#mw-content-text` 跳过一次）；`mw.hook("ext.echo.overlay.beforeShowingOverlay")` 对 echo 面板内 `.mw-echo-state` 重扫；页面加载时对现有 `.mw-parser-output` 各跑一遍。
- setupPopups（一次性，可带回调）：查 `specialpagealiases`〔萌百：`uselang=content&maxage=3600`〕→ 设置 siteinfo/标题基址/选项/用户信息（`popupReview` 开时查 `list=users&usprop=rights` 得 canReview）/命名空间/interwiki/正则/重定向表/杂项 → setupTooltips → 启用全局鼠标追踪。
- 绑定：分批（每批 250 个 `<A>`、间隔 100ms）绑 mouseover/mouseout/mousedown；容器选择器链〔萌百：`.skin-vector-2022 .vector-body` → `#mw_content` → `#content` → `#article` → moeskin `<article>`〕；`popupTocLinks=false`〔默认〕时移除 `#toc` 内链接。
- 链接过滤（isPopupLink）：`.nopopups` 容器 / `nopopup` 属性 / 本页 `#` 锚 / 非本站链接 / Special 页与 `section=N` 等正则排除；但 email/contribs/whatlinkshere/Special:Diff 四类 Special 链接且无 `&limit=` 时放行；vector 菜单标题链排除。

## 2. 悬停触发与隐藏

- `popupModifier` 开启时响应修饰键（enable=按下才弹 / disable=按下不弹）。
- `removeTitles=true`〔默认〕时暂存并清空锚点原生 title；同链接弹窗已可见则跳过。
- 静止检测：悬停后 `popupDelay`〔默认 0.5s〕内鼠标静止（间隔 delay/2 轮询）才显示；显示后每 600ms 检查重定位。
- simplePopups 模式：先渲染简版骨架，`popupPreviewButton` 时附「show preview」按钮转完整预览。
- 隐藏：mouseout 后鼠标仍在弹窗内（fuzz=5 容差）或菜单展开中则保留；`popupHideDelay`〔默认 0.5s〕延迟隐藏；killPopup（mousedown）中止该弹窗全部下载。
- 拖拽：`popupDraggable=true`〔默认〕，150ms 后可拖；无 handle 时需按住 Shift；`popupDragHandle` 指定把手。

## 3. 弹窗本体与结构

- 每弹窗一个 `div.navpopup`（absolute、minWidth 350、id=`navpopup<uid>`、点击置顶）；hooks：create/unhide/hide × before/after（uid 去重、返回 true 注销）——懒加载〔默认开〕、maxWidth〔默认 350〕、快捷键挂载都靠 hooks。
- 定位：右溢出时移出屏测宽再贴右缘（tooWide 一次性豁免）。
- 结构 7 种：original/nostalgia/fancy/fancy2/menus/shortmenus〔默认〕/lite；布局槽顺序见 popupLayout（menus 系把 TopLinks 提到 Title 前）；`setPopupHTML` 目标不存在时 600ms 轮询重试；`popupActiveNavlinks` 时 TopLinks 槽内递归绑定子弹窗〔`popupSubpopups=true` 默认〕。
- 重定向态：`popupRedir*` 槽显示目标与「修复重定向」链接〔`popupFixRedirs` 默认关〕。

## 4. 导航链接菜单（navlinks）

- DSL：`<<id|text|key=value>>` 标签、`if(cond){..}else{..}`（cond ∈ user/talk/admin/oldid/rcid/ipuser/mainspace_en/wikimedia/diff）、`<menu>/<menurow>` 嵌套下拉、`*` 分隔符，递归 ≤10 层。
- navlink id 全集（每个都要有对应构造）：undelete、whatLinksHere、relatedChanges、move、contribs、deletedContribs、email、block、unblock、userlog、blocklog、pagelog、protectlog、deletelog、userSpace、search、thank、watch、unwatch、history、historyfeed、unprotect、protect、delete、markpatrolled、edit、view、purge、render、raw、new、mainlink、userPage、article、monobook、editMonobook、editArticle、userTalk、talk、arin、count、google、editors、globalsearch、lastEdit、oldEdit、editOld、undo、revert、nullEdit、diffCur、editUserTalk、editTalk、newUserTalk、newTalk、lastContrib、sinceMe、togglePreviews、disablePopups、purgePopups；未知 id 渲染 `Unknown navlink type: <id>`。
- 快捷键字母全集（空格 mainlink、`/` lastEdit、c 贡献、L 用户日志、# 计数、E email/editors、b 封禁、e 编辑、+ 新话题、h 历史、w 监视、a 条目、t 讨论、l 链入、r 相关、m 移动、p 保护、d 删除、v revert/view、u 用户页、s 搜索、g 全局、G google、S render、n 空编辑、P 清除缓存）。
- shortmenus 默认布局：mainlink + 操作（actions）下拉 + 用户（user）下拉 + popups 菜单〔`popupSetupMenu` 默认开〕。
- 编辑计数工具默认 supercount〔萌百：xtools.wmflabs.org/ec，带 `uselang=wgUserLanguage`〕；globalsearch 用 global-search.toolforge.org；arin 仅 wikimedia 站 + IP。
- action=edit 链接追加 `&wpChangeTags=Popups%2CAutomation%20tool`〔萌百〕。
- 新窗口策略：per-id `popupLinksNewWindows`（默认 lastContrib/sinceMe）+ 全局 `popupNewWindows`。

## 5. 页面预览

- revision 查询：`action=query&prop=revisions|pageprops|info|images|categories&meta=wikibase&rvslots=main&rvprop=ids|timestamp|flags|comment|user|content&cllimit=max&imlimit=max`（oldid 用 revids，否则 titles）；抽 wikitext/lastModified/wikibase item。
- 重定向跟随：wikitext 命中重定向正则〔萌百：含 `#重定向` 等本地化变体〕→ 显示目标 + 可选修复链接 → 对目标继续预览。
- 统计数据（popupData 槽）8 过滤器：小作品〔`popupStubRegexp`〕、消歧义〔`popupDabRegexp`，主名字空间限定 unless `popupAllDabsStubs`〕、页面大小（>949 字节显示 kB〔萌百：译注「以1000为一进」〕）、内链计数、图片计数（含 infobox 类变量〔`popupImageVarsRegexp`〕）、分类计数、最后修改年龄〔萌百：moment 精确日历差值，中文单位〕、wikibase 链接。
- 摘要提取（previewmaker）：截断至 `max(10^4, 2*popupMaxPreviewCharacters)`〔默认 600 字符/5 句〕；清洗管线 kill 系列注释/div/galleries/box 模板/模板（或跨行模板）/表格/图片（动态收集 File/Category 本地化别名）/HTML/斜体块；Template/File 名字空间只 killHTML；firstBit 支持跳过开头标题、首段模式、按句切分；more... 链接点击后 +2000 字符/+20 句重算。
- wiki→HTML：Insta 引擎（标题/列表/pre/表格/hr/块图片 + 内链含管道与 interwiki/外链/签名/斜体粗体/nowiki/魔术字清除），链接基于 wgArticlePath。
- 锚点链接：先在 wikitext 中定位同章节标题或 `{{anchor}}` 模板再截预览。
- 模板页〔`popupPreviewRawTemplates` 默认开〕显示源码（monospace）。

## 6. diff / 历史 / 贡献预览

- diff：`action=compare` 取 fromrevid/torevid（diff=cur/prev/next/具体 revid 组合矩阵）→ 取两版 wikitext → stripOuterCommonLines（context 2 行）→ 超 100 行截断标注 → 自实现 diff 算法 → rmBoringLines → wiki 词法 token 化 diffString（`<ins>/<del class=popupDiff>`）→ shorten（context 40 字符）→〔`popupDiffDates` 默认开〕新旧日期表。
- canReview 时附「标记为已巡查」（flagged info 查询 + review 提交）。
- 历史预览：rvlimit=25 的 editPreviewTable（按日分组、cur/last 链接、时间 oldid 链接、用户列、小编辑标记〔萌百：硬编码「小 」〕、摘要列 `/* 章节 */` 渲染含锚点链接）。
- 贡献预览：usercontribs limit=25 同表格（首列 diff|hist、第三列页面名；userhidden → popupRevDelUrl）。
- lastContrib/sinceMe：rvlimit=50 找最近非首位编辑者 / 我的最后编辑 → alert 或跳转 diff。
- wikEd 编辑框内容先经 `WikEdUpdateFrame()` 同步。

## 7. 图片与文件页预览

- `prop=imageinfo&iiprop=url|mime&iiurlwidth=200`〔`popupImageSizeLarge`〕；`popupImages` 关或文件名含 `{` 跳过；懒加载 hook。
- 缩图填充 `#popupImg<id>`（宽 60〔`popupImageSize`〕，thumburl 优先）；点击行为 `popupThumbAction`〔默认 imagepage：非 File 主题→描述页并递归；File→切换大小〕。
- 条目 wikitext 抽首个合法图片（`<!--..popup` 注释内除外）作预览缩图。
- 文件页悬停：alt 文本〔父锚点内 img.alt〕+ 文件页 wikitext 预览 + 统计 + `list=imageusage` 使用列表〔`popupImageLinks` 默认开〕；shared 仓库时 JSONP 请求 commons〔callback 全局函数名 + 「来自维基共享」链接，萌百翻译键四则〕。

## 8. 分类 / 链入 / 用户信息预览

- 分类：`list=categorymembers` → 成员列表 + continue 时「以及其他页面」；空 → 「空的分类」。
- 链入（Whatlinkshere 悬停）：`list=backlinks` → 列表 + 「以及更多」。
- 用户（悬停用户页/用户讨论，`popupUserInfo` 默认开）：IP → `list=blocks`；注册用户 → `list=users|usercontribs&meta=globaluserinfo`。渲染：非法/IP 用户名提示、BLOCKED/部分封禁、全局 LOCKED/HIDDEN（校验 unattached 含本库 wgDBname）、性别 ♀/♂〔`popupShowGender` 默认开〕、本地用户组〔萌百：滤 `*`/`user`/`autoconfirmed`，非自动确认加粗 `group-no-autoconfirmed`，组名经 `mw.message("group-X-member", gender)` 并 loadMessagesIfMissing〕、全局组（斜体）、编辑数 + 注册日期、最后编辑日期、IP 封禁段。分隔符〔萌百：`separator`「、」/`comma`「，」〕。
- 时间格式化：timecorrection 无 `ZoneInfo|` 或无 `formatToParts` → 偏移量修正；`date` 选项 ISO 8601 → 手动 zeroFill；否则 Intl.DateTimeFormat（用户时区 + locales：html[lang]→en 时 mdy/dmy 选 en-US/en-GB，`popupLocale` 可覆盖）。

## 9. 消歧义 / 红链修复

- `popupFixDabs=true` 且命中消歧义正则且非 Special 且有讨论页 → 列出 wikitext 全部 `[[链接]]`（滤前缀、排序去重），每项生成 autoedit 改链命令 +〔`popupDabWiktionary` 默认 last〕wiktionary 项 + 「移除链接」项；被编辑页 = 子弹窗场景取 parentPopup.article。
- `popupRedlinkRemoval` 且锚点 `class="new"` → 红链移除 autoedit。

## 10. 自动编辑（autoedit）

- 仅 `document.editform` 页生效；URL 含 `wpChangeTags=Popups` 时注入 hidden input〔萌百：`autoclick=wpSave` 时追加 `,Automation tool`〕并改 form action。
- `autoimpl=np20140416` 且 `actoken=mw.user.sessionId()`、防重入；`autoedit=` 的 `s/from/to/flags;` 命令串（`\`、`\sep`、`\n` 转义）应用到 wpTextbox1；wikEd 兼容；autowatchlist → watch API；autominor/autowatch 勾选；autorv → 查版本填 `$1/$2/$3` 摘要模板（失败强制 prompt）；autosummaryprompt → prompt 确认；autoclick → 横幅提示 + document.title 加括号 + click。
- revert/undo/nullEdit 的 autoedit URL 生成（含 `popupRevertSummaryPrompt`/`popupMinorReverts` 分支）。
- watch/unwatch：`postWithToken("watch")` + loadMessagesIfMissing + mw.notify。

## 11. 选区弹窗 / 快捷键 / 弹窗内动作

- 选区（editform 的 wpTextbox1）：`popupOnEditSelection`〔默认 cursor〕= 选区含 `[[..]]` 时解析标题合成锚点直接弹窗跟随光标；boxpreview 模式在编辑框上方 div 直接 wiki2html 渲染。
- 快捷键〔`popupShortcutKeys` 默认关〕：Esc 关闭；字母循环查找 `popupkey` 属性锚点并 jQuery focus。
- pg.fn 动作（`javascript:` URL 调用，依赖 window.pg）：togglePreviews（翻转 simplePopups + 全弹窗重置）/purgePopups（清缓存 + 重置选项）/disablePopups（解绑，刷新恢复）/getLastContrib/getDiffSinceMyEdit/modifyWatchlist/APIsharedImagePagePreviewHTML。
- 引脚预览：悬停 `#cite_note-` 等与本页同标题锚点 → 对应 `<li>` 的 innerHTML 直接进预览槽（无 API）。

## 12. 选项系统与 i18n

- 覆盖链：`window.popupXxx`（用户脚本 common.js 设 window 变量）> 内置默认；无 localStorage 持久化；purgePopups 重置 `pg.option`。默认值全集以 legacy options.ts 的 setOptions 为准（约 95 项），`popupAdminLinks` 随 sysop 组。
- i18n：内置英文表 pg.string（~210 键，defaultpopup*Summary 带 enwiki 署名）+ 萌百翻译表 popupStrings（242 项 wgULS）；popupString 查表未命中记入 `window.popupNoTranslation` Set 并 console.info，返回原键兜底；tprintf 支持 `%s` 与 `$1..$N`。
- 〔萌百〕`localStorage.removeItem("popupNoTranslation")` 清旧版遗留。
- 站点全局依赖：wgULS、moment（formatAge）、wikEd（wikEdUseWikEd/WikEdUpdateFrame）。

## 13. 下载层与外部依赖

- 自建 Downloader：裸 XHR 拼 `apiwikibase + "?format=json&formatversion=2&action=query&…"`，header `Api-User-Agent: Navigation popups/1.0 (wgServerName)`〔萌百〕，失败重试 2 次、可 abort（弹窗隐藏时中止其全部请求），内存缓存 getPageWithCaching。
- mw.Api 仅用于：specialpagealiases、users rights、compare、flagged、watch/review 提交、loadMessagesIfMissing。
- mw.* 面全集：config.get（wgFormattedNamespaces/wgUserName/wgUserLanguage/wgScript/wgNamespaceIds/wgScriptPath/wgDBname/wgUserGroups/wgServerName/wgPageName/wgContentLanguage/wgArticlePath）、util.getParamValue/escapeRegExp、user.options/sessionId、hook、loader.load、message/notify、Title.newFromText。
- interwiki〔萌百：zh→en|ja、en→zh|ja、ja→zh|en〕。

## 14. DOM / CSS 契约（冻结）

`.navpopup`、`#popupImg<id>`、`#popupImageLink<id>`、`#popupPreview<id>` 等 id 命名规则与 `.popup_menu`、`.popup_drop`、`.popupDiff` 等 class 集合必须与现有 `src/css/main.scss` + `_darkmode.scss` 完全匹配（CSS 不随重写改动）。
