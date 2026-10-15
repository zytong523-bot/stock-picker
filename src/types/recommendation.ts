export interface Signal {
  label: string
  good: boolean | null
  text: string
}

export interface StockRec {
  ticker: string
  name: string
  mainBusiness: string
  price: number
  changePct: number
  ma20: number | null
  ma60: number | null
  rsi6: number | null
  rsi12: number | null
  roe: number | null
  volRatio: number
  high52w: number
  low52w: number
  offHighPct: number
  spark: number[]
  score: number
  verdict: 'buy' | 'watch' | 'avoid'
  verdictLabel: string
  signals: Signal[]
}

export interface RecommendationData {
  date: string
  market: string
  stocks: StockRec[]
  counts: { buy: number; watch: number; avoid: number }
}
