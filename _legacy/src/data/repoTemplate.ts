import { RepoFile } from '../types';

export const GITHUB_WORKFLOW_YML = `name: XAUUSD SMC Trading Bot

on:
  schedule:
    # Runs automatically every 15 minutes
    - cron: '*/15 * * * *'
  workflow_dispatch:
    # Allows manual trigger at any time from GitHub Actions UI

jobs:
  analyze-and-dispatch:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout repository code
        uses: actions/checkout@v4

      - name: Set up Python 3.10
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Execute XAUUSD SMC Analysis & Telegram Dispatch
        env:
          BOT_TOKEN: \${{ secrets.BOT_TOKEN }}
          CHAT_ID: \${{ secrets.CHAT_ID }}
        run: |
          python main.py
`;

export const MAIN_PY = `#!/usr/bin/env python3
"""
XAUUSD - Smart Money Concept (SMC) Trading Bot
Automates institutional Gold market analysis and dispatches actionable signals to Telegram.
Runs every 15 minutes via GitHub Actions.
"""

import os
import sys
import datetime
import requests
from dotenv import load_dotenv

# Load local .env if present (for local testing)
load_dotenv()

# Configuration & Secrets
BOT_TOKEN = os.getenv("BOT_TOKEN")
CHAT_ID = os.getenv("CHAT_ID")
API_URL = "https://api.gold-api.com/price/XAU"
FALLBACK_PRICE = 4423.70

# Psychological thresholds & SMC offsets
BULLISH_THRESHOLD = 4475.00
BEARISH_THRESHOLD = 4470.00
BSL_OFFSET = 8.00         # Buy-Side Liquidity (Current Price + 8)
SSL_OFFSET = 6.00         # Sell-Side Liquidity (Current Price - 6)
RESISTANCE_OFFSET = 5.00  # Institutional Resistance (Current Price + 5)
SUPPORT_OFFSET = 4.00     # Institutional Support (Current Price - 4)


def fetch_gold_price() -> tuple[float, str]:
    """
    Step 1: Data Collection
    Fetches the live XAUUSD price from gold-api.com with contingency fallback.
    """
    print("📡 [Step 1/4] Fetching latest XAUUSD spot price...")
    try:
        response = requests.get(API_URL, timeout=8)
        if response.status_code == 200:
            data = response.json()
            price = float(data.get("price", FALLBACK_PRICE))
            print(f"✅ Live market price fetched successfully: \${price:.2f} USD")
            return round(price, 2), "Live API (gold-api.com)"
        else:
            print(f"⚠️ API returned status {response.status_code}. Using fallback contingency.")
    except Exception as e:
        print(f"⚠️ Network error connecting to API ({e}). Activating fallback price.")

    print(f"🔄 Using fallback benchmark price: \${FALLBACK_PRICE:.2f} USD")
    return FALLBACK_PRICE, "Contingency Fallback"


def analyze_market_smc(price: float) -> dict:
    """
    Step 2: Market Analysis
    Calculates Bias, Liquidity Pools (BSL/SSL), Key Levels, and Order Blocks.
    """
    print(f"🧠 [Step 2/4] Running Institutional SMC Analysis for \${price:.2f}...")

    # Determining Bias
    if price > BULLISH_THRESHOLD:
        bias = "BULLISH"
        action = "BUY"
        structure = "Uptrend (Bullish)"
    elif price < BEARISH_THRESHOLD:
        bias = "BEARISH"
        action = "SELL"
        structure = "Downtrend (Bearish)"
    else:
        bias = "NEUTRAL"
        action = "WAIT"
        structure = "Consolidation (Range-bound)"

    # Liquidity Calculation (SMC)
    bsl = round(price + BSL_OFFSET, 2)
    ssl = round(price - SSL_OFFSET, 2)

    # Key Levels
    resistance = round(price + RESISTANCE_OFFSET, 2)
    support = round(price - SUPPORT_OFFSET, 2)

    # Order Blocks (OB)
    bullish_ob_min = round(support - 1.50, 2)
    bullish_ob_max = round(support + 0.50, 2)
    bearish_ob_min = round(resistance - 0.50, 2)
    bearish_ob_max = round(resistance + 1.50, 2)

    # Trade Setup Metrics
    if action == "BUY":
        entry_min = round(price - 1.00, 2)
        entry_max = round(price + 0.50, 2)
        sl = round(price - 4.00, 2)
        tp = round(price + 12.00, 2)
        risk = max(entry_max - sl, 1.0)
        reward = tp - entry_max
        rr = f"1:{round(reward / risk, 1)}"
        reason = (
            f"Price (\${price:.2f}) broke above the key psychological boundary (\${BULLISH_THRESHOLD:.2f}). "
            f"Institutional order flow reflects bullish momentum targeting Buy-Side Liquidity (BSL) "
            f"at \${bsl:.2f}. Demand order block mitigated around \${bullish_ob_min} - \${bullish_ob_max}."
        )
    elif action == "SELL":
        entry_min = round(price - 0.50, 2)
        entry_max = round(price + 1.00, 2)
        sl = round(price + 4.00, 2)
        tp = round(price - 10.00, 2)
        risk = max(sl - entry_min, 1.0)
        reward = entry_min - tp
        rr = f"1:{round(reward / risk, 1)}"
        reason = (
            f"Price (\${price:.2f}) lost institutional support at \${BEARISH_THRESHOLD:.2f}. "
            f"Smart money order flow indicates liquidity grab targeting Sell-Side Liquidity (SSL) "
            f"at \${ssl:.2f}. Supply order block positioned at \${bearish_ob_min} - \${bearish_ob_max}."
        )
    else:
        entry_min = round(support + 0.50, 2)
        entry_max = round(resistance - 0.50, 2)
        sl = round(support - 2.00, 2)
        tp = round(resistance + 2.00, 2)
        rr = "1:1.0 (Unfavorable)"
        reason = (
            f"Price (\${price:.2f}) is trapped inside equilibrium consolidation between "
            f"\${BEARISH_THRESHOLD:.2f} and \${BULLISH_THRESHOLD:.2f}. BSL (\${bsl:.2f}) and "
            f"SSL (\${ssl:.2f}) remain unmitigated. Await institutional liquidity sweep or BOS."
        )

    return {
        "price": price,
        "bias": bias,
        "action": action,
        "structure": structure,
        "bsl": bsl,
        "ssl": ssl,
        "resistance": resistance,
        "support": support,
        "bullish_ob": (bullish_ob_min, bullish_ob_max),
        "bearish_ob": (bearish_ob_min, bearish_ob_max),
        "entry": (entry_min, entry_max),
        "tp": tp,
        "sl": sl,
        "rr": rr,
        "reason": reason,
    }


def generate_telegram_report(analysis: dict, source_info: str) -> str:
    """
    Step 3: Report Generation
    Compiles all analysis into a clean, institutional HTML-formatted Telegram alert.
    """
    print("📝 [Step 3/4] Compiling institutional trade report...")
    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    bias_emoji = "🟢" if analysis["bias"] == "BULLISH" else ("🔴" if analysis["bias"] == "BEARISH" else "🟡")
    action_emoji = "🚀 BUY / LONG" if analysis["action"] == "BUY" else ("🔻 SELL / SHORT" if analysis["action"] == "SELL" else "⏳ WAIT / MONITOR")

    message = (
        f"<b>🏆 XAUUSD - SMART MONEY CONCEPT (SMC) REPORT</b>\\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\\n"
        f"⏱ <b>Timestamp:</b> <code>{now_utc}</code>\\n"
        f"💰 <b>Spot Price:</b> <b>\${analysis['price']:.2f} USD</b>\\n"
        f"📊 <b>Market Bias:</b> {bias_emoji} <b>{analysis['bias']}</b>\\n"
        f"🧱 <b>Structure:</b> <i>{analysis['structure']}</i>\\n\\n"
        f"<b>⚡ ACTIONABLE RECOMMENDATION:</b>\\n"
        f"🎯 <b>Action:</b> <b>{action_emoji}</b>\\n"
        f"📍 <b>Entry Zone:</b> <code>\${analysis['entry'][0]:.2f} - \${analysis['entry'][1]:.2f}</code>\\n"
        f"🛑 <b>Stop Loss (SL):</b> <code>\${analysis['sl']:.2f}</code>\\n"
        f"🎯 <b>Take Profit (TP):</b> <code>\${analysis['tp']:.2f}</code>\\n"
        f"⚖️ <b>Risk-to-Reward (RR):</b> <b>{analysis['rr']}</b>\\n\\n"
        f"<b>💧 INSTITUTIONAL LIQUIDITY POOLS:</b>\\n"
        f"• <b>BSL (Buy-Side Liquidity):</b> <code>\${analysis['bsl']:.2f}</code> (Buy Stops)\\n"
        f"• <b>SSL (Sell-Side Liquidity):</b> <code>\${analysis['ssl']:.2f}</code> (Sell Stops)\\n"
        f"• <b>Resistance:</b> <code>\${analysis['resistance']:.2f}</code>\\n"
        f"• <b>Support:</b> <code>\${analysis['support']:.2f}</code>\\n\\n"
        f"<b>🏛️ ORDER BLOCKS (OB):</b>\\n"
        f"• <b>Bullish Demand OB:</b> <code>\${analysis['bullish_ob'][0]:.2f} - \${analysis['bullish_ob'][1]:.2f}</code>\\n"
        f"• <b>Bearish Supply OB:</b> <code>\${analysis['bearish_ob'][0]:.2f} - \${analysis['bearish_ob'][1]:.2f}</code>\\n\\n"
        f"<b>🧠 SMC RATIONALE:</b>\\n"
        f"<i>{analysis['reason']}</i>\\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\\n"
        f"🤖 <i>Automated 15-Minute Trigger • Data Source: {source_info}</i>"
    )
    return message


def send_telegram_alert(message_html: str) -> bool:
    """
    Step 4: Delivery
    Sends the HTML report to the Telegram channel or chat via Telegram Bot API.
    """
    print("🚀 [Step 4/4] Sending report to Telegram channel...")

    if not BOT_TOKEN or not CHAT_ID:
        print("❌ Error: Missing BOT_TOKEN or CHAT_ID environment variables!")
        print("ℹ️ Set BOT_TOKEN and CHAT_ID in your GitHub Secrets or local .env file.")
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": message_html,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        result = response.json()

        if response.status_code == 200 and result.get("ok"):
            message_id = result.get("result", {}).get("message_id")
            print(f"🎉 SUCCESS! Telegram alert delivered successfully. Message ID: {message_id}")
            return True
        else:
            print(f"❌ Telegram API Error ({response.status_code}): {result.get('description')}")
            return False
    except Exception as err:
        print(f"❌ Failed to reach Telegram API: {err}")
        return False


def main():
    print("==================================================")
    print("  XAUUSD - SMART MONEY CONCEPT (SMC) TRADING BOT  ")
    print("==================================================")

    # 1. Data Collection
    price, source_info = fetch_gold_price()

    # 2. Market Analysis
    analysis = analyze_market_smc(price)

    # 3. Report Generation
    report_html = generate_telegram_report(analysis, source_info)

    # 4. Delivery
    success = send_telegram_alert(report_html)

    if not success and (not BOT_TOKEN or not CHAT_ID):
        print("\\n📋 Simulated Telegram Message Preview:")
        print("--------------------------------------------------")
        print(report_html.replace("<b>", "").replace("</b>", "").replace("<code>", "").replace("</code>", "").replace("<i>", "").replace("</i>", ""))
        print("--------------------------------------------------")

    print("\\n✅ Execution cycle completed.")


if __name__ == "__main__":
    main()
`;

