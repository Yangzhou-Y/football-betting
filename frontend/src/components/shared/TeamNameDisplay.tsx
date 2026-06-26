/**
 * ============================================================================
 * TeamNameDisplay — 队名 + 国旗图标 复合展示组件
 * ============================================================================
 *
 * 【数据转换流程】
 *   hex (bytes32 十六进制) → decodeTeamName → 原始队名（中文或英文）
 *     → translateName → 目标语言队名 → 渲染
 *     → translateName(raw, "zh") → 中文名 → getFlagImg → 国旗 URL → <img>
 *
 * 【双向翻译支持】
 *   无论管理员创建赛事时输入中文还是英文队名，translateName 都能
 *   根据当前语言自动翻译。国旗查找始终基于中文名（flags.ts CODE_MAP 的 key 是中文）。
 *
 * 【参数说明】
 *   hex       — 合约存储的 bytes32 队名（如 0xE6B395E58D97...）
 *   flagAfter — true=国旗在队名之后（客队样式），false=国旗在队名之前（主队样式）
 *
 * 【容错处理】
 *   - 解码失败 → 显示 "???"
 *   - 国旗 CDN 加载失败 → onError 回调隐藏 <img>（flagOnError）
 *   - 未匹配到国旗 → 不渲染 <img>，只显示文字
 */
"use client";

import { decodeTeamName } from "@/lib/utils";
import { getFlagImg, flagOnError } from "@/lib/flags";
import { translateName } from "@/lib/nameMap";
import { useLang } from "@/lib/i18n";

export function TeamNameDisplay({ hex, flagAfter, className }: { hex: string; flagAfter?: boolean; className?: string }) {
  const { lang } = useLang();
  const raw = decodeTeamName(hex);
  const displayName = translateName(raw, lang);
  // 国旗查找需要中文名：若原始名为英文先反向翻译，保证双向输入均能匹配国旗
  const chineseName = translateName(raw, "zh");
  const flag = chineseName ? getFlagImg(chineseName) : "";
  const flagEl = flag ? <img src={flag} alt="" className={`w-5 h-3.5 rounded-sm shrink-0 ${flagAfter ? "ml-1" : "mr-1"}`} onError={flagOnError} /> : null;
  const text = displayName || "???";
  return (
    <span className={`inline-flex items-center max-w-[130px] align-middle ${className || ""}`}>
      {!flagAfter && flagEl}
      <span className="truncate min-w-0">{text}</span>
      {flagAfter && flagEl}
    </span>
  );
}
