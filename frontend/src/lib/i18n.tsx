/**
 * ============================================================================
 * 国际化（i18n）模块 — 中英文切换 + React Context
 * ============================================================================
 *
 * 【设计思路】
 *   方案：客户端字典映射（无外部 i18n 库依赖）
 *   优点：零依赖、热切换无需刷新、支持嵌套 Context 隔离
 *   缺点：不支持复数规则、日期格式化等高级特性（通过 Intl API 独立处理）
 *
 * 【翻译流程】
 *   ① LangProvider 包裹整个应用，提供 { lang, t, setLang }
 *   ② 组件调用 const t = useT() 获取翻译函数
 *   ③ t("common.loading") → 查 dict[currentLang]["common.loading"]
 *   ④ Key 不存在时回退到原始 key 字符串（避免白屏）
 *
 * 【为什么不用 next-intl 或 react-i18next？】
 *   - 学习项目，保持依赖最小化
 *   - 翻译条目量不大（~100 条），手动管理字典可控
 *   - 客户端切换无需服务端配合，简单直接
 *
 * 【添加新翻译的步骤】
 *   ① 在两个 dict.zh 和 dict.en 对象中各添加一个 key-value
 *   ② Key 命名规范：`功能.描述`，如 "admin.createMatch"
 *   ③ 组件中使用：const t = useT(); return <span>{t("admin.createMatch")}</span>
 *   ④ 不要忘记同时更新两个语言版本
 */
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Lang = "zh" | "en";

