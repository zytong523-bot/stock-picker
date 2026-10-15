import type { StockRec } from '@/types/recommendation'

const VERDICT_STYLE = {
  buy: { bg: 'bg-emerald-500', soft: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', ring: '#10b981' },
  watch: { bg: 'bg-amber-500', soft: 'bg-amber-50 border-amber-200', text: 'text-amber-700', ring: '#f59e0b' },
  avoid: { bg: 'bg-rose-500', soft: 'bg-rose-50 border-rose-200', text: 'text-rose-700', ring: '#f43f5e' },
} as const

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 220
  const h = 56
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - 6 - ((v - min) / span) * (h - 12)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const pct = score / 100
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none">{score}</span>
        <span className="text-[10px] text-muted-foreground">评分</span>
      </div>
    </div>
  )
}

function Dot({ good }: { good: boolean | null }) {
  if (good === true) return <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
  if (good === false) return <span className="mt-1.5 w-2 h-2 rounded-full bg-rose-500 shrink-0" />
  return <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 shrink-0" />
}

export default function StockCard({ stock }: { stock: StockRec }) {
  const v = VERDICT_STYLE[stock.verdict]
  const up = stock.changePct >= 0

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${v.soft.split(' ')[1]}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <ScoreRing score={stock.score} color={v.ring} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold">{stock.name}</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${v.bg}`}>
                  {stock.verdictLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{stock.ticker} · A股</p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold tabular-nums">¥{stock.price}</span>
                <span className={`text-sm font-semibold tabular-nums ${up ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {up ? '+' : ''}{stock.changePct}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Sparkline data={stock.spark} color={v.ring} />
          <p className="text-[11px] text-muted-foreground mt-1">近 60 个交易日收盘价走势</p>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          {[
            { label: '20日均线', value: stock.ma20 ? `¥${stock.ma20}` : '—' },
            { label: '60日均线', value: stock.ma60 ? `¥${stock.ma60}` : '—' },
            { label: 'RSI(12)', value: stock.rsi12 ?? '—' },
            { label: 'ROE(半年)', value: stock.roe != null ? `${stock.roe}%` : '—' },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-slate-50 py-1.5">
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
              <div className="text-xs font-semibold tabular-nums">{m.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
            为什么是这个评级
          </h4>
          <ul className="space-y-1.5">
            {stock.signals.map((s) => (
              <li key={s.label + s.text.slice(0, 8)} className="flex gap-2 text-[13px] leading-snug">
                <Dot good={s.good} />
                <span><span className="font-semibold">{s.label}：</span>{s.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
            这家公司是做什么的
          </h4>
          <p className="text-[13px] leading-relaxed text-slate-700">
            {stock.mainBusiness || '暂无公司业务简介。'}
          </p>
        </div>
      </div>
    </div>
  )
}
