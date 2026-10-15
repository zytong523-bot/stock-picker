import { useEffect, useState } from 'react'
import '../App.css'
import StockCard from '@/sections/StockCard'
import HoldingsSection from '@/sections/HoldingsSection'
import SettingsDialog from '@/sections/SettingsDialog'
import type { RecommendationData, StockRec } from '@/types/recommendation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { loadConfig, fetchRecommendations, cloudReady, type SyncConfig } from '@/lib/sync'

type Filter = 'all' | 'buy' | 'watch' | 'avoid'
type PageTab = 'recs' | 'holdings'

const TIPS = [
  { title: '只用闲钱', text: '股票短期波动很大，只投入 3 年内用不到的钱，先把应急生活费留好。' },
  { title: '分批买入，别一次梭哈', text: '看好一只股票也建议分 2–3 次买入。买错了亏得少，买对了也只是少赚一点。' },
  { title: '给自己定条止损线', text: '买入前就想好：跌多少（比如 8%）就认错离场。新手最大的亏损都来自“再等等”。' },
  { title: '不追大涨后的股票', text: '短线涨幅过大的股票回调风险高。本页把 RSI 过热的股票直接降级，就是这个原因。' },
  { title: '先少买几手练感觉', text: '第一笔交易的目标不是赚钱，而是完整体验一遍买卖流程，熟悉之后再逐步加大投入。' },
  { title: '评级只是参考', text: '本页是基于公开数据的规则化分析，不构成投资建议。下单前请再读一遍公司最近的新闻和公告。' },
]

const GLOSSARY = [
  { term: '均线（MA）', desc: '最近 N 天收盘价的平均值。股价站在均线上方 = 近期买入的人大多赚钱，趋势偏强；常用的有 20 日（近一个月）和 60 日（近一季度）。' },
  { term: 'RSI', desc: '相对强弱指标，0–100。低于 30 算超卖（跌过头），高于 70–80 算超买（涨过头）。40–70 之间最健康。' },
  { term: 'MACD', desc: '趋势动量指标。快线在上、慢线在下，说明上涨动能在增强；反之则在减弱。' },
  { term: 'ROE', desc: '净资产收益率，衡量公司用自己的本钱赚钱的能力。长期高于 10% 通常说明公司质地不错。' },
  { term: '多头排列', desc: '5 日均线 > 10 日 > 20 日，短期成本一层比一层高，是经典的强势形态。' },
  { term: '成交量', desc: '成交的股票数量。价格上涨伴随放量，说明有真金白银在进场；缩量上涨则要打个问号。' },
]

const METHOD = [
  { name: '趋势', weight: 40, desc: '股价是否站在 20 日 / 60 日均线上方，均线是否多头排列。趋势向上的股票，买入后顺风顺水的概率更高。' },
  { name: '动量', weight: 25, desc: 'MACD 方向 + RSI 位置。动能增强且 RSI 处于 40–70 健康区间得分最高；RSI 过热（>80）会被直接降级为「不建议买」。' },
  { name: '量能', weight: 15, desc: '最近 5 日平均成交量对比之前 20 日。放量说明关注度升温，缩量说明人气在退。' },
  { name: '基本面', weight: 20, desc: '上半年 ROE（净资产收益率）。ROE ≥ 15% 拿满分，因为这是公司赚钱能力的直接体现。' },
]

const FILTER_LABEL: Record<Filter, string> = {
  all: '全部',
  buy: '可买',
  watch: '观望',
  avoid: '不建议买',
}

export default function Home() {
  const [data, setData] = useState<RecommendationData | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState<PageTab>('recs')
  const [error, setError] = useState(false)
  const [cfg, setCfg] = useState<SyncConfig>(loadConfig)

  useEffect(() => {
    setData(null)
    setError(false)
    fetchRecommendations(cfg)
      .then((d) => setData(d))
      .catch(() => setError(true))
  }, [cfg])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        数据加载失败，请重新运行 pipeline 生成 recommendations.json
      </div>
    )
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">加载中…</div>
  }

  const shown: StockRec[] = filter === 'all' ? data.stocks : data.stocks.filter((s) => s.verdict === filter)

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="secondary">{data.market}市场</Badge>
            <Badge variant="outline">数据日期 {data.date}</Badge>
            <Badge variant={cloudReady(cfg) ? 'default' : 'outline'}>
              {cloudReady(cfg) ? '云端同步已开启' : '仅本机'}
            </Badge>
            <SettingsDialog onChanged={setCfg} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">每日选股助手</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            用一套固定、透明的规则给常见白马股打分，告诉你今天哪些「可买」、哪些「观望」、哪些「不建议买」；
            买入后还能在「我的持仓」里跟踪提醒：继续持有、考虑减仓还是建议卖出。专为新手设计，不构成投资建议。
          </p>
        </header>

        <Tabs value={page} onValueChange={(v) => setPage(v as PageTab)} className="mb-6">
          <TabsList>
            <TabsTrigger value="recs">每日推荐</TabsTrigger>
            <TabsTrigger value="holdings">我的持仓</TabsTrigger>
          </TabsList>

        <TabsContent value="holdings">
          <HoldingsSection data={data} cfg={cfg} />
        </TabsContent>

        <TabsContent value="recs">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { key: 'buy', label: '可买', count: data.counts.buy, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
            { key: 'watch', label: '观望', count: data.counts.watch, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
            { key: 'avoid', label: '不建议买', count: data.counts.avoid, cls: 'border-rose-200 bg-rose-50 text-rose-700' },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key as Filter)}
              className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${c.cls}`}
            >
              <div className="text-3xl font-bold tabular-nums">{c.count}</div>
              <div className="text-sm font-medium mt-1">今日{c.label}</div>
            </button>
          ))}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-6">
          <TabsList>
            {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
              <TabsTrigger key={f} value={f}>{FILTER_LABEL[f]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Stock grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-12">
          {shown.map((s) => (
            <StockCard key={s.ticker} stock={s} />
          ))}
        </div>

        {/* Methodology */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-1">评分是怎么算出来的？</h2>
          <p className="text-sm text-muted-foreground mb-4">
            满分 100，四个维度加权。规则完全透明，你可以拿着数据自己复算。
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {METHOD.map((m) => (
              <div key={m.name} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">{m.name}</h3>
                  <Badge variant="secondary">权重 {m.weight}%</Badge>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mt-4">
            <h3 className="font-bold mb-1">评级标准</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              综合评分 ≥ 70 且短线不过热 → <span className="font-semibold text-emerald-700">可买</span>；
              50–69 之间、趋势没有明显走坏 → <span className="font-semibold text-amber-700">观望</span>；
              评分不足 50、或股价跌破 60 日均线、或 RSI6 超过 80（短线过热） → <span className="font-semibold text-rose-700">不建议买</span>。
            </p>
          </div>
        </section>

        {/* Glossary */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">新手名词表</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="rounded-2xl border bg-white p-5 shadow-sm">
                <h3 className="font-bold mb-1">{g.term}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">给新手的 6 条铁律</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {TIPS.map((t, i) => (
              <div key={t.title} className="rounded-2xl border bg-white p-5 shadow-sm flex gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold mb-1">{t.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{t.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        </TabsContent>
        </Tabs>

        <footer className="text-center text-xs text-muted-foreground pb-8 leading-relaxed">
          数据来源：iFinD（同花顺），基于 2026-10-15 收盘数据 · 本页面仅供学习研究，不构成任何投资建议
          <br />股市有风险，投资需谨慎
        </footer>
      </div>
    </div>
  )
}
