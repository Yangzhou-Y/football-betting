/** 世界杯主题背景装饰 — 不影响任何交互 */
export function WorldCupBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10" style={{ overflow: "hidden" }}>
      {/* 球场边线白线 — 低调勾勒出足球场轮廓 */}
      <div className="absolute inset-0 border-[40px] sm:border-[60px] border-white/10 rounded-none" />
      {/* 中线 */}
      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/10" />
      {/* 中圈 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full border-2 border-white/10" />
      {/* 中圈开球点 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[8px] h-[8px] rounded-full bg-white/10" />
      {/* 左上角球弧 */}
      <div className="absolute top-[38px] sm:top-[58px] left-[38px] sm:left-[58px] w-[24px] h-[24px] rounded-br-full border-2 border-b-0 border-l-0 border-white/10" />
      {/* 右上角球弧 */}
      <div className="absolute top-[38px] sm:top-[58px] right-[38px] sm:right-[58px] w-[24px] h-[24px] rounded-bl-full border-2 border-b-0 border-r-0 border-white/10" />
      {/* 左下角球弧 */}
      <div className="absolute bottom-[38px] sm:bottom-[58px] left-[38px] sm:left-[58px] w-[24px] h-[24px] rounded-tr-full border-2 border-t-0 border-l-0 border-white/10" />
      {/* 右下角球弧 */}
      <div className="absolute bottom-[38px] sm:bottom-[58px] right-[38px] sm:right-[58px] w-[24px] h-[24px] rounded-tl-full border-2 border-t-0 border-r-0 border-white/10" />

      {/* 球门 */}
      <Goal x="3%" y="28%" />
      <Goal x="91%" y="52%" />

      {/* 奖杯 */}
      <Trophy x="48%" y="5%" size={44} delay={0} />
      <Trophy x="15%" y="50%" size={32} delay={1.6} />
      <Trophy x="80%" y="72%" size={38} delay={0.7} />

      {/* 足球散布 */}
      <SoccerBall x="10%" y="18%" size={32} rotate={15} delay={0} />
      <SoccerBall x="72%" y="10%" size={26} rotate={-25} delay={1.5} />
      <SoccerBall x="62%" y="75%" size={36} rotate={55} delay={0.8} />
      <SoccerBall x="20%" y="68%" size={28} rotate={-8} delay={2.2} />
      <SoccerBall x="85%" y="38%" size={22} rotate={40} delay={1.0} />
      <SoccerBall x="8%"  y="82%" size={30} rotate={-30} delay={2.8} />
      <SoccerBall x="45%" y="22%" size={24} rotate={60} delay={0.4} />
      <SoccerBall x="55%" y="88%" size={34} rotate={-15} delay={1.8} />
    </div>
  );
}

/** ⚽ 经典黑白足球 */
function SoccerBall({ x, y, size = 24, rotate = 0, delay = 0 }: {
  x: string; y: string; size?: number; rotate?: number; delay?: number;
}) {
  return (
    <div
      className="absolute animate-bounce opacity-30"
      style={{
        left: x, top: y,
        width: size, height: size,
        transform: `rotate(${rotate}deg)`,
        animationDelay: `${delay}s`,
      }}
    >
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {/* 球体轮廓 + 阴影 */}
        <defs>
          <radialGradient id="ballGrad" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="70%" stopColor="#e5e5e5" />
            <stop offset="100%" stopColor="#999" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#ballGrad)" stroke="#333" strokeWidth="2.5" />
        {/* 中心五边形 — 黑色 */}
        <polygon points="50,28 62,37 57,52 43,52 38,37" fill="#222" stroke="#111" strokeWidth="0.8" />
        {/* 周围五个黑色块 */}
        <polygon points="28,35 38,37 35,52 22,48 18,38" fill="#222" stroke="#111" strokeWidth="0.8" />
        <polygon points="72,35 78,42 72,52 62,48 62,37" fill="#222" stroke="#111" strokeWidth="0.8" />
        <polygon points="28,62 36,56 40,66 32,72 22,68" fill="#222" stroke="#111" strokeWidth="0.8" />
        <polygon points="72,62 78,68 68,72 60,66 64,56" fill="#222" stroke="#111" strokeWidth="0.8" />
        <polygon points="50,74 58,70 54,80 46,80 42,70" fill="#222" stroke="#111" strokeWidth="0.8" />
        {/* 缝线 */}
        <circle cx="50" cy="50" r="47" fill="none" stroke="#999" strokeWidth="0.4" strokeDasharray="2 3" />
      </svg>
    </div>
  );
}

