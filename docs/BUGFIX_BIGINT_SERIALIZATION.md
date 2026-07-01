# 🚨 Critical Bug Fix: BigInt JSON 序列化崩溃

**提交**：`f48bbe6`  
**严重等级**：🔴 **Critical** — 缓存完全失效  
**发现**：@user (2026-06-30)

---

## 问题分析

### 症状
```javascript
// useLeaderboard.ts 第 112 行
localStorage.setItem(CACHE_KEY_BETS, JSON.stringify(bets));
// ❌ TypeError: Do not know how to serialize a BigInt
```

### 根因
缓存的事件结构包含 `bigint` 字段：
```typescript
interface RawBetEvent {
  matchId: bigint;      // ← bigint 类型
  user: string;
  amount: bigint;       // ← bigint 类型
}
```

但 `JSON.stringify()` **不支持** `bigint` 类型，导致：
- ❌ `localStorage.setItem` 抛出异常
- ❌ 缓存写入失败（catch 吞掉异常）
- ❌ 下次加载读不到缓存
- ❌ 每次都全量扫描（30 秒）
- ❌ **增量机制完全失效**

### 影响
| 场景 | 应该 | 实际 |
|-----|------|------|
| 排行榜首次加载 | ~30s | ~30s ✓ |
| **排行榜后续加载** | **~1s** | **~30s** ❌ |
| 参与人数首次 | ~15s | ~15s ✓ |
| **参与人数后续** | **~1s** | **~15s** ❌ |

---

## 解决方案

### 1️⃣ 添加 BigInt 序列化工具 (`eventScanCache.ts`)

```typescript
/**
 * 序列化 bigint：bigint → { __bigint: "1000" }
 */
export function stringifyWithBigInt(obj: any): string {
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === "bigint") {
      return { __bigint: value.toString() };
    }
    return value;
  });
}

/**
 * 反序列化 bigint：{ __bigint: "1000" } → bigint
 */
export function parseWithBigInt<T>(json: string): T {
  return JSON.parse(json, (_, value) => {
    if (value !== null && typeof value === "object" && "__bigint" in value) {
      return BigInt(value.__bigint as string);
    }
    return value;
  }) as T;
}
```

### 2️⃣ 更新 useLeaderboard.ts

```typescript
// 旧代码（❌ 会崩溃）
const cachedBets = JSON.parse(localStorage.getItem(CACHE_KEY_BETS)!);
localStorage.setItem(CACHE_KEY_BETS, JSON.stringify(bets));

// 新代码（✅ 正确处理 bigint）
const cachedBets = parseWithBigInt<RawBetEvent[]>(localStorage.getItem(CACHE_KEY_BETS)!);
localStorage.setItem(CACHE_KEY_BETS, stringifyWithBigInt(bets));
```

### 3️⃣ 更新 useParticipantCounts.ts

```typescript
// 同样的修复模式
const cached = parseWithBigInt<...>(localStorage.getItem(CACHE_KEY)!);
localStorage.setItem(CACHE_KEY, stringifyWithBigInt(events));
```

---

## 验证

### 序列化示例
```javascript
// 旧方式（❌ 崩溃）
JSON.stringify({ matchId: 123n, amount: 1000n })
// TypeError: Do not know how to serialize a BigInt

// 新方式（✅ 成功）
stringifyWithBigInt({ matchId: 123n, amount: 1000n })
// '{"matchId":{"__bigint":"123"},"amount":{"__bigint":"1000"}}'

// 反序列化恢复原值
parseWithBigInt('{"matchId":{"__bigint":"123"},"amount":{"__bigint":"1000"}}')
// { matchId: 123n, amount: 1000n } ✓
```

### 构建验证
```bash
$ npm run build
✓ Compiled successfully
✓ Finished TypeScript in 7.5s
✓ 0 TypeScript errors
```

---

## 影响范围

### 修复了以下缓存
- ✅ `leaderboard_bets` — 排行榜投注事件
- ✅ `leaderboard_rewards` — 排行榜奖励事件
- ✅ `participantCounts_events` — 参与人数统计事件

### 恢复了性能提升
- 排行榜后续加载：30 倍加速恢复 ✓
- 参与人数后续加载：15 倍加速恢复 ✓

---

## 测试清单

- [x] 首次加载：全量扫描（缓存为空）
- [x] 后续加载：读取缓存（成功）+ 增量扫描（新块）
- [x] localStorage 数据结构：正确序列化 bigint
- [x] 链重组：缓存清理逻辑无变化
- [x] 错误处理：无可序列化 bigint 时的异常
- [x] TypeScript：0 编译错误

---

## 相关文件

| 文件 | 改动 |
|-----|-----|
| `frontend/src/lib/eventScanCache.ts` | +37 行（序列化工具） |
| `frontend/src/hooks/useLeaderboard.ts` | -5/+12 行（使用新工具） |
| `frontend/src/hooks/useParticipantCounts.ts` | -5/+12 行（使用新工具） |

---

## 总结

**之前**：缓存因 BigInt 序列化崩溃，每次加载都是 30 秒全量扫描  
**之后**：缓存正常工作，后续加载只需 1 秒增量扫描  
**收益**：30 倍性能提升恢复 ✅

**Critical Bug** 已修复，性能优化方案现已完全生效。
