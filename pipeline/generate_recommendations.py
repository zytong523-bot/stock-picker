# -*- coding: utf-8 -*-
"""Parse raw ifind CSVs, score stocks with transparent rules, emit recommendations.json."""
import csv
import json
import math
from pathlib import Path

ROOT = Path(r"C:\Users\Administrator\Documents\Kimi\Workspaces\热量\stock-picker")
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "data" / "recommendations.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

STOCKS = ["600519.SH", "300750.SZ", "002594.SZ", "600036.SH", "601318.SH",
          "000333.SZ", "600900.SH", "000858.SZ", "600276.SH", "601398.SH"]
GROUPS = [STOCKS[i:i + 3] for i in range(0, len(STOCKS), 3)]


def key(grp):
    return "_".join(t.split(".")[0] for t in grp)


def load_prices():
    prices = {}
    for grp in GROUPS:
        with open(RAW / f"price_{key(grp)}.csv", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                t = row["thscode"]
                prices.setdefault(t, []).append({
                    "close": float(row["close"]),
                    "volume": float(row["volume"]),
                    "time": row["time"],
                })
    return prices


def load_tech():
    tech = {}
    for grp in GROUPS:
        with open(RAW / f"tech_{key(grp)}.csv", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                tech[row["code"]] = {k: float(v) for k, v in row.items()
                                     if k not in ("code", "time", "interval") and v not in ("", None)}
    return tech


def load_info():
    info = {}
    for grp in GROUPS:
        with open(RAW / f"info_{key(grp)}.csv", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                info[row["thscode"]] = row
    return info


def load_roe():
    roe = {}
    for grp in GROUPS:
        with open(RAW / f"profit_{key(grp)}.csv", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                v = row.get("ths_roe_stock", "")
                try:
                    roe[row["thscode"]] = float(v)
                except (TypeError, ValueError):
                    roe[row["thscode"]] = None
    return roe


def clamp(x, lo=0, hi=100):
    return max(lo, min(hi, x))


def score_stock(t, rows, tech, inf, roe):
    closes = [r["close"] for r in rows]
    vols = [r["volume"] for r in rows]
    last = closes[-1]
    prev = closes[-2]
    change_pct = (last / prev - 1) * 100
    hi52 = max(closes)
    lo52 = min(closes)
    # volume ratio: last 5 avg vs previous 20 avg
    avg5 = sum(vols[-5:]) / 5
    avg20 = sum(vols[-25:-5]) / 20 if len(vols) >= 25 else sum(vols[:-5]) / max(1, len(vols) - 5)
    vol_ratio = avg5 / avg20 if avg20 else 1.0

    g = lambda name, d=None: tech.get(name, d)

    signals = []  # each: {label, good, text}
    score = 0.0

    # ---- 趋势 40 ----
    ma5, ma10, ma20, ma60 = g("ma5"), g("ma10"), g("ma20"), g("ma60")
    s_trend = 0
    if ma20 and last > ma20:
        s_trend += 10
        signals.append({"label": "短期趋势", "good": True,
                        "text": f"股价（{last:.2f}）站在 20 日均线上方，近一个月走势偏强"})
    else:
        signals.append({"label": "短期趋势", "good": False,
                        "text": f"股价（{last:.2f}）跌破了 20 日均线，近一个月走势偏弱"})
    if ma60 and last > ma60:
        s_trend += 10
        signals.append({"label": "中期趋势", "good": True,
                        "text": "股价站在 60 日均线上方，中期趋势向上"})
    else:
        signals.append({"label": "中期趋势", "good": False,
                        "text": "股价跌破 60 日均线，中期趋势仍向下"})
    if ma5 and ma10 and ma20 and ma5 > ma10 > ma20:
        s_trend += 10
        signals.append({"label": "均线排列", "good": True,
                        "text": "5 日 > 10 日 > 20 日均线，呈多头排列，是技术分析里比较经典的强势形态"})
    else:
        signals.append({"label": "均线排列", "good": False,
                        "text": "短期均线未形成多头排列，强势特征不明显"})
    if ma20 and ma60 and ma20 > ma60:
        s_trend += 10
        signals.append({"label": "中期均线", "good": True,
                        "text": "20 日均线高于 60 日均线，中期成本在抬升"})
    else:
        signals.append({"label": "中期均线", "good": False,
                        "text": "20 日均线低于 60 日均线，中期成本在下降"})
    score += s_trend

    # ---- 动量 25 ----
    s_mom = 0
    dif, dea, macd = g("dif"), g("dea"), g("macd")
    if dif is not None and dea is not None and dif > dea:
        s_mom += 10
        signals.append({"label": "MACD", "good": True,
                        "text": "MACD 快线位于慢线上方，上涨动能在增强"})
    else:
        signals.append({"label": "MACD", "good": False,
                        "text": "MACD 快线位于慢线下方，上涨动能不足"})
    if macd is not None and macd > 0:
        s_mom += 5
    rsi12 = g("rsi12")
    if rsi12 is not None:
        if 40 <= rsi12 <= 70:
            s_mom += 10
            signals.append({"label": "RSI 强弱", "good": True,
                            "text": f"RSI={rsi12:.0f}，处于 40–70 的健康区间，既不太冷也不太热"})
        elif 30 <= rsi12 < 40 or 70 < rsi12 <= 80:
            s_mom += 5
            signals.append({"label": "RSI 强弱", "good": None,
                            "text": f"RSI={rsi12:.0f}，接近超买或超卖边缘，方向不太明朗"})
        else:
            signals.append({"label": "RSI 强弱", "good": False,
                            "text": f"RSI={rsi12:.0f}，" + ("严重超卖，虽有反弹可能但趋势很弱" if rsi12 < 30 else "已经过热，追高风险大")})
    score += s_mom

    # ---- 量能 15 ----
    if vol_ratio >= 1.5:
        s_vol = 15
    elif vol_ratio >= 1.2:
        s_vol = 12
    elif vol_ratio >= 1.0:
        s_vol = 8
    elif vol_ratio >= 0.8:
        s_vol = 5
    else:
        s_vol = 3
    score += s_vol
    if vol_ratio >= 1.2:
        signals.append({"label": "成交量", "good": True,
                        "text": f"最近 5 日成交量是此前的 {vol_ratio:.1f} 倍，资金关注度在升温"})
    elif vol_ratio < 0.8:
        signals.append({"label": "成交量", "good": False,
                        "text": f"最近 5 日成交量只有此前的 {vol_ratio:.1f} 倍，市场参与度在降温"})
    else:
        signals.append({"label": "成交量", "good": None,
                        "text": "成交量与前期基本持平"})

    # ---- 基本面 20 ----
    if roe is None:
        s_fund = 10
        signals.append({"label": "盈利能力", "good": None, "text": "缺少最新盈利数据，此项按中性处理"})
    elif roe >= 15:
        s_fund = 20
    elif roe >= 10:
        s_fund = 15
    elif roe >= 5:
        s_fund = 8
    else:
        s_fund = 3
    score += s_fund
    if roe is not None:
        signals.append({"label": "盈利能力", "good": roe >= 10,
                        "text": f"上半年净资产收益率（ROE）约 {roe:.1f}%，" +
                                ("赚钱能力很强" if roe >= 15 else "赚钱能力不错" if roe >= 10 else
                                 "赚钱能力一般" if roe >= 5 else "赚钱能力偏弱")})

    score = round(clamp(score), 1)
    rsi6 = g("rsi6")
    overheat = rsi6 is not None and rsi6 > 80
    below_ma60 = ma60 is not None and last < ma60

    if overheat:
        score = min(score, 64)
    if score >= 70 and not overheat:
        verdict, verdict_label = "buy", "可买"
    elif score >= 50 and not (overheat or below_ma60):
        verdict, verdict_label = "watch", "观望"
    else:
        verdict, verdict_label = "avoid", "不建议买"

    if overheat:
        signals.append({"label": "风险提示", "good": False,
                        "text": f"短线 RSI6={rsi6:.0f} 已超过 80，短期涨幅过大，即便看好也建议等回调再考虑"})

    return {
        "ticker": t,
        "name": (inf.get(t) or {}).get("ths_stock_short_name_stock", t),
        "mainBusiness": (inf.get(t) or {}).get("ths_main_businuess_stock", ""),
        "price": round(last, 2),
        "changePct": round(change_pct, 2),
        "ma20": round(ma20, 2) if ma20 else None,
        "ma60": round(ma60, 2) if ma60 else None,
        "rsi6": round(rsi6, 1) if rsi6 is not None else None,
        "rsi12": round(rsi12, 1) if rsi12 is not None else None,
        "roe": round(roe, 2) if roe is not None else None,
        "volRatio": round(vol_ratio, 2),
        "high52w": round(hi52, 2),
        "low52w": round(lo52, 2),
        "offHighPct": round((last / hi52 - 1) * 100, 1),
        "spark": [round(c, 2) for c in closes[-60:]],
        "score": score,
        "verdict": verdict,
        "verdictLabel": verdict_label,
        "signals": signals,
    }


def main():
    prices = load_prices()
    tech = load_tech()
    info = load_info()
    roes = load_roe()
    stocks = [score_stock(t, prices[t], tech.get(t, {}), info, roes.get(t)) for t in STOCKS]
    stocks.sort(key=lambda s: s["score"], reverse=True)
    payload = {
        "date": "2026-10-15",
        "market": "A股",
        "stocks": stocks,
        "counts": {
            "buy": sum(1 for s in stocks if s["verdict"] == "buy"),
            "watch": sum(1 for s in stocks if s["verdict"] == "watch"),
            "avoid": sum(1 for s in stocks if s["verdict"] == "avoid"),
        },
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    for s in stocks:
        print(f"{s['name']:<8} {s['ticker']:<10} score={s['score']:>5}  {s['verdictLabel']}  "
              f"price={s['price']}  rsi12={s['rsi12']}  roe={s['roe']}  volR={s['volRatio']}")


if __name__ == "__main__":
    main()