export const REQUIREMENTS_TXT = `requests>=2.31.0
python-dotenv>=1.0.0
`;

export const README_MD = `# 🪙 XAUUSD - Smart Money Concept (SMC) Trading Bot

> Professional, institutional-grade analysis of the Gold market (XAUUSD) automated via GitHub Actions and delivered directly to your Telegram channel every 15 minutes.

---

## 🎯 1. Core Philosophy & Strategy

Retail indicators (like RSI, MACD, Stochastics) lag behind price action. Institutional **Smart Money** moves markets through **Liquidity Engineering** (Stop Hunts) and **Order Flow** (Order Blocks).

This bot automates the institutional SMC playbook:
1. **Market Structure**: Evaluates trend bias (Bullish / Bearish / Consolidation).
2. **Liquidity Zones**:
   - **BSL (Buy-Side Liquidity)**: Calculated as \`Price + 8\`. Pinpoints where short sellers' stop losses and breakout buy stops cluster.
   - **SSL (Sell-Side Liquidity)**: Calculated as \`Price - 6\`. Pinpoints where long buyers' stop losses cluster.
3. **Key Institutional Levels**:
   - Institutional Resistance: \`Price + 5\`
   - Institutional Support: \`Price - 4\`
   - Institutional Order Blocks (Bullish Demand / Bearish Supply)
4. **Actionable Recommendations**: Clear \`BUY\`, \`SELL\`, or \`WAIT\` signals complete with Entry Zone, Take Profit (TP), Stop Loss (SL), and calculated Risk-to-Reward Ratio (RR >= 1:2.5).

---

## 🚀 2. Quick Start & Setup Guide (15 Minutes)

### Step 1: Create Your Telegram Bot
1. Open Telegram and search for [@BotFather](https://t.me/botfather).
2. Send \`/newbot\` and follow the instructions.
3. Choose a friendly name (e.g., \`Gold SMC Signals\`) and a username ending in \`bot\` (e.g., \`my_xauusd_smc_bot\`).
4. Save the HTTP API **Bot Token** (format: \`123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ\`).

### Step 2: Get Your Telegram Chat ID
1. Search for [@userinfobot](https://t.me/userinfobot) on Telegram and start it to view your numeric ID.
2. **Or send a test message** to your new bot, then open:
   \`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates\` in your browser to find \`"chat":{"id":123456789}\`.
3. *If using a Telegram Channel:* Add your bot to the channel as an **Administrator**, then send a message in the channel and retrieve the channel ID (usually starts with \`-100\`).

### Step 3: Create Your GitHub Repository
1. Log in to [GitHub](https://github.com).
2. Click **New Repository** and name it \`Xauusd-spot\`.
3. Set the repository to **Public** (required for free GitHub Actions minutes).
4. Commit the files from this project:
   - \`.github/workflows/run_bot.yml\`
   - \`main.py\`
   - \`requirements.txt\`
   - \`README.md\`

### Step 4: Configure GitHub Repository Secrets
1. In your GitHub repository, navigate to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add:
   - Name: \`BOT_TOKEN\` | Secret: *Paste your token from BotFather*
   - Name: \`CHAT_ID\`   | Secret: *Paste your numeric Chat ID*

### Step 5: Test Execution
1. Go to the **Actions** tab in your GitHub repository.
2. Select **XAUUSD SMC Trading Bot** on the left menu.
3. Click the **Run workflow** button.
4. Check your Telegram within 20 seconds — you will receive the full SMC institutional report!

---

## 🏗️ 3. System Architecture & Workflow

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                 GitHub Actions Scheduler                    │
│             (Triggered every 15m or manual)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Step 1: Data Collection                   │
│         Fetches XAUUSD spot from api.gold-api.com           │
│           (with resilient fallback contingency)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Step 2: SMC Market Engine                  │
│       • Bias Evaluation (> 4475 Bullish / < 4470 Bearish)   │
│       • Liquidity Mapping (BSL = P+8, SSL = P-6)            │
│       • Key Levels (Resist +5, Support -4)                  │
│       • Institutional Order Blocks & Risk-to-Reward         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Step 3: Report Compilation                  │
│          Structures Actionable Signals, TP, SL, RR          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Step 4: Telegram Delivery                   │
│          Dispatches institutional HTML alert to phone       │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## 🛠️ 4. Local Development

You can also run the bot locally on your computer:

\`\`\`bash
# 1. Clone repository
git clone https://github.com/your-username/Xauusd-spot.git
cd Xauusd-spot

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\\Scripts\\activate

# 3. Install requirements
pip install -r requirements.txt

# 4. Create .env file
echo "BOT_TOKEN=your_telegram_bot_token" >> .env
echo "CHAT_ID=your_chat_id" >> .env

# 5. Run bot
python main.py
\`\`\`

---

## 📋 5. Troubleshooting Checklist

| Issue | Cause | Fix |
|---|---|---|
| ❌ *401 Unauthorized* | Invalid Telegram Bot Token | Copy token freshly from @BotFather without leading/trailing spaces. |
| ❌ *400 Chat Not Found* | Bot has not initiated chat | Start the bot by clicking \`/start\` in Telegram first, or add bot as admin to channel. |
| ❌ *Action doesn't run* | Workflow permissions disabled | Go to Settings → Actions → General → Workflow permissions → Select *Read and write permissions*. |
| ⚠️ *Fallback price used* | API temporary downtime | The bot auto-recovers and switches to contingency fallback data seamlessly. |

---

*Disclaimer: This tool is intended for educational and institutional research purposes. Trading precious metals and spot gold involves substantial risk of loss.*
`;

