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
