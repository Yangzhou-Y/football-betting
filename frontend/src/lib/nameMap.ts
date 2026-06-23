// ============================================================================
// 球队名 & 比赛名 中英文双向对照表
// Chain stores names as bytes32; this map provides bidirectional translation.
// ============================================================================

/** 球队名中→英对照 */
const TEAM_MAP: Record<string, string> = {
  // 国家队
  "中国": "China", "日本": "Japan", "韩国": "South Korea", "朝鲜": "North Korea",
  "巴西": "Brazil", "阿根廷": "Argentina", "乌拉圭": "Uruguay", "哥伦比亚": "Colombia",
  "智利": "Chile", "秘鲁": "Peru", "厄瓜多尔": "Ecuador",
  "德国": "Germany", "法国": "France", "英格兰": "England", "意大利": "Italy",
  "西班牙": "Spain", "荷兰": "Netherlands", "葡萄牙": "Portugal", "比利时": "Belgium",
  "克罗地亚": "Croatia", "瑞士": "Switzerland", "丹麦": "Denmark", "瑞典": "Sweden",
  "波兰": "Poland", "塞尔维亚": "Serbia", "威尔士": "Wales", "乌克兰": "Ukraine",
  "奥地利": "Austria", "捷克": "Czech Republic", "挪威": "Norway", "苏格兰": "Scotland",
  "土耳其": "Turkey", "希腊": "Greece", "俄罗斯": "Russia",
  "墨西哥": "Mexico", "美国": "USA", "加拿大": "Canada", "哥斯达黎加": "Costa Rica",
  "巴拿马": "Panama",
  "摩洛哥": "Morocco", "塞内加尔": "Senegal", "突尼斯": "Tunisia",
  "喀麦隆": "Cameroon", "加纳": "Ghana", "尼日利亚": "Nigeria",
  "埃及": "Egypt", "科特迪瓦": "Ivory Coast", "南非": "South Africa",
  "阿尔及利亚": "Algeria", "刚果（金）": "DR Congo",
  "沙特": "Saudi Arabia", "伊朗": "Iran", "伊拉克": "Iraq", "卡塔尔": "Qatar", "阿联酋": "UAE",
  "约旦": "Jordan", "乌兹别克斯坦": "Uzbekistan",
  "澳大利亚": "Australia", "新西兰": "New Zealand",
  "波黑": "Bosnia", "巴拉圭": "Paraguay", "海地": "Haiti", "库拉索": "Curaçao",

  // 俱乐部
  "皇家马德里": "Real Madrid", "巴塞罗那": "Barcelona",
  "曼城": "Man City", "曼联": "Man United",
  "利物浦": "Liverpool", "切尔西": "Chelsea", "阿森纳": "Arsenal",
  "拜仁": "Bayern Munich", "拜仁慕尼黑": "Bayern Munich",
  "尤文图斯": "Juventus", "国际米兰": "Inter Milan", "AC米兰": "AC Milan",
  "多特蒙德": "Borussia Dortmund", "巴黎": "PSG", "巴黎圣日耳曼": "PSG",
  "马德里竞技": "Atletico Madrid", "热刺": "Tottenham",
  "那不勒斯": "Napoli", "罗马": "Roma", "拉齐奥": "Lazio",
  "勒沃库森": "Bayer Leverkusen", "莱比锡": "RB Leipzig",
};

/** 比赛/赛事名中→英对照 */
const COMPETITION_MAP: Record<string, string> = {
  "世界杯决赛": "World Cup Final",
  "世界杯半决赛": "World Cup Semi-Final",
  "世界杯四分之一决赛": "World Cup Quarter-Final",
  "世界杯小组赛": "World Cup Group Stage",
  "世界杯": "World Cup",
  "欧洲杯决赛": "Euro Final",
  "欧洲杯半决赛": "Euro Semi-Final",
  "欧洲杯": "Euro",
  "欧冠决赛": "UCL Final",
  "欧冠半决赛": "UCL Semi-Final",
  "欧冠": "Champions League",
  "英超": "Premier League",
  "英超第": "Premier League Matchday ",
  "西甲": "La Liga",
  "西甲第": "La Liga Matchday ",
  "意甲": "Serie A",
  "意甲第": "Serie A Matchday ",
  "德甲": "Bundesliga",
  "德甲第": "Bundesliga Matchday ",
  "法甲": "Ligue 1",
  "法甲第": "Ligue 1 Matchday ",
  "中超": "CSL",
  "中超第": "CSL Round ",
  "友谊赛": "Friendly",
  "热身赛": "Friendly",
  "预选赛": "Qualifiers",
  "小组赛": "Group Stage",
  "淘汰赛": "Knockout Stage",
  "半决赛": "Semi-Final",
  "决赛": "Final",
  "联赛": "League",
};

// 构建反向索引（英→中），运行时一次性计算
const TEAM_REVERSE: Record<string, string> = {};
const COMPETITION_REVERSE: Record<string, string> = {};
for (const [zh, en] of Object.entries(TEAM_MAP)) {
  // 多个中文名可能映射同一个英文（如"拜仁"和"拜仁慕尼黑"→"Bayern Munich"）
  // 反向映射用第一个中文名
  if (!TEAM_REVERSE[en]) TEAM_REVERSE[en] = zh;
}
for (const [zh, en] of Object.entries(COMPETITION_MAP)) {
  if (!COMPETITION_REVERSE[en]) COMPETITION_REVERSE[en] = zh;
}

/**
 * 双向翻译队名/赛事名。
 * - zh 模式：英文名→中文名（反向查表），查不到则保持原样
 * - en 模式：中文名→英文名（正向查表），查不到则保持原样
 *
 * 这样无论管理员创建赛事时输入中文还是英文，都能随系统语言切换。
 */
export function translateName(name: string, lang: "zh" | "en"): string {
  if (!name) return "";

  if (lang === "zh") {
    // 目标中文：先查反向表（英→中），查不到说明已经是中文，直接返回
    if (TEAM_REVERSE[name]) return TEAM_REVERSE[name];
    if (COMPETITION_REVERSE[name]) return COMPETITION_REVERSE[name];
    // 可能已经是中文队名，直接返回
    if (TEAM_MAP[name]) return name;
    // 竞争名前缀反向匹配（e.g. "Premier League Matchday 30" → "英超第30轮"）
    for (const [en, zh] of Object.entries(COMPETITION_REVERSE)) {
      if (name.startsWith(en)) {
        const rest = name.slice(en.length);
        return zh + rest;
      }
    }
    return name;
  }

  // 目标英文：正向查表（中→英）
  if (TEAM_MAP[name]) return TEAM_MAP[name];
  if (COMPETITION_MAP[name]) return COMPETITION_MAP[name];
  // 可能已经是英文队名，直接返回
  if (TEAM_REVERSE[name]) return name;
  // 竞争名前缀正向匹配（e.g. "英超第30轮" → "Premier League Matchday 30"）
  for (const [zh, en] of Object.entries(COMPETITION_MAP)) {
    if (name.startsWith(zh)) {
      let rest = name.slice(zh.length);
      rest = rest.replace(/^[一-鿿]+/, "");
      return en + rest;
    }
  }
  return name;
}