/** 🥅 球门 — 白色门柱 + 网 */
function Goal({ x, y }: { x: string; y: string }) {
  return (
    <div className="absolute opacity-30" style={{ left: x, top: y }}>
      <svg width="100" height="130" viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 后网底 */}
        <rect x="8" y="24" width="84" height="82" fill="white" opacity="0.15" />
        {/* 横梁 */}
        <rect x="4" y="20" width="92" height="6" rx="3" fill="white" stroke="#666" strokeWidth="1.5" />
        {/* 左门柱 */}
        <rect x="4" y="20" width="6" height="100" rx="3" fill="white" stroke="#666" strokeWidth="1.5" />
        {/* 右门柱 */}
        <rect x="90" y="20" width="6" height="100" rx="3" fill="white" stroke="#666" strokeWidth="1.5" />
        {/* 横网格线 */}
        {[36, 52, 68, 84, 100].map((yy, i) => (
          <line key={`h${i}`} x1="10" y1={yy} x2="90" y2={yy}
            stroke="#999" strokeWidth="0.6" strokeDasharray="6 4" />
        ))}
        {/* 竖网格线 */}
        {[24, 38, 52, 66, 80].map((xx, i) => (
          <line key={`v${i}`} x1={xx} y1="26" x2={xx} y2="120"
            stroke="#999" strokeWidth="0.5" strokeDasharray="14 6" />
        ))}
        {/* 底杆 */}
        <rect x="4" y="116" width="92" height="4" rx="2" fill="white" stroke="#666" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/** 🏆 大力神杯 */
function Trophy({ x, y, size = 32, delay = 0 }: {
  x: string; y: string; size?: number; delay?: number;
}) {
  return (
    <div
      className="absolute animate-pulse opacity-30"
      style={{
        left: x, top: y,
        width: size, height: size,
        animationDelay: `${delay}s`,
      }}
    >
      <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="40%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="gold2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        {/* 地球 — 杯顶 */}
        <circle cx="50" cy="18" r="16" fill="url(#gold)" stroke="#92400e" strokeWidth="1.5" />
        {/* 地球经纬线 */}
        <ellipse cx="50" cy="18" rx="10" ry="14" fill="none" stroke="#b45309" strokeWidth="0.8" opacity="0.6" />
        <ellipse cx="50" cy="18" rx="16" ry="6" fill="none" stroke="#b45309" strokeWidth="0.8" opacity="0.6" />
        {/* 杯身 — 梯形 */}
        <path d="M30 34 L36 64 L64 64 L70 34 Z" fill="url(#gold2)" stroke="#92400e" strokeWidth="1.8" />
        {/* 杯身装饰环 */}
        <line x1="34" y1="44" x2="66" y2="44" stroke="#b45309" strokeWidth="1" opacity="0.5" />
        <line x1="35" y1="52" x2="65" y2="52" stroke="#b45309" strokeWidth="1" opacity="0.5" />
        {/* 杯颈 */}
        <rect x="44" y="64" width="12" height="14" rx="2" fill="url(#gold)" stroke="#92400e" strokeWidth="1.2" />
        {/* 杯座 — 第一层 */}
        <rect x="36" y="78" width="28" height="6" rx="3" fill="url(#gold2)" stroke="#92400e" strokeWidth="1.2" />
        {/* 杯座 — 第二层 */}
        <rect x="28" y="84" width="44" height="6" rx="3" fill="url(#gold2)" stroke="#92400e" strokeWidth="1.2" />
        {/* 杯座 — 第三层 */}
        <rect x="20" y="90" width="60" height="6" rx="3" fill="url(#gold2)" stroke="#92400e" strokeWidth="1.2" />
        {/* 飘带 — 左 */}
        <path d="M28 84 C10 70 8 96 18 102" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        {/* 飘带 — 右 */}
        <path d="M72 84 C90 70 92 96 82 102" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      </svg>
    </div>
  );
}