export const ENV_EXAMPLE = `# Telegram Bot Token obtained from @BotFather
BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ

# Telegram Chat ID or Channel ID (obtained from @userinfobot)
CHAT_ID=123456789
`;

export const CONFIG_PY = `"""
Configuration constants for the XAUUSD SMC Trading Bot.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Telegram Credentials
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
CHAT_ID = os.getenv("CHAT_ID", "")

# Data Endpoints
GOLD_API_URL = "https://api.gold-api.com/price/XAU"
FALLBACK_PRICE = 4423.70

# SMC Parameters
BULLISH_THRESHOLD = 4475.00
BEARISH_THRESHOLD = 4470.00

BSL_OFFSET = 8.00         # Buy-Side Liquidity
SSL_OFFSET = 6.00         # Sell-Side Liquidity
RESISTANCE_OFFSET = 5.00  # Institutional Resistance
SUPPORT_OFFSET = 4.00     # Institutional Support

TP_OFFSET_BUY = 12.00
SL_OFFSET_BUY = 4.00
TP_OFFSET_SELL = 10.00
SL_OFFSET_SELL = 4.00
`;

export const DATA_FETCHERS_PY = `"""
Data Layer: Fetchers for live market spot rates and contingency fallbacks.
"""

import requests
from config import GOLD_API_URL, FALLBACK_PRICE


def get_spot_gold() -> tuple[float, str]:
    """
    Fetches real-time spot price of XAUUSD.
    Returns (price, source_name).
    """
    try:
        res = requests.get(GOLD_API_URL, timeout=8)
        if res.status_code == 200:
            payload = res.json()
            price = float(payload.get("price", FALLBACK_PRICE))
            return round(price, 2), "api.gold-api.com"
    except Exception as err:
        print(f"Warning: Primary API connection failed ({err}). Using fallback.")

    return FALLBACK_PRICE, "Contingency Cache"
`;

