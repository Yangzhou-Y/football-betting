/**
 * ============================================================================
 * 事件扫描缓存管理 — 增量扫描 + localStorage 持久化
 * ============================================================================
 *
 * 【问题】
 *   useLeaderboard 和 useParticipantCounts 从 deployBlock 扫描到 currentBlock，
 *   每次都需要 10-30 秒（多次 RPC 调用）。
 *
 * 【方案】
 *   ① 首次扫描：从 deployBlock 到 currentBlock（耗时）
 *   ② 后续扫描：只扫描 [lastScannedBlock+1, currentBlock]（快速）
 *   ③ 缓存：存在 localStorage，key = `eventScan_${contractAddress}_${eventName}`
 *   ④ 过期：若 lastScannedBlock > currentBlock（链回滚？）则清空缓存
 *   ⑤ 合并：页面加载时从缓存恢复历史数据 + 增量扫描新块
 *
 * 【性能提升】
 *   - 假设首次扫描 1000 万块（25 个 100k 分片 = 25 次 RPC）→ 30 秒
 *   - 后续每小时新增 ~300 块（3 个分片 = 3 次 RPC）→ 1 秒
 *   - 性能提升：30 倍 ✅
 *
 * 【缓存容量】
 *   localStorage 一般 5-10MB 限制
 *   单个事件对象 ~100 字节，10 万条事件 ≈ 10MB（接近上限）
 *   建议：若超过 100k 事件则清空缓存（使用 size 字段追踪）
 */

export interface EventScanCheckpoint {
  contractAddress: string;
  eventName: string;
  lastScannedBlock: number;
  eventCount: number; // 已缓存的事件数
  cacheTime: number; // 时间戳（用于调试）
}

/**
 * 获取上次扫描的最后块号
 * 若缓存不存在或失效，返回 null（表示需要全量扫描）
 */
export function getLastScannedBlock(
  contractAddress: string,
  eventName: string,
): number | null {
  if (typeof window === "undefined") return null;
  try {
    const key = `eventScan_${contractAddress}_${eventName}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const checkpoint = JSON.parse(stored) as EventScanCheckpoint;
    return checkpoint.lastScannedBlock;
  } catch {
    return null;
  }
}

/**
 * 保存扫描进度到 localStorage
 */
export function saveScannedBlock(
  contractAddress: string,
  eventName: string,
  blockNumber: number,
  eventCount = 0,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = `eventScan_${contractAddress}_${eventName}`;
    const checkpoint: EventScanCheckpoint = {
      contractAddress,
      eventName,
      lastScannedBlock: blockNumber,
      eventCount,
      cacheTime: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(checkpoint));
  } catch {
    // localStorage 满或被禁用，静默失败
  }
}

/**
 * 清空某个事件的缓存（例如：检测到链回滚、合约重部署等）
 */
export function clearEventScanCache(
  contractAddress: string,
  eventName: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = `eventScan_${contractAddress}_${eventName}`;
    localStorage.removeItem(key);
  } catch {
    // 忽略错误
  }
}

/**
 * 调试：获取所有扫描进度
 */
export function debugGetAllCheckpoints(): EventScanCheckpoint[] {
  if (typeof window === "undefined") return [];
  try {
    const all = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("eventScan_")) {
        const stored = localStorage.getItem(key);
        if (stored) all.push(JSON.parse(stored) as EventScanCheckpoint);
      }
    }
    return all;
  } catch {
    return [];
  }
}

// ============================================================================
// BigInt 序列化/反序列化工具（因为 JSON.stringify 不支持 bigint）
// ============================================================================

/**
 * 【问题】JSON.stringify 无法序列化 bigint：
 *   JSON.stringify({ amount: 1000n })  // ❌ TypeError: Do not know how to serialize a BigInt
 *
 * 【解决方案】使用 replacer/reviver 转换 bigint ↔ string
 *   序列化：   bigint → { __bigint: "1000" }
 *   反序列化： { __bigint: "1000" } → bigint
 */

export function stringifyWithBigInt(obj: any): string {
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === "bigint") {
      return { __bigint: value.toString() };
    }
    return value;
  });
}

export function parseWithBigInt<T>(json: string): T {
  return JSON.parse(json, (_, value) => {
    if (value !== null && typeof value === "object" && "__bigint" in value) {
      return BigInt(value.__bigint as string);
    }
    return value;
  }) as T;
}
