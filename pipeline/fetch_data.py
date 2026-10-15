# -*- coding: utf-8 -*-
"""Fetch ifind data for the stock-picker app and save raw CSVs."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\Administrator\Documents\Kimi\Workspaces\热量\stock-picker")
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)
TOOL = r"C:\Users\Administrator\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\kimi-code\home\plugins\managed\ifind\scripts\ifind_tool.py"

STOCKS = [
    "600519.SH",  # 贵州茅台
    "300750.SZ",  # 宁德时代
    "002594.SZ",  # 比亚迪
    "600036.SH",  # 招商银行
    "601318.SH",  # 中国平安
    "000333.SZ",  # 美的集团
    "600900.SH",  # 长江电力
    "000858.SZ",  # 五粮液
    "600276.SH",  # 恒瑞医药
    "601398.SH",  # 工商银行
]

END_DATE = "2026-10-15"
START_DATE = "2025-10-15"  # 1 year


def call(api, params):
    pf = RAW / "_params.json"
    pf.write_text(json.dumps(params, ensure_ascii=False), encoding="utf-8")
    p = subprocess.run(
        [sys.executable, TOOL, "call", "--api-name", api, "--params-file", str(pf)],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd=str(ROOT), timeout=180,
    )
    out = (p.stdout or "") + (p.stderr or "")
    ok = '"is_success": true' in out or "'is_success': True" in out or "is_success': 'true'" in out
    if not ok:
        print(f"[FAIL] {api} {params.get('ticker','')}: {out[:400]}")
    else:
        print(f"[OK]   {api} {params.get('ticker','')}")
    return ok


def batches(items, n):
    for i in range(0, len(items), n):
        yield items[i:i + n]


def main():
    # 1) daily price history, 1 year, batches of 3
    for grp in batches(STOCKS, 3):
        key = "_".join(t.split(".")[0] for t in grp)
        call("ifind_get_price", {
            "ticker": ",".join(grp),
            "start_date": START_DATE,
            "end_date": END_DATE,
            "interval": "D",
            "file_path": str(RAW / f"price_{key}.csv"),
        })

    # 2) realtime technical indicators (A-shares), batches of 3
    for grp in batches(STOCKS, 3):
        key = "_".join(t.split(".")[0] for t in grp)
        call("ifind_get_stock_realtime_price", {
            "ticker": ",".join(grp),
            "type": "realtime_tech",
            "time": f"{END_DATE} 15:00:00",
            "file_path": str(RAW / f"tech_{key}.csv"),
        })

    # 3) company profile, batches of 3
    for grp in batches(STOCKS, 3):
        key = "_".join(t.split(".")[0] for t in grp)
        call("ifind_get_stock_info", {
            "ticker": ",".join(grp),
            "file_path": str(RAW / f"info_{key}.csv"),
        })

    # 4) profitability indicators (ROE etc.), batches of 3
    for grp in batches(STOCKS, 3):
        key = "_".join(t.split(".")[0] for t in grp)
        call("ifind_get_stock_financial_index", {
            "ticker": ",".join(grp),
            "financial_parameter": "20250630",
            "category": "profitability",
            "file_path": str(RAW / f"profit_{key}.csv"),
        })

    print("done")


if __name__ == "__main__":
    main()