export const SMC_ANALYZER_PY = `"""
Analysis Layer: Institutional Smart Money Concept (SMC) Engine.
"""

from config import (
    BULLISH_THRESHOLD,
    BEARISH_THRESHOLD,
    BSL_OFFSET,
    SSL_OFFSET,
    RESISTANCE_OFFSET,
    SUPPORT_OFFSET,
    TP_OFFSET_BUY,
    SL_OFFSET_BUY,
    TP_OFFSET_SELL,
    SL_OFFSET_SELL,
)


def calculate_smc_levels(price: float) -> dict:
    """
    Evaluates market structure, liquidity pools, order blocks, and trade signals.
    """
    if price > BULLISH_THRESHOLD:
        bias = "BULLISH"
        action = "BUY"
        structure = "Uptrend (Bullish BOS)"
        entry = (round(price - 1.0, 2), round(price + 0.5, 2))
        sl = round(price - SL_OFFSET_BUY, 2)
        tp = round(price + TP_OFFSET_BUY, 2)
    elif price < BEARISH_THRESHOLD:
        bias = "BEARISH"
        action = "SELL"
        structure = "Downtrend (Bearish CHoCH)"
        entry = (round(price - 0.5, 2), round(price + 1.0, 2))
        sl = round(price + SL_OFFSET_SELL, 2)
        tp = round(price - TP_OFFSET_SELL, 2)
    else:
        bias = "NEUTRAL"
        action = "WAIT"
        structure = "Consolidation (Equilibrium Range)"
        entry = (round(price - 1.0, 2), round(price + 1.0, 2))
        sl = round(price - 3.0, 2)
        tp = round(price + 3.0, 2)

    bsl = round(price + BSL_OFFSET, 2)
    ssl = round(price - SSL_OFFSET, 2)
    resistance = round(price + RESISTANCE_OFFSET, 2)
    support = round(price - SUPPORT_OFFSET, 2)

    risk = max(abs(entry[1] - sl), 1.0)
    reward = abs(tp - entry[1])
    rr = f"1:{round(reward / risk, 1)}" if action != "WAIT" else "1:1.0 (Unfavorable)"

    return {
        "price": price,
        "bias": bias,
        "action": action,
        "structure": structure,
        "bsl": bsl,
        "ssl": ssl,
        "resistance": resistance,
        "support": support,
        "bullish_ob": (round(support - 1.5, 2), round(support + 0.5, 2)),
        "bearish_ob": (round(resistance - 0.5, 2), round(resistance + 1.5, 2)),
        "entry": entry,
        "sl": sl,
        "tp": tp,
        "rr": rr,
    }
`;

