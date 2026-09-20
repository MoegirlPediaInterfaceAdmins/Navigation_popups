// autoedit 域先头件：links 先头件（wikiLink 的 revert/nullEdit 分支、
// changeLinkTargetLink 的 actoken 参数）需要 autoClickToken；其余 autoedit
// 逻辑（autoEdit 执行端、AutoEdit 目录项等）随阶段 4 actions 域落位。
export const autoClickToken = (): string => mw.user.sessionId();
