import type { RecommendationData } from '@/types/recommendation'
import type { Holding } from '@/lib/advice'

export interface SyncConfig {
  dataUrl: string // 推荐数据 JSON 地址，留空 = 部署目录下的 data/recommendations.json（自动适配子路径）
  supabaseUrl: string // 留空 = 仅本机模式
  supabaseKey: string // Supabase anon public key
  ownerKey: string // 自己设的同步密钥，相当于密码
}

// Vite 的部署基路径：本地开发 = '/'，GitHub Pages 项目站点 = '/stock-picker/'，
// vite.config.ts 里 base: './' 时代 = './'。统一补成"以 / 结尾"，再拼接数据文件名。
const BASE = import.meta.env.BASE_URL || '/'

function defaultDataUrl(): string {
  return `${BASE.replace(/\/?$/, '/')}data/recommendations.json`
}

const CONFIG_KEY = 'stock-picker-sync-config'
const LOCAL_HOLDINGS_KEY = 'stock-picker-holdings-v1'

export const EMPTY_CONFIG: SyncConfig = {
  dataUrl: '',
  supabaseUrl: '',
  supabaseKey: '',
  ownerKey: '',
}

export function loadConfig(): SyncConfig {
  try {
    return { ...EMPTY_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') }
  } catch {
    return { ...EMPTY_CONFIG }
  }
}

export function saveConfig(cfg: SyncConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

export function cloudReady(cfg: SyncConfig): boolean {
  return Boolean(cfg.supabaseUrl && cfg.supabaseKey && cfg.ownerKey)
}

export async function fetchRecommendations(cfg: SyncConfig): Promise<RecommendationData> {
  const url = cfg.dataUrl.trim() || defaultDataUrl()
  const r = await fetch(url)
  if (!r.ok) throw new Error(`数据请求失败 HTTP ${r.status}`)
  return (await r.json()) as RecommendationData
}

function headers(cfg: SyncConfig): Record<string, string> {
  return {
    apikey: cfg.supabaseKey,
    Authorization: `Bearer ${cfg.supabaseKey}`,
    'x-owner-key': cfg.ownerKey,
    'Content-Type': 'application/json',
  }
}

export async function testConnection(cfg: SyncConfig): Promise<string> {
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/holdings?select=id&limit=1`, {
    headers: headers(cfg),
  })
  if (r.status === 200) return `连接成功（云端已有持仓记录可读）`
  if (r.status === 401 || r.status === 403) return '连接被拒：请检查 anon key 是否正确'
  if (r.status === 404) return '找不到 holdings 表：请先在 Supabase SQL 编辑器里执行建表语句'
  return `连接失败 HTTP ${r.status}：${(await r.text()).slice(0, 120)}`
}

export async function loadHoldings(cfg: SyncConfig): Promise<Holding[]> {
  if (!cloudReady(cfg)) {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_HOLDINGS_KEY) ?? '[]')
    } catch {
      return []
    }
  }
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/holdings?select=*&order=created_at`, {
    headers: headers(cfg),
  })
  if (!r.ok) throw new Error(`读取云端持仓失败 HTTP ${r.status}`)
  const rows = await r.json()
  return rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    shares: Number(row.shares),
    cost: Number(row.cost),
    amount: Number(row.amount),
    date: row.date,
  }))
}

export async function persistHolding(cfg: SyncConfig, h: Holding) {
  if (!cloudReady(cfg)) {
    const list: Holding[] = JSON.parse(localStorage.getItem(LOCAL_HOLDINGS_KEY) ?? '[]')
    localStorage.setItem(LOCAL_HOLDINGS_KEY, JSON.stringify([...list, h]))
    return
  }
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/holdings`, {
    method: 'POST',
    headers: { ...headers(cfg), Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: h.id, owner_key: cfg.ownerKey, ticker: h.ticker, name: h.name,
      shares: h.shares, cost: h.cost, amount: h.amount, date: h.date,
    }),
  })
  if (!r.ok) throw new Error(`同步到云端失败 HTTP ${r.status}`)
}

export async function removeHolding(cfg: SyncConfig, id: string) {
  if (!cloudReady(cfg)) {
    const list: Holding[] = JSON.parse(localStorage.getItem(LOCAL_HOLDINGS_KEY) ?? '[]')
    localStorage.setItem(LOCAL_HOLDINGS_KEY, JSON.stringify(list.filter((x) => x.id !== id)))
    return
  }
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/holdings?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(cfg),
  })
  if (!r.ok) throw new Error(`删除云端持仓失败 HTTP ${r.status}`)
}

export const SUPABASE_SETUP_SQL = `create table if not exists holdings (
  id text primary key,
  owner_key text not null,
  ticker text not null,
  name text not null,
  shares double precision not null,
  cost double precision not null,
  amount double precision not null,
  date text not null,
  created_at timestamptz not null default now()
);
alter table holdings enable row level security;
create policy "select own" on holdings for select to anon
  using (owner_key = current_setting('request.headers', true)::json->>'x-owner-key');
create policy "insert own" on holdings for insert to anon
  with check (owner_key = current_setting('request.headers', true)::json->>'x-owner-key');
create policy "delete own" on holdings for delete to anon
  using (owner_key = current_setting('request.headers', true)::json->>'x-owner-key');`