// ============================================================================
// 翻译字典 — 中/英双语的完整 KV 映射
// ============================================================================
const dict: Record<Lang, Record<string, string>> = {
  zh: {
    "app.title": "世界杯竞猜",

    // 导航
    "nav.home": "首页",
    "nav.matches": "赛事",
    "nav.myBets": "我的竞猜",
    "nav.leaderboard": "排行榜",
    "nav.admin": "管理",
    "nav.menu": "菜单",
    "nav.connect": "连接钱包",

    // 角色
    "role.admin": "管理员",
    "role.user": "用户",

    // 通用
    "common.loading": "加载中...",
    "common.connectWallet": "请先连接钱包",
    "common.checkingPermission": "检查权限中...",
    "common.noPermission": "无管理员权限",
    "common.processing": "处理中...",
    "common.unknown": "未知",
    "common.matchNum": "赛事 #",
    "common.score": "比分",
    "common.result": "结果",
    "common.correct": "猜中",
    "common.incorrect": "未中",
    "common.viewDetails": "查看详情",
    "common.waitingForResult": "等待开奖...",
    "common.save": "保存",
    "common.back": "返回修改",
    "common.nextStep": "下一步",
    "common.submitting": "提交中...",

    // 配置
    "config.notDeployed": "未找到合约部署记录",
    "config.runDeploy": "请先运行 npm run deploy",
    "config.unsupportedNetwork": "当前网络不支持，请切换到 Conflux eSpace Testnet 或 Hardhat Local",
    "config.connectPrompt": "请连接钱包并切换到 Conflux eSpace Testnet",

    // 赛事状态
    "match.status.created": "已创建",
    "match.status.open": "投注中",
    "match.status.closed": "已封盘",
    "match.status.settled": "已开奖",
    "match.status.deadlinePassed": "已截止",
    "match.notFound": "赛事不存在",

    // 比赛结果
    "result.pending": "待定",
    "result.homeWin": "主队胜",
    "result.draw": "平局",
    "result.awayWin": "客队胜",

    // 徽章
    "badge.bet": "已投注",
    "badge.claimable": "待领取",

    // 投注
    "bet.bet": "投注",
    "bet.add": "追加投注",
    "bet.switch": "切换投注",
    "bet.confirm": "确认投注",
    "bet.amount": "投注金额",
    "bet.selectResult": "选择结果",
    "bet.enterAmount": "输入金额后确认投注",
    "bet.enterAmountAdd": "输入金额后追加投注",
    "bet.cancel": "取消投注，退回 USDT",
    "bet.cancelTitle": "取消投注",
    "bet.homeWin": "主胜",
    "bet.awayWin": "客胜",
    "bet.minAmount": "最低",
    "bet.maxAmount": "最高",
    "bet.belowMin": "低于最低投注额",
    "bet.aboveMax": "超过最高投注额",
    "bet.checkingBalance": "检查余额和授权中...",
    "bet.insufficientBalance": "USDT 余额不足",
    "bet.requestingApproval": "请求授权中...",
    "bet.approving": "授权确认中...",
    "bet.stepApprove": "① 授权 USDT",
    "bet.cancelling": "取消中...",
    "bet.confirming": "确认中...",
    "bet.success": "投注成功！",
    "bet.successDesc": "交易已确认，数据已自动更新",
    "bet.cancelled": "投注已取消",
    "bet.cancelledDesc": "USDT 已退回你的钱包",
    "bet.existingBet": "你已投注",
    "bet.existingBetHint": "选择相同选项：本次金额会累加到已有投注 · 选择不同选项：以本次输入的金额作为新投注额，与原投注的差额自动多退少补",
    "bet.noWinnerHint": "风险提示：若最终结果无人猜中，整个奖池将全部归平台所有，不会退回。",

    // 领奖
    "claim.reward": "领取奖励",
    "claim.confirm": "确认领取",
    "claim.claimable": "可领取奖励",
    "claim.success": "领取成功",
    "claim.congrats": "恭喜！你猜中了！",
    "claim.noWin": "未中奖",
    "claim.alreadyClaimed": "已领取",
    "claim.alreadySettled": "已结算",
    "claim.claiming": "领取中...",
    "claim.pausedHint": "领取功能已暂时关闭",

    // 奖池
    "pool.title": "奖池分布",
    "pool.homeWin": "主队胜",
    "pool.draw": "平局",
    "pool.awayWin": "客队胜",
    "pool.label": "奖池:",
    "pool.odds": "赔率",
    "card.participants": "人参与",
    "bet.quickAmount": "快捷金额",
    "page.prev": "上一页",
    "page.next": "下一页",
    "page.first": "首页",
    "page.last": "末页",
    "page.jumpTo": "跳转",
    "page.go": "前往",
    "sort.newest": "最近优先",
    "sort.oldest": "最早优先",
    "sort.byTime": "按时间",
    "sort.byPool": "按奖池",
    "sort.asc": "升序",
    "sort.desc": "降序",
    "filter.date": "日期筛选",
    "filter.team": "搜索球队",
    "filter.teamPlaceholder": "如 巴西",

    // 管理
    "admin.title": "管理后台",
    "admin.createMatch": "创建赛事",
    "admin.matchName": "比赛名称",
    "admin.homeTeam": "主队名称",
    "admin.awayTeam": "客队名称",
    "admin.startTime": "开赛时间（北京时间）",
    "admin.deadline": "投注截止时间",
    "admin.minBet": "最低投注 (USDT)",
    "admin.maxBet": "最高投注 (0 = 不限制)",
    "admin.allowDraw": "是否可选平局",
    "admin.allowDrawHint": "淘汰赛请取消勾选",
    "admin.create": "创建赛事",
    "admin.matchMgmt": "赛事管理",
    "admin.open": "开放",
    "admin.close": "关闭",
    "admin.record": "录入",
    "admin.delete": "删除",
    "admin.deleteTitle": "确认删除赛事",
    "admin.deleteConfirm": "确定要删除该赛事吗？此操作不可撤销，删除后所有赛事数据将被永久清除。",
    "admin.deleteWarning": "⚠ 赛事删除后数据无法恢复，请确认无误后再操作",
    "admin.deleteHint": "只有「已创建」状态（未开放投注）的赛事可以删除",
    "admin.pause": "紧急暂停",
    "admin.paused": "已暂停",
    "admin.running": "运行中",
    "admin.resume": "恢复",
    "admin.pauseBtn": "暂停",
    "admin.fee": "平台手续费",
    "admin.feeWithdraw": "待提取",
    "admin.withdraw": "提取手续费",
    "admin.recordScore": "录入赛果",
    "admin.confirmSubmit": "确认提交",
    "admin.deadlineHint": "投注截止时间必须在开赛时间之前",
    "admin.nameEncodeError": "名称编码失败，请使用更短的名称（英文≤32字符，中文≤10字）",
    "admin.createHint": "创建后需要点击下方「开放」按钮，用户才能投注。截止时间必须在开赛时间之前。",
    "admin.createButton": "📝 创建赛事",
    "admin.table.match": "赛事",
    "admin.table.status": "状态",
    "admin.table.actions": "操作",
    "admin.errorTitle": "交易失败",
    "admin.scoreError": "比分请输入 0~999 之间的整数",
    "admin.ph.matchName": "如 世界杯决赛 / 英超第30轮",
    "admin.ph.homeTeam": "如 巴西",
    "admin.ph.awayTeam": "如 德国",
    "admin.ph.minBet": "如 0.01",
    "admin.ph.maxBet": "如 100 或留空",
    "admin.resultLabel": "判定结果：",
    "admin.irreversibleWarning": "⚠ 提交后不可撤销！请仔细核对比分",
    "admin.pauseStatus": "当前状态:",
    "admin.pauseLoading": "⏳ 加载中...",
    "admin.pauseIndicator": "🔴 已暂停",
    "admin.runningIndicator": "🟢 运行中",
    "admin.feePending": "待提取:",

    // 筛选
    "filter.all": "全部",
    "filter.my": "已投注",
    "filter.open": "投注中",
    "filter.closed": "已封盘",
    "filter.settled": "已开奖",

    // 我的竞猜
    "myBets.title": "我的竞猜",
    "myBets.totalBets": "总投注",
    "myBets.wins": "猜中",
    "myBets.winRate": "胜率",
    "myBets.profit": "净盈亏",
    "myBets.noBets": "暂无投注记录",
    "myBets.deleted": "(已删除)",
    "myBets.goBet": "去竞猜 →",
    "myBets.table.match": "赛事",
    "myBets.table.prediction": "预测",
    "myBets.table.amount": "金额",
    "myBets.table.result": "结果",
    "myBets.table.status": "状态",
    "myBets.claimableTotal": "可领取奖励",
    "myBets.claimableHint": "{count} 场比赛待领取",

    // 赛事列表
    "matches.title": "赛事列表",

    // 统计
    "stats.totalMatches": "赛事总数",
    "stats.totalPool": "累计奖池",
    "stats.activePool": "竞猜中奖池",
    "stats.openMatches": "投注中",
    "stats.settledCount": "已开奖",
    "stats.matchBreakdown": "共 {total} 场 · 投注中 {open} 场 · 已封盘 {closed} 场 · 已开奖 {settled} 场",

    // 分区
    "section.hot": "🔥 热门赛事",
    "section.upcoming": "⏰ 即将开赛",
    "section.noMatches": "暂无赛事",
    "section.noMatchesHint": "管理员创建赛事后将显示在这里",
    "section.contractPaused": "合约已暂停",
    "section.pausedHint": "平台已紧急暂停，投注和领奖功能暂时关闭",
    "section.connectToBet": "请先连接钱包以参与竞猜",

    // 赛事详情
    "detail.myBet": "我的投注",
    "detail.option": "选项:",

    // Toast
    "toast.txSubmitted": "交易已提交，等待确认...",
    "toast.betSuccess": "投注成功",
    "toast.betFailed": "投注失败",
    "toast.cancelSubmitted": "取消交易已提交...",
    "toast.cancelSuccess": "投注已取消，USDT 已退回",
    "toast.cancelFailed": "取消失败",
    "toast.claimSubmitted": "领取交易已提交...",
    "toast.claimSuccess": "领取成功",
    "toast.claimFailed": "领取失败",
    "toast.createSubmitted": "创建赛事交易已提交...",
    "toast.createSuccess": "赛事创建成功",
    "toast.createFailed": "创建失败",
    "toast.recordSubmitted": "录入赛果交易已提交...",
    "toast.recordSuccess": "赛果录入成功",
    "toast.recordFailed": "录入失败",
    "toast.adminSubmitted": "交易已提交...",
    "toast.adminSuccess": "操作成功",
    "toast.adminFailed": "操作失败",
    "toast.txCancelled": "交易已取消",
    "toast.approveSubmitted": "授权交易已提交...",
    "toast.approveSuccess": "授权成功",
    "toast.approveFailed": "授权失败",
    "toast.pauseSubmitted": "操作已提交...",
    "toast.paused": "已暂停",
    "toast.resumed": "已恢复",
    "toast.feeSubmitted": "提现交易已提交...",
    "toast.feeSuccess": "手续费提取成功",
    "toast.feeFailed": "提现失败",
    "toast.deleteSubmitted": "删除赛事交易已提交...",
    "toast.deleteSuccess": "赛事已删除",
    "toast.deleteFailed": "删除失败",

    // 确认弹窗
    "confirm.betTitle": "确认投注",
    "confirm.addTitle": "追加投注",
    "confirm.switchTitle": "切换投注",
    "confirm.cancelTitle": "取消投注",
    "confirm.claimTitle": "领取奖励",
    "confirm.confirm": "确认",
    "confirm.cancel": "取消",
    "confirm.confirmCancel": "确认取消",
    "confirm.betMsg": "选项",
    "confirm.amount": "金额",
    "confirm.switchHint": "⚠ 切换选项后，本场投注金额将以本次输入为准（原投注从旧选项移除，差额多退少补）",
    "confirm.addHint": "在已有投注上累加金额",
    "confirm.cancelMsg": "确定要取消本场比赛的投注吗？",
    "confirm.cancelRefund": "投注金额将退回你的钱包。",
    "confirm.claimMsg": "确定要领取本场比赛的奖励吗？",
    "confirm.betDetail": "选项：",
    "confirm.amountDetail": "金额：",
    "confirm.claimDetail": "确定要领取本场比赛的奖励吗？",
    "confirm.claimAmount": "可领取",

    // 网络
    "network.unsupported": "当前网络不受支持。请切换到 Hardhat Local（chainId: 31337）或其他支持的网络。",

    // 合约错误
    "errors.insufficientBalance": "USDT 余额不足，无法完成此操作",
    "errors.insufficientAllowance": "USDT 授权额度不足，请先授权",
    "errors.transferFromFailed": "USDT 划转失败，请检查余额和授权",
    "errors.transferFailed": "USDT 转账失败",
    "errors.refundFailed": "USDT 退款失败",
    "errors.contractPaused": "合约已暂停，暂时无法操作",
    "errors.alreadyPaused": "合约已经处于暂停状态",
    "errors.notPaused": "合约未处于暂停状态",
    "errors.matchNotOpen": "赛事未开放投注",
    "errors.deadlinePassed": "投注已截止，无法操作",
    "errors.alreadySettled": "赛事已结算，无法修改",
    "errors.notSettled": "赛事尚未结算",
    "errors.matchNotExist": "赛事不存在",
    "errors.betBelowMin": "投注金额低于最低限额",
    "errors.betAboveMax": "投注金额超过最高限额",
    "errors.invalidResult": "请选择有效的投注选项",
    "errors.positiveAmount": "投注金额必须大于 0",
    "errors.alreadyPlacedBet": "你已投注过该赛事，可修改投注选项或追加金额",
    "errors.alreadyClaimed": "奖励已领取，无需重复操作",
    "errors.noBetFound": "你未在本场赛事投注",
    "errors.noBetToCancel": "没有可取消的投注",
    "errors.drawNotAllowed": "本场比赛不允许投注平局",
    "errors.onlyOwner": "仅管理员可执行此操作",
    "errors.matchNotCreated": "赛事未处于「已创建」状态",
    "errors.matchNotOpenStatus": "赛事未处于「投注中」状态",
    "errors.noFees": "没有可提取的手续费",
    "errors.invalidScores": "比分无效，无法判定结果",
    "errors.deadlineBeforeStart": "截止时间必须在开赛时间之前",
    "errors.startTimeFuture": "开赛时间必须在未来",
    "errors.deadlineFuture": "截止时间必须在未来",
    "errors.userRejected": "操作已取消",
    "errors.insufficientGas": "Gas 费不足，请充值",

    // 排行榜
    "leaderboard.title": "排行榜",
    "leaderboard.rank": "排名",
    "leaderboard.address": "地址",
    "leaderboard.wins": "猜中",
    "leaderboard.totalBets": "投注场次",
    "leaderboard.reward": "累计奖励",
    "leaderboard.wagered": "累计投注",
    "leaderboard.profit": "盈亏",
    "leaderboard.winRate": "胜率",
    "leaderboard.dataFromChain": "数据来自链上合约事件扫描。已结算赛事: {count} 场 · 上榜用户: {users} 人",
    "leaderboard.noSettledMatches": "暂无已结算赛事",
    "leaderboard.loading": "正在扫描链上数据...",
    "leaderboard.scanning": "正在扫描区块",
    "leaderboard.noData": "暂无投注数据",
    "leaderboard.rankingBy": "按盈亏降序排列，盈亏相同时按胜率排序",
    "leaderboard.mvpHint": "💡 排行榜通过扫描合约 BetPlaced 和 RewardClaimed 事件生成，以盈亏（Profit）为主要排名依据。数据实时从链上获取，确保透明公正。",
  },
  en: {
    "app.title": "WorldCup Bet",

    // Nav
    "nav.home": "Home",
    "nav.matches": "Matches",
    "nav.myBets": "My Bets",
    "nav.leaderboard": "Leaderboard",
    "nav.admin": "Admin",
    "nav.menu": "Menu",
    "nav.connect": "Connect Wallet",

    // Role
    "role.admin": "Admin",
    "role.user": "User",

    // Common
    "common.loading": "Loading...",
    "common.connectWallet": "Please connect wallet first",
    "common.checkingPermission": "Checking permissions...",
    "common.noPermission": "No admin permission",
    "common.processing": "Processing...",
    "common.unknown": "Unknown",
    "common.matchNum": "Match #",
    "common.score": "Score",
    "common.result": "Result",
    "common.correct": "Correct",
    "common.incorrect": "Incorrect",
    "common.viewDetails": "View Details",
    "common.waitingForResult": "Waiting for result...",
    "common.save": "Save",
    "common.back": "Go Back",
    "common.nextStep": "Next",
    "common.submitting": "Submitting...",

    // Config
    "config.notDeployed": "No contract deployment found",
    "config.runDeploy": "Please run npm run deploy first",
    "config.unsupportedNetwork": "Unsupported network. Switch to Conflux eSpace Testnet or Hardhat Local",
    "config.connectPrompt": "Connect wallet and switch to Conflux eSpace Testnet",

    // Match Status
    "match.status.created": "Created",
    "match.status.open": "Open",
    "match.status.closed": "Closed",
    "match.status.settled": "Settled",
    "match.status.deadlinePassed": "Deadline Passed",
    "match.notFound": "Match not found",

    // Result
    "result.pending": "Pending",
    "result.homeWin": "Home Win",
    "result.draw": "Draw",
    "result.awayWin": "Away Win",

    // Badge
    "badge.bet": "BET",
    "badge.claimable": "CLAIM",

    // Bet
    "bet.bet": "Bet",
    "bet.add": "Add Bet",
    "bet.switch": "Switch Bet",
    "bet.confirm": "Confirm Bet",
    "bet.amount": "Bet Amount",
    "bet.selectResult": "Select Result",
    "bet.enterAmount": "Enter amount to confirm bet",
    "bet.enterAmountAdd": "Enter amount to add bet",
    "bet.cancel": "Cancel Bet & Refund",
    "bet.cancelTitle": "Cancel Bet",
    "bet.homeWin": "Home",
    "bet.awayWin": "Away",
    "bet.minAmount": "Min",
    "bet.maxAmount": "Max",
    "bet.belowMin": "Below minimum",
    "bet.aboveMax": "Above maximum",
    "bet.checkingBalance": "Checking balance & allowance...",
    "bet.insufficientBalance": "Insufficient USDT Balance",
    "bet.requestingApproval": "Requesting approval...",
    "bet.approving": "Confirming approval...",
    "bet.stepApprove": "① Approve USDT",
    "bet.cancelling": "Cancelling...",
    "bet.confirming": "Confirming...",
    "bet.success": "Bet Placed!",
    "bet.successDesc": "Transaction confirmed, data auto-updated",
    "bet.cancelled": "Bet Cancelled",
    "bet.cancelledDesc": "USDT refunded to your wallet",
    "bet.existingBet": "You bet on",
    "bet.existingBetHint": "Same option: this amount is added to your existing bet · Different option: the amount you enter now becomes your new bet, and the difference vs your old bet is automatically charged or refunded",
    "bet.noWinnerHint": "Risk notice: if no one picks the final result, the entire pool goes to the platform and is not refunded.",

    // Claim
    "claim.reward": "Claim Reward",
    "claim.confirm": "Confirm Claim",
    "claim.claimable": "Claimable Reward",
    "claim.success": "Claimed",
    "claim.congrats": "Congrats! You won!",
    "claim.noWin": "Did not win",
    "claim.alreadyClaimed": "Claimed",
    "claim.alreadySettled": "Settled",
    "claim.claiming": "Claiming...",
    "claim.pausedHint": "Claim is temporarily disabled",

    // Pool
    "pool.title": "Prize Pool",
    "pool.homeWin": "Home Win",
    "pool.draw": "Draw",
    "pool.awayWin": "Away Win",
    "pool.label": "Pool:",
    "pool.odds": "Odds",
    "card.participants": "players",
    "bet.quickAmount": "Quick amount",
    "page.prev": "Previous",
    "page.next": "Next",
    "page.first": "First",
    "page.last": "Last",
    "page.jumpTo": "Go to page",
    "page.go": "Go",
    "sort.newest": "Newest first",
    "sort.oldest": "Oldest first",
    "sort.byTime": "By time",
    "sort.byPool": "By pool",
    "sort.asc": "Asc",
    "sort.desc": "Desc",
    "filter.date": "Filter by date",
    "filter.team": "Search team",
    "filter.teamPlaceholder": "e.g. Brazil",

    // Admin
    "admin.title": "Admin Panel",
    "admin.createMatch": "Create Match",
    "admin.matchName": "Match Name",
    "admin.homeTeam": "Home Team",
    "admin.awayTeam": "Away Team",
    "admin.startTime": "Start Time (UTC+8)",
    "admin.deadline": "Bet Deadline",
    "admin.minBet": "Min Bet (USDT)",
    "admin.maxBet": "Max Bet (0 = Unlimited)",
    "admin.allowDraw": "Allow draw betting?",
    "admin.allowDrawHint": "Uncheck for knockout matches",
    "admin.create": "Create Match",
    "admin.matchMgmt": "Match Management",
    "admin.open": "Open",
    "admin.close": "Close",
    "admin.record": "Record",
    "admin.delete": "Delete",
    "admin.deleteTitle": "Confirm Delete Match",
    "admin.deleteConfirm": "Are you sure you want to delete this match? This action is irreversible — all match data will be permanently removed.",
    "admin.deleteWarning": "⚠ Match data cannot be restored after deletion. Please verify carefully before proceeding.",
    "admin.deleteHint": "Only matches in \"Created\" status (not yet opened) can be deleted",
    "admin.pause": "Emergency Pause",
    "admin.paused": "Paused",
    "admin.running": "Running",
    "admin.resume": "Resume",
    "admin.pauseBtn": "Pause",
    "admin.fee": "Platform Fee",
    "admin.feeWithdraw": "Pending",
    "admin.withdraw": "Withdraw Fee",
    "admin.recordScore": "Record Score",
    "admin.confirmSubmit": "Confirm Submit",
    "admin.deadlineHint": "Deadline must be before start time",
    "admin.nameEncodeError": "Name encoding failed. Use shorter names (English ≤32 chars, Chinese ≤10 chars)",
    "admin.createHint": "After creating, click the \"Open\" button below to enable betting. Deadline must be before start time.",
    "admin.createButton": "📝 Create Match",
    "admin.table.match": "Match",
    "admin.table.status": "Status",
    "admin.table.actions": "Actions",
    "admin.errorTitle": "Transaction Failed",
    "admin.scoreError": "Score must be an integer between 0 and 999",
    "admin.ph.matchName": "e.g. World Cup Final / Premier League Round 30",
    "admin.ph.homeTeam": "e.g. Brazil",
    "admin.ph.awayTeam": "e.g. Germany",
    "admin.ph.minBet": "e.g. 0.01",
    "admin.ph.maxBet": "e.g. 100 or leave empty",
    "admin.resultLabel": "Result: ",
    "admin.irreversibleWarning": "⚠ Irreversible! Please verify the score carefully",
    "admin.pauseStatus": "Status:",
    "admin.pauseLoading": "⏳ Loading...",
    "admin.pauseIndicator": "🔴 Paused",
    "admin.runningIndicator": "🟢 Running",
    "admin.feePending": "Pending:",

    // Filter
    "filter.all": "All",
    "filter.my": "My Bets",
    "filter.open": "Open",
    "filter.closed": "Closed",
    "filter.settled": "Settled",

    // My Bets
    "myBets.title": "My Bets",
    "myBets.totalBets": "Total Bets",
    "myBets.wins": "Wins",
    "myBets.winRate": "Win Rate",
    "myBets.profit": "P&L",
    "myBets.noBets": "No bets yet",
    "myBets.deleted": "(Deleted)",
    "myBets.goBet": "Go Bet →",
    "myBets.table.match": "Match",
    "myBets.table.prediction": "Prediction",
    "myBets.table.amount": "Amount",
    "myBets.table.result": "Result",
    "myBets.table.status": "Status",
    "myBets.claimableTotal": "Claimable Rewards",
    "myBets.claimableHint": "{count} matches ready to claim",

    // Matches
    "matches.title": "Matches",

    // Stats
    "stats.totalMatches": "Total Matches",
    "stats.totalPool": "Total Pool",
    "stats.activePool": "Active Pool",
    "stats.openMatches": "Open",
    "stats.settledCount": "Settled",
    "stats.matchBreakdown": "{total} total · {open} open · {closed} closed · {settled} settled",

    // Sections
    "section.hot": "🔥 Hot Matches",
    "section.upcoming": "⏰ Upcoming",
    "section.noMatches": "No matches",
    "section.noMatchesHint": "Admin creates matches to show here",
    "section.contractPaused": "Contract Paused",
    "section.pausedHint": "Betting and claiming are temporarily disabled",
    "section.connectToBet": "Please connect wallet to bet",

    // Detail
    "detail.myBet": "My Bet",
    "detail.option": "Option:",

    // Toast
    "toast.txSubmitted": "Transaction submitted...",
    "toast.betSuccess": "Bet placed",
    "toast.betFailed": "Bet failed",
    "toast.cancelSubmitted": "Cancel submitted...",
    "toast.cancelSuccess": "Bet cancelled, USDT refunded",
    "toast.cancelFailed": "Cancel failed",
    "toast.claimSubmitted": "Claim submitted...",
    "toast.claimSuccess": "Reward claimed",
    "toast.claimFailed": "Claim failed",
    "toast.createSubmitted": "Create match submitted...",
    "toast.createSuccess": "Match created",
    "toast.createFailed": "Create failed",
    "toast.recordSubmitted": "Record score submitted...",
    "toast.recordSuccess": "Score recorded",
    "toast.recordFailed": "Record failed",
    "toast.adminSubmitted": "Transaction submitted...",
    "toast.adminSuccess": "Success",
    "toast.adminFailed": "Operation failed",
    "toast.txCancelled": "Transaction cancelled",
    "toast.approveSubmitted": "Approval submitted...",
    "toast.approveSuccess": "Approved",
    "toast.approveFailed": "Approval failed",
    "toast.pauseSubmitted": "Transaction submitted...",
    "toast.paused": "Paused",
    "toast.resumed": "Resumed",
    "toast.feeSubmitted": "Withdrawal submitted...",
    "toast.feeSuccess": "Fee withdrawn",
    "toast.feeFailed": "Withdrawal failed",
    "toast.deleteSubmitted": "Delete match submitted...",
    "toast.deleteSuccess": "Match deleted",
    "toast.deleteFailed": "Delete failed",

    // Confirm Dialog
    "confirm.betTitle": "Confirm Bet",
    "confirm.addTitle": "Add Bet",
    "confirm.switchTitle": "Switch Bet",
    "confirm.cancelTitle": "Cancel Bet",
    "confirm.claimTitle": "Claim Reward",
    "confirm.confirm": "Confirm",
    "confirm.cancel": "Cancel",
    "confirm.confirmCancel": "Confirm Cancel",
    "confirm.betMsg": "Option",
    "confirm.amount": "Amount",
    "confirm.switchHint": "⚠ After switching, your bet for this match equals the amount you enter now (old bet removed from the previous option; the difference is charged or refunded)",
    "confirm.addHint": "Adding to your existing bet",
    "confirm.cancelMsg": "Are you sure you want to cancel this bet?",
    "confirm.cancelRefund": "Your bet amount will be refunded to your wallet.",
    "confirm.claimMsg": "Confirm to claim your reward?",
    "confirm.betDetail": "Option: ",
    "confirm.amountDetail": "Amount: ",
    "confirm.claimDetail": "Confirm to claim your reward?",
    "confirm.claimAmount": "Claimable",

    // Network
    "network.unsupported": "Unsupported network. Please switch to Hardhat Local (chainId: 31337) or another supported network.",

    // Contract errors
    "errors.insufficientBalance": "Insufficient USDT balance",
    "errors.insufficientAllowance": "Insufficient USDT allowance, please approve first",
    "errors.transferFromFailed": "USDT transfer failed, check balance and allowance",
    "errors.transferFailed": "USDT transfer failed",
    "errors.refundFailed": "USDT refund failed",
    "errors.contractPaused": "Contract is paused, operations suspended",
    "errors.alreadyPaused": "Contract is already paused",
    "errors.notPaused": "Contract is not paused",
    "errors.matchNotOpen": "Match is not open for betting",
    "errors.deadlinePassed": "Betting deadline has passed",
    "errors.alreadySettled": "Match already settled",
    "errors.notSettled": "Match not yet settled",
    "errors.matchNotExist": "Match does not exist",
    "errors.betBelowMin": "Bet amount below minimum",
    "errors.betAboveMax": "Bet amount above maximum",
    "errors.invalidResult": "Please select a valid betting option",
    "errors.positiveAmount": "Bet amount must be positive",
    "errors.alreadyPlacedBet": "You have already placed a bet, you can modify or add",
    "errors.alreadyClaimed": "Reward already claimed",
    "errors.noBetFound": "No bet found for this match",
    "errors.noBetToCancel": "No bet to cancel",
    "errors.drawNotAllowed": "Draw betting is not allowed for this match",
    "errors.onlyOwner": "Only the contract owner can perform this action",
    "errors.matchNotCreated": "Match is not in Created status",
    "errors.matchNotOpenStatus": "Match is not in Open status",
    "errors.noFees": "No fees to withdraw",
    "errors.invalidScores": "Invalid scores, cannot determine result",
    "errors.deadlineBeforeStart": "Deadline must be before start time",
    "errors.startTimeFuture": "Start time must be in the future",
    "errors.deadlineFuture": "Deadline must be in the future",
    "errors.userRejected": "Transaction cancelled",
    "errors.insufficientGas": "Insufficient gas fees",

    // Leaderboard
    "leaderboard.title": "Leaderboard",
    "leaderboard.rank": "Rank",
    "leaderboard.address": "Address",
    "leaderboard.wins": "Wins",
    "leaderboard.totalBets": "Bets",
    "leaderboard.reward": "Total Reward",
    "leaderboard.wagered": "Total Wagered",
    "leaderboard.profit": "P&L",
    "leaderboard.winRate": "Win Rate",
    "leaderboard.dataFromChain": "Data from on-chain event scanning. Settled matches: {count} · Ranked users: {users}",
    "leaderboard.noSettledMatches": "No settled matches yet",
    "leaderboard.loading": "Scanning on-chain data...",
    "leaderboard.scanning": "Scanning blocks",
    "leaderboard.noData": "No bet data yet",
    "leaderboard.rankingBy": "Sorted by profit descending, then by win rate",
    "leaderboard.mvpHint": "💡 The leaderboard is generated by scanning BetPlaced and RewardClaimed contract events, ranked primarily by profit (P&L). Data is fetched on-chain in real time, ensuring transparency and fairness.",
  },
};

// ============================================================================
// 语言上下文（Context）— 为整个应用树提供翻译能力
// ============================================================================
//
// 三层导出：
//   LangProvider  → 在 LayoutClient 层包裹，提供 lang/setLang 状态
//   useT()        → 返回翻译函数 t(key)，组件最常用的调用方式
//   useLang()     → 返回 { lang, t, setLang }，需要切换语言的组件使用
//
// t 函数使用 useCallback + lang 依赖，确保语言切换时所有调用方自动重新渲染。
// Key 不存在时回退到原始 key 字符串，避免翻译缺失导致白屏。
const LangContext = createContext<{ lang: Lang; t: (key: string) => string; setLang: (l: Lang) => void }>({
  lang: "zh",
  t: (k) => k,
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");

  const t = useCallback((key: string) => {
    return dict[lang][key] || key;  // Key 缺失时降级显示原始 key
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useT() {
  return useContext(LangContext).t;
}
export function useLang() {
  return useContext(LangContext);
}
