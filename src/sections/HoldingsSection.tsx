import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, PiggyBank, Cloud, CloudOff } from 'lucide-react'
import type { RecommendationData } from '@/types/recommendation'
import {
  advise, sharesForAmount, type Advice, type Holding,
} from '@/lib/advice'
import {
  loadHoldings, persistHolding, removeHolding, cloudReady,
  type SyncConfig,
} from '@/lib/sync'

const LEVEL_STYLE = {
  hold: { badge: 'bg-emerald-500', card: 'border-emerald-200 bg-emerald-50/60', text: 'text-emerald-700' },
  trim: { badge: 'bg-amber-500', card: 'border-amber-200 bg-amber-50/60', text: 'text-amber-700' },
  sell: { badge: 'bg-rose-500', card: 'border-rose-200 bg-rose-50/60', text: 'text-rose-700' },
} as const

function loadLocal(): Holding[] {
  try {
    return JSON.parse(localStorage.getItem('stock-picker-holdings-v1') ?? '[]')
  } catch {
    return []
  }
}

export default function HoldingsSection({ data, cfg }: { data: RecommendationData; cfg: SyncConfig }) {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loadMsg, setLoadMsg] = useState('')
  const [ticker, setTicker] = useState(data.stocks[0]?.ticker ?? '')
  const [amount, setAmount] = useState('4000')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState(data.date)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoadMsg('加载持仓中…')
    loadHoldings(cfg)
      .then((list) => {
        if (cancelled) return
        setHoldings(list)
        setLoadMsg('')
      })
      .catch((e) => {
        if (cancelled) return
        setHoldings(loadLocal())
        setLoadMsg('云端读取失败，已临时使用本机数据：' + (e as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [cfg])

  const stockMap = useMemo(
    () => new Map(data.stocks.map((s) => [s.ticker, s])),
    [data.stocks],
  )

  const selected = stockMap.get(ticker)
  const costValue = cost ? Number(cost) : (selected?.price ?? 0)
  const amountValue = Number(amount) || 0
  const previewShares = sharesForAmount(amountValue, costValue)

  const addHolding = async (t: string, amt: number, cst: number, dt: string) => {
    const s = stockMap.get(t)
    const shares = sharesForAmount(amt, cst)
    if (!s) return
    if (shares <= 0) {
      setError('按这个金额和成本价买不起一手（100 股），请加大金额或降低成本价。')
      return
    }
    setError('')
    const h: Holding = {
      id: `${Date.now()}-${t}`,
      ticker: t,
      name: s.name,
      shares,
      cost: cst,
      amount: amt,
      date: dt,
    }
    try {
      await persistHolding(cfg, h)
      setHoldings((prev) => [...prev, h])
    } catch (e) {
      setError('写入失败：' + (e as Error).message)
    }
  }

  const quickAddDemo = () => {
    const icbc = stockMap.get('601398.SH')
    if (!icbc) return
    addHolding('601398.SH', 4000, icbc.price, data.date)
  }

  const totalValue = holdings.reduce((sum, h) => {
    const s = stockMap.get(h.ticker)
    return sum + (s ? s.price * h.shares : 0)
  }, 0)
  const totalCost = holdings.reduce((sum, h) => sum + h.cost * h.shares, 0)
  const totalPnl = totalValue - totalCost

  return (
    <div>
      {/* 卖出纪律 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <h3 className="font-bold mb-2">卖出纪律（系统提醒的三条线）</h3>
        <div className="grid md:grid-cols-3 gap-3 text-sm text-slate-600">
          <div className="rounded-xl bg-rose-50 p-3">
            <span className="font-semibold text-rose-700">止损线 = 成本价 × 92%</span>
            <p className="mt-1">跌破说明你看错了，果断卖出，把亏损锁在 8% 以内。</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <span className="font-semibold text-amber-700">目标价 = 成本价 × 115%</span>
            <p className="mt-1">赚到 15% 卖出一半锁定利润，剩一半继续涨也能吃到。</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <span className="font-semibold">中期趋势线 = 60 日均线</span>
            <p className="mt-1">跌破它代表近一个季度买入的人都在亏钱，趋势大概率反转。</p>
          </div>
        </div>
      </div>

      {/* 添加持仓 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-bold">记一笔买入</h3>
          <Button variant="outline" size="sm" onClick={quickAddDemo}>
            <PiggyBank className="w-4 h-4 mr-1" />
            一键示例：4000 元工商银行
          </Button>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <Label className="mb-1 block">股票</Label>
            <Select value={ticker} onValueChange={setTicker}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {data.stocks.map((s) => (
                  <SelectItem key={s.ticker} value={s.ticker}>
                    {s.name} {s.ticker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">买入金额（元）</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <Label className="mb-1 block">成本价（元，留空用现价）</Label>
            <Input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder={selected ? String(selected.price) : ''} />
          </div>
          <div>
            <Label className="mb-1 block">买入日期</Label>
            <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="2026-10-15" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Button onClick={() => addHolding(ticker, amountValue, costValue, date)}>
            <Plus className="w-4 h-4 mr-1" /> 添加持仓
          </Button>
          {previewShares > 0 && (
            <span className="text-sm text-muted-foreground">
              预计买入 <b className="text-slate-800">{previewShares}</b> 股，
              实际投入约 <b className="text-slate-800">¥{(previewShares * costValue).toFixed(0)}</b>
              （A股按 100 股一手取整，零头资金留在账上）
            </span>
          )}
        </div>
        {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
          {cloudReady(cfg) ? (
            <><Cloud className="w-3.5 h-3.5 text-emerald-600" /> 已启用云端同步：持仓实时同步到所有设备</>
          ) : (
            <><CloudOff className="w-3.5 h-3.5" /> 当前为仅本机模式：数据只存在这台设备的浏览器里（可在右上角「同步设置」配置云端）</>
          )}
        </p>
      </div>

      {loadMsg && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-2.5 mb-4">
          {loadMsg}
        </div>
      )}

      {/* 持仓列表 */}
      {holdings.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-bold">持仓总览</h3>
            <p className="text-sm text-muted-foreground">
              总市值 <b className="text-slate-800">¥{totalValue.toFixed(0)}</b>
              {' '}· 总盈亏{' '}
              <b className={totalPnl >= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                {totalPnl >= 0 ? '+' : ''}¥{totalPnl.toFixed(0)}
              </b>
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {holdings.map((h) => {
          const s = stockMap.get(h.ticker)
          if (!s) return null
          const a: Advice = advise(h, s, data.date)
          const st = LEVEL_STYLE[a.level]
          return (
            <div key={h.id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${st.card.split(' ')[1]}`}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-lg">{h.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{h.ticker}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${st.badge}`}>
                      {a.label}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          await removeHolding(cfg, h.id)
                          setHoldings((prev) => prev.filter((x) => x.id !== h.id))
                        } catch (e) {
                          setError('删除失败：' + (e as Error).message)
                        }
                      }}
                      className="text-muted-foreground hover:text-rose-600"
                      title="删除这笔持仓"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="rounded-lg bg-slate-50 py-2">
                    <div className="text-[10px] text-muted-foreground">持仓市值</div>
                    <div className="font-bold tabular-nums">¥{a.marketValue.toFixed(0)}</div>
                    <div className="text-[10px] text-muted-foreground">{h.shares} 股 · 成本 ¥{h.cost}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <div className="text-[10px] text-muted-foreground">浮动盈亏</div>
                    <div className={`font-bold tabular-nums ${a.pnl >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {a.pnl >= 0 ? '+' : ''}¥{a.pnl.toFixed(0)}
                    </div>
                    <div className={`text-[10px] tabular-nums ${a.pnl >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {a.pnlPct >= 0 ? '+' : ''}{a.pnlPct}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <div className="text-[10px] text-muted-foreground">已持有</div>
                    <div className="font-bold tabular-nums">{a.daysHeld} 天</div>
                    <div className="text-[10px] text-muted-foreground">{h.date} 买入</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center mb-3 text-xs">
                  <div className="rounded-lg border border-rose-200 py-1.5">
                    <span className="text-muted-foreground">止损线 </span>
                    <b className="text-rose-700 tabular-nums">¥{a.stopPrice}</b>
                    <span className="text-muted-foreground">（现价 ¥{s.price}）</span>
                  </div>
                  <div className="rounded-lg border border-emerald-200 py-1.5">
                    <span className="text-muted-foreground">目标价 </span>
                    <b className="text-emerald-700 tabular-nums">¥{a.targetPrice}</b>
                    <span className="text-muted-foreground">（+15% 止盈）</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                    系统提醒
                  </h4>
                  <ul className="space-y-1.5">
                    {a.reasons.map((r, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-snug">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${st.badge}`} />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {holdings.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-10 rounded-2xl border border-dashed">
          还没有持仓记录，点上面「一键示例」体验，或自己记一笔买入
        </div>
      )}
    </div>
  )
}