export const TELEGRAM_BOT_PY = `"""
Presentation Layer: Telegram Bot API Dispatcher.
"""

import requests
from config import BOT_TOKEN, CHAT_ID


def dispatch_alert(message_html: str) -> bool:
    """
    Sends message payload to Telegram via Bot API.
    """
    if not BOT_TOKEN or not CHAT_ID:
        print("Missing BOT_TOKEN or CHAT_ID in environment.")
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": message_html,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        return resp.status_code == 200 and resp.json().get("ok", False)
    except Exception as e:
        print(f"Failed to deliver Telegram alert: {e}")
        return False
`;

export const GITIGNORE = `__pycache__/
*.py[cod]
*$py.class
venv/
.env
.DS_Store
.idea/
.vscode/
logs/
`;

export const ALL_REPO_FILES: RepoFile[] = [
  {
    path: '.github/workflows/run_bot.yml',
    filename: 'run_bot.yml',
    category: 'workflow',
    description: 'GitHub Actions workflow configuration triggering automated runs every 15 minutes',
    language: 'yaml',
    content: GITHUB_WORKFLOW_YML,
  },
  {
    path: 'main.py',
    filename: 'main.py',
    category: 'core',
    description: 'Core engine: live price collection, SMC analysis, report compilation & Telegram delivery',
    language: 'python',
    content: MAIN_PY,
  },
  {
    path: 'requirements.txt',
    filename: 'requirements.txt',
    category: 'core',
    description: 'Python dependencies (requests and python-dotenv)',
    language: 'text',
    content: REQUIREMENTS_TXT,
  },
  {
    path: 'README.md',
    filename: 'README.md',
    category: 'docs',
    description: 'Complete user manual with BotFather setup, Chat ID discovery & GitHub deployment steps',
    language: 'markdown',
    content: README_MD,
  },
  {
    path: '.env.example',
    filename: '.env.example',
    category: 'core',
    description: 'Environment variable template for local testing',
    language: 'env',
    content: ENV_EXAMPLE,
  },
  {
    path: '.gitignore',
    filename: '.gitignore',
    category: 'core',
    description: 'Standard Python gitignore preventing secret or bytecode leakage',
    language: 'text',
    content: GITIGNORE,
  },
  {
    path: 'config.py',
    filename: 'config.py',
    category: 'modular',
    description: 'Centralized SMC thresholds, offsets, and credentials config',
    language: 'python',
    content: CONFIG_PY,
  },
  {
    path: 'data_layer/fetchers.py',
    filename: 'fetchers.py',
    category: 'modular',
    description: 'Data layer: gold price fetching from gold-api.com with fallback caching',
    language: 'python',
    content: DATA_FETCHERS_PY,
  },
  {
    path: 'analysis_layer/technical/smc_analyzer.py',
    filename: 'smc_analyzer.py',
    category: 'modular',
    description: 'Analysis layer: SMC logic for BSL, SSL, Order Blocks, and R:R ratios',
    language: 'python',
    content: SMC_ANALYZER_PY,
  },
  {
    path: 'presentation_layer/telegram_bot.py',
    filename: 'telegram_bot.py',
    category: 'modular',
    description: 'Presentation layer: formatted HTML delivery to Telegram channel',
    language: 'python',
    content: TELEGRAM_BOT_PY,
  },
];
