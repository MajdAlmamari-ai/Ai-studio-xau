"""
Automated Institutional HTML Report Generator using QuantStats.
Exports comprehensive tear sheets with tearsheets, drawdown charts, and monthly returns heatmap.
"""

from pathlib import Path
from typing import Optional
import pandas as pd

try:
    import quantstats as qs
except ImportError:
    qs = None


def generate_html_report(
    returns: pd.Series,
    output_path: str = "report.html",
    benchmark: Optional[str] = None,
    title: str = "XAUUSD Institutional SMC Quant Strategy"
) -> str:
    """
    Generates an institutional HTML tear sheet via QuantStats.
    """
    if returns is None or len(returns) < 10:
        raise ValueError("Need at least 10 return records to generate HTML report")

    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)

    if qs is not None:
        qs.extend_pandas()
        qs.reports.html(
            returns,
            benchmark=benchmark,
            output=str(out_file),
            title=title,
            download_filename=out_file.name
        )
    else:
        # Fallback self-contained HTML report if quantstats offline
        cum_ret = (1 + returns).cumprod()
        total_ret = (cum_ret.iloc[-1] - 1.0) * 100.0
        html_content = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>{title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f17; color: #f1f5f9; padding: 24px; direction: rtl; }}
    .card {{ background: #131b26; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; max-width: 800px; margin: 0 auto; }}
    h1 {{ color: #fbbf24; font-size: 24px; margin-bottom: 8px; }}
    .stat {{ display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #1e293b; }}
    .val {{ font-weight: bold; color: #10b981; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>{title}</h1>
    <p style="color: #94a3b8;">تقرير الأداء والتحليل المؤسساتي الدوري</p>
    <div class="stat"><span>إجمالي العائد التراكمي:</span><span class="val">{total_ret:.2f}%</span></div>
    <div class="stat"><span>إجمالي عدد الصفقات:</span><span class="val">{len(returns)}</span></div>
    <div class="stat"><span>نسبة الصفقات الرابحة:</span><span class="val">{(len(returns[returns > 0]) / len(returns) * 100):.1f}%</span></div>
  </div>
</body>
</html>"""
        out_file.write_text(html_content, encoding="utf-8")

    return str(out_file)
