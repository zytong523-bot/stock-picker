import type { StockRec } from '@/types/recommendation'

export interface Holding {
  id: string
  ticker: string
  name: string
  shares: number
  cost: number
  amount: number
  date: string // YYYY-MM-DD 买入日期
}

export type AdviceLevel = 'hold' | 'trim' | 'sell'

export interface Advice {
  level: AdviceLevel
  label: string
  pnl: number
  pnlPct: number
  marketValue: number
  daysHeld: number
  stopPrice: number
  targetPrice: number
  reasons: string[]
}

const STOP_RATIO = 0.92 // 止损线：成本价的 92%（-8%）
const TARGET_RATIO = 1.15 // 目标价：成本价的 115%（+15%）

export function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

/** 买入金额 → 实际可买股数（A股 100 股为一手，向下取整） */
export function sharesForAmount(amount: number, cost: number): number {
  if (cost <= 0) return 0
  return Math.floor(amount / cost / 100) * 100
}

export function advise(h: Holding, s: StockRec, dataDate: string): Advice {
  const price = s.price
  const pnl = (price - h.cost) * h.shares
  const pnlPct = h.cost > 0 ? (price / h.cost - 1) * 100 : 0
  const marketValue = price * h.shares
  const stopPrice = h.cost * STOP_RATIO
  const targetPrice = h.cost * TARGET_RATIO
  const reasons: string[] = []
  let level: AdviceLevel = 'hold'

  if (price <= stopPrice) {
    level = 'sell'
    reasons.push(
      `现价 ¥${price} 已跌破止损线 ¥${stopPrice.toFixed(2)}（买入成本下跌 8%）。止损纪律的意义就是不让小亏拖成大亏，建议按纪律卖出。`
    )
  } else if (s.ma60 != null && price < s.ma60 * 0.99 && pnlPct <= -3) {
    level = 'sell'
    reasons.push(
      `股价已明显跌破 60 日均线（¥${s.ma60}），中期趋势走坏，且这笔持仓浮亏已达 ${pnlPct.toFixed(1)}%。趋势和成本双输，不建议硬扛，按纪律应卖出。`
    )
  } else if (pnlPct >= 15) {
    level = 'trim'
    reasons.push(
      `收益已达 ${pnlPct.toFixed(1)}%，超过了 +15% 的目标线 ¥${targetPrice.toFixed(2)}。建议卖出一半锁定利润，剩下一半让利润继续奔跑。`
    )
    if (s.rsi6 != null && s.rsi6 > 80) {
      reasons.push(`同时短线 RSI6=${s.rsi6.toFixed(0)} 已过热，回落风险在加大，减仓更稳妥。`)
    }
  } else if (s.rsi6 != null && s.rsi6 > 80) {
    level = 'trim'
    reasons.push(
      `短线 RSI6=${s.rsi6.toFixed(0)} 超过 80，出现过热信号。即便中线看好，也可以先减一部分仓位，等回调再接回。`
    )
  }

  if (level === 'hold') {
    if (s.ma20 != null && price >= s.ma20 && (s.ma60 == null || price >= s.ma60)) {
      reasons.push(`股价站在 20 日（¥${s.ma20}）和 60 日均线之上，趋势健康，安心持有。`)
    } else if (s.ma60 != null && price >= s.ma60) {
      reasons.push(`股价仍在 60 日均线（¥${s.ma60}）上方，中期趋势没走坏，可以继续持有，但已跌破 20 日线，要提高警惕。`)
    } else {
      reasons.push(`股价处于均线下方，趋势偏弱。目前没有触发止损，可以先观察，但请每天看一眼止损线 ¥${stopPrice.toFixed(2)}。`)
    }
    if (pnlPct >= 10) {
      reasons.push(`目前盈利 ${pnlPct.toFixed(1)}%，距离 +15% 的目标价 ¥${targetPrice.toFixed(2)} 已经不远，接近时记得分批止盈。`)
    }
    if (price <= stopPrice * 1.03) {
      reasons.push(`现价距离止损线 ¥${stopPrice.toFixed(2)} 已不足 3%，一旦跌破请果断执行，不要抱有侥幸心理。`)
    }
  }

  return {
    level,
    label: level === 'hold' ? '继续持有' : level === 'trim' ? '考虑减仓' : '建议卖出',
    pnl: Math.round(pnl * 100) / 100,
    pnlPct: Math.round(pnlPct * 100) / 100,
    marketValue: Math.round(marketValue * 100) / 100,
    daysHeld: daysBetween(h.date, dataDate),
    stopPrice: Math.round(stopPrice * 100) / 100,
    targetPrice: Math.round(targetPrice * 100) / 100,
    reasons,
  }
}
