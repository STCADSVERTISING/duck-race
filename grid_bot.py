import ccxt
import json
import time
import requests
from datetime import datetime
import threading

class GridTradingBot:
    def __init__(self):
        self.load_config()

        self.exchange = ccxt.binance({
            'apiKey': self.config['binance']['api_key'],
            'secret': self.config['binance']['api_secret'],
            'enableRateLimit': True,
            'options': {
                'defaultType': 'future',
                'adjustForTimeDifference': True,
                'recvWindow': 10000
            }
        })

        self.exchange.set_sandbox_mode(False)

        # Sync time กับ Binance server
        try:
            self.exchange.load_time_difference()
            print(f"✅ Time synced with Binance server")
        except:
            print(f"⚠️ Could not sync time, using local time")

        self.active_positions = {}
        self.running = True
        self.cached_markets = None
        self.last_market_update = 0
        self.leverage = self.config['trading'].get('leverage', 8)
        self.trade_history = []
        self.learning_data = self.load_learning_data()

        # ระบบพักบอทเมื่อแพ้ติด
        self.consecutive_losses = 0
        self.pause_until = None

        # ระบบรายงานประจำวัน
        self.daily_stats = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'total_trades': 0,
            'wins': 0,
            'losses': 0,
            'total_profit_usdt': 0.0,
            'trades_detail': []
        }
        self.last_daily_report = None

    def load_config(self):
        with open('config.json', 'r', encoding='utf-8') as f:
            self.config = json.load(f)

    def load_learning_data(self):
        """โหลดข้อมูลการเรียนรู้"""
        try:
            with open('learning_data.json', 'r') as f:
                data = json.load(f)
                return data
        except:
            return {
                'total_trades': 0,
                'profitable_trades': 0,
                'avg_profit_pct': 0.8,
                'avg_win_time': 30,
                'volatility_success': {}
            }

    def save_learning_data(self):
        """บันทึกข้อมูลการเรียนรู้"""
        try:
            with open('learning_data.json', 'w') as f:
                json.dump(self.learning_data, f, indent=2)
        except Exception as e:
            print(f"⚠️ Failed to save learning data: {str(e)}")

    def send_telegram(self, message):
        try:
            token = self.config['telegram']['bot_token']
            chat_id = self.config['telegram']['chat_id']

            if token == "YOUR_TELEGRAM_BOT_TOKEN" or chat_id == "YOUR_TELEGRAM_CHAT_ID":
                print(f"[Telegram Disabled] {message}")
                return

            url = f"https://api.telegram.org/bot{token}/sendMessage"
            data = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML"
            }
            requests.post(url, data=data, timeout=10)
        except Exception as e:
            print(f"Telegram error: {str(e)}")

    def log(self, message):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_msg = f"[{timestamp}] {message}"
        print(log_msg)
        self.send_telegram(message)

    def get_balance(self):
        try:
            balance = self.exchange.fetch_balance()
            return balance['USDT']['free']
        except Exception as e:
            self.log(f"❌ Error fetching balance: {str(e)}")
            return 0

    def get_current_price(self, symbol):
        try:
            ticker = self.exchange.fetch_ticker(symbol)
            return ticker['last']
        except Exception as e:
            self.log(f"❌ Error fetching price for {symbol}: {str(e)}")
            return None

    def calculate_volatility(self, symbol):
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, '5m', limit=20)
            if len(ohlcv) < 2:
                return 0

            price_changes = []
            for i in range(1, len(ohlcv)):
                change = abs((ohlcv[i][4] - ohlcv[i-1][4]) / ohlcv[i-1][4]) * 100
                price_changes.append(change)

            avg_volatility = sum(price_changes) / len(price_changes)
            return avg_volatility
        except Exception as e:
            return 0

    def detect_trend(self, symbol):
        """ตรวจสอบเทรนด์ของตลาด - คืนค่า 'LONG' หรือ 'SHORT'"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, '5m', limit=20)

            if len(ohlcv) < 10:
                return 'LONG'

            closes = [candle[4] for candle in ohlcv]

            # คำนวณ Moving Average
            ma_short = sum(closes[-5:]) / 5
            ma_long = sum(closes[-10:]) / 10
            current_price = closes[-1]

            # ตรวจสอบเทรนด์
            if ma_short > ma_long and current_price > ma_short:
                return 'LONG'
            elif ma_short < ma_long and current_price < ma_short:
                return 'SHORT'
            else:
                # ดูจาก momentum
                momentum = (closes[-1] - closes[-5]) / closes[-5] * 100
                return 'LONG' if momentum > 0 else 'SHORT'

        except Exception as e:
            return 'LONG'

    def is_market_tradable(self, symbol):
        """ตรวจสอบว่าเหรียญเปิดให้เทรดได้หรือไม่"""
        try:
            market = self.exchange.market(symbol)

            if not market.get('active', False):
                return False, "Market inactive"

            if market.get('info', {}).get('status') != 'TRADING':
                return False, f"Status: {market.get('info', {}).get('status', 'UNKNOWN')}"

            orderbook = self.exchange.fetch_order_book(symbol, limit=5)
            if not orderbook.get('bids') or not orderbook.get('asks'):
                return False, "No liquidity (empty orderbook)"

            best_bid = orderbook['bids'][0][0] if orderbook['bids'] else 0
            best_ask = orderbook['asks'][0][0] if orderbook['asks'] else 0

            if best_bid == 0 or best_ask == 0:
                return False, "No valid bid/ask price"

            spread_pct = ((best_ask - best_bid) / best_bid) * 100
            if spread_pct > 1.0:
                return False, f"Spread too wide: {spread_pct:.2f}%"

            return True, "OK"
        except Exception as e:
            return False, str(e)

    def get_top_volume_coins(self, limit=50):
        """ดึงเหรียญที่มี volume สูงสุด (Futures) + เพิ่มเหรียญหลักด้วย"""
        try:
            current_time = time.time()
            if self.cached_markets and (current_time - self.last_market_update) < 300:
                return self.cached_markets

            print("📡 Fetching top volume Futures coins from Binance...")
            tickers = self.exchange.fetch_tickers()
            markets = self.exchange.load_markets()

            # เหรียญหลักที่ต้องมีเสมอ (priority สูง)
            major_coins = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'BNB/USDT:USDT']

            usdt_pairs = []
            for symbol, ticker in tickers.items():
                if '/USDT:USDT' in symbol and ticker.get('quoteVolume'):
                    try:
                        market = markets.get(symbol, {})

                        if not market.get('active', False):
                            continue

                        if market.get('info', {}).get('status') != 'TRADING':
                            continue

                        quote_volume = float(ticker['quoteVolume'])

                        # เหรียญหลักไม่ต้องเช็ค min_volume
                        is_major = symbol in major_coins

                        if is_major or quote_volume > self.config['trading']['min_volume_usdt']:
                            usdt_pairs.append({
                                'symbol': symbol,
                                'volume': quote_volume,
                                'price': ticker.get('last', 0),
                                'is_major': is_major
                            })
                    except:
                        continue

            # เรียงลำดับ: เหรียญหลักก่อน แล้วเรียงตาม volume
            usdt_pairs.sort(key=lambda x: (not x['is_major'], -x['volume']))
            top_coins = [coin['symbol'] for coin in usdt_pairs[:limit]]

            self.cached_markets = top_coins
            self.last_market_update = current_time

            major_count = sum(1 for c in top_coins if c in major_coins)
            print(f"✅ Found {len(top_coins)} coins ({major_count} major coins included)")
            return top_coins

        except Exception as e:
            print(f"❌ Error fetching top coins: {str(e)}")
            return ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'BNB/USDT:USDT']

    def get_coin_win_rate(self, symbol):
        """ดึง Win Rate ของเหรียญจากข้อมูลการเรียนรู้"""
        if 'coin_history' not in self.learning_data:
            self.learning_data['coin_history'] = {}

        coin_data = self.learning_data['coin_history'].get(symbol, {
            'total': 0,
            'wins': 0,
            'win_rate': 0
        })

        return coin_data

    def detect_market_mode(self, symbol, volatility):
        """ตรวจสอบว่าเหรียญนี้เหมาะกับโหมดไหน"""
        volatile_mode = self.config['trading'].get('volatile_mode', {})
        sideways_mode = self.config['trading'].get('sideways_mode', {})

        # ตรวจสอบ VOLATILE MODE (กราฟดีดแรง)
        if volatile_mode.get('enabled', False):
            if volatile_mode['min_volatility'] <= volatility <= volatile_mode['max_volatility']:
                return 'VOLATILE', volatile_mode

        # ตรวจสอบ SIDEWAYS MODE (กราฟนิ่ง)
        if sideways_mode.get('enabled', False):
            if sideways_mode['min_volatility'] <= volatility <= sideways_mode['max_volatility']:
                # เช็ค whitelist ถ้ามี
                whitelist = sideways_mode.get('whitelist_coins', [])
                if whitelist and symbol not in whitelist:
                    return None, None
                return 'SIDEWAYS', sideways_mode

        return None, None

    def scan_market_opportunities(self):
        """สแกนตลาดหาเหรียญที่มีความผันผวนสูง + กรองตาม Win Rate"""
        try:
            top_coins = self.get_top_volume_coins(self.config['trading']['scan_limit'])

            opportunities = []
            filtered_by_winrate = 0
            filtered_by_mode = 0

            print(f"\n🔍 Scanning Top {len(top_coins)} Volume coins...")
            print(f"  🔥 VOLATILE Mode: Vol {self.config['trading']['volatile_mode']['min_volatility']}-{self.config['trading']['volatile_mode']['max_volatility']}%")
            print(f"  📊 SIDEWAYS Mode: Vol {self.config['trading']['sideways_mode']['min_volatility']}-{self.config['trading']['sideways_mode']['max_volatility']}%")

            # เหรียญหลักที่ไม่ต้องเช็ค Win Rate
            major_coins = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'BNB/USDT:USDT']

            for symbol in top_coins:
                if symbol in self.active_positions:
                    continue

                try:
                    volatility = self.calculate_volatility(symbol)
                    is_major = symbol in major_coins

                    # ตรวจสอบโหมด
                    mode, mode_config = self.detect_market_mode(symbol, volatility)
                    if not mode:
                        filtered_by_mode += 1
                        continue

                    coin_stats = self.get_coin_win_rate(symbol)

                    # เหรียญหลักไม่ต้องเช็ค Win Rate
                    if not is_major:
                        # กรองตาม Win Rate ของโหมด
                        min_trades = mode_config.get('min_trades_for_filter', 3)
                        min_win_rate = mode_config.get('min_win_rate', 60)

                        if coin_stats['total'] >= min_trades:
                            if coin_stats['win_rate'] < min_win_rate:
                                filtered_by_winrate += 1
                                continue

                        # กรองเหรียญที่แพ้ติด 2 ครั้งขึ้นไป
                        if coin_stats['total'] >= 2 and coin_stats['wins'] == 0:
                            filtered_by_winrate += 1
                            continue

                    if True:
                        price = self.get_current_price(symbol)
                        trend = self.detect_trend(symbol)
                        if price:
                            opportunities.append({
                                'symbol': symbol,
                                'volatility': volatility,
                                'price': price,
                                'trend': trend,
                                'win_rate': coin_stats['win_rate'],
                                'trades': coin_stats['total'],
                                'mode': mode,
                                'mode_config': mode_config
                            })
                except:
                    continue

                time.sleep(0.1)

            # เรียงลำดับ: เหรียญหลักก่อน > VOLATILE > Win Rate สูง
            def score_opportunity(opp):
                win_rate = opp['win_rate'] if opp['trades'] > 0 else 30
                is_major = opp['symbol'] in major_coins
                major_priority = 500 if is_major else 0  # เหรียญหลักได้ priority สูงสุด
                mode_priority = 200 if opp['mode'] == 'VOLATILE' else 100
                return major_priority + mode_priority + (win_rate * 2) + opp['volatility']

            opportunities.sort(key=score_opportunity, reverse=True)

            if filtered_by_mode > 0:
                print(f"  ⚠️ Filtered {filtered_by_mode} coins (no matching mode)")
            if filtered_by_winrate > 0:
                print(f"  ⛔ Filtered {filtered_by_winrate} coins (low win rate)")

            if opportunities:
                print(f"\n🎯 Top 5 Opportunities:")
                for i, opp in enumerate(opportunities[:5], 1):
                    trend_emoji = "📈" if opp['trend'] == 'LONG' else "📉"
                    mode_emoji = "🔥" if opp['mode'] == 'VOLATILE' else "📊"
                    is_major = opp['symbol'] in major_coins
                    major_badge = "⭐" if is_major else ""
                    win_info = f" | WR: {opp['win_rate']:.0f}% ({opp['trades']})" if opp['trades'] > 0 else " | 🆕 New"
                    print(f"  {i}. {major_badge}{mode_emoji} {opp['mode']}: {opp['symbol']} {trend_emoji} {opp['trend']} | Vol={opp['volatility']:.2f}%{win_info}")
            else:
                print(f"⏸️ No coins meet criteria")

            return opportunities

        except Exception as e:
            print(f"❌ Error scanning market: {str(e)}")
            return []

    def calculate_grid_params(self, symbol, current_price, position_size, side='LONG'):
        volatility = self.calculate_volatility(symbol)

        base_profit_usdt = self.learning_data.get('avg_profit_pct', 1.0) / 100 * position_size

        # ดูประวัติเหรียญนี้
        coin_stats = self.get_coin_win_rate(symbol)
        has_history = coin_stats['total'] > 0

        if volatility > 3:
            target_profit_usdt = min(max(base_profit_usdt * 1.5, 3), 12)
        elif volatility > 2:
            target_profit_usdt = min(max(base_profit_usdt * 1.3, 2.5), 10)
        elif volatility > 1.5:
            target_profit_usdt = min(max(base_profit_usdt * 1.1, 2), 8)
        else:
            target_profit_usdt = min(max(base_profit_usdt, 2), 6)

        # ปรับตามประวัติเหรียญ
        if has_history:
            if coin_stats['win_rate'] >= 70:
                target_profit_usdt *= 1.2  # เหรียญดีให้เป้าสูงขึ้น
            elif coin_stats['win_rate'] <= 30:
                target_profit_usdt *= 0.7  # เหรียญแย่ให้เป้าต่ำ ออกเร็ว

        vol_key = f"vol_{int(volatility)}"
        if vol_key in self.learning_data.get('volatility_success', {}):
            success_rate = self.learning_data['volatility_success'][vol_key].get('success_rate', 0.5)
            if success_rate > 0.7:
                target_profit_usdt *= 1.05
            elif success_rate < 0.3:
                target_profit_usdt *= 0.8  # ลดเป้าหมาย volatility ที่แพ้บ่อย

        profit_pct = (target_profit_usdt / position_size) * 100

        entry_price = current_price

        # LONG: target สูงกว่า entry, SHORT: target ต่ำกว่า entry
        if side == 'LONG':
            target_price = entry_price * (1 + profit_pct / 100)
        else:  # SHORT
            target_price = entry_price * (1 - profit_pct / 100)

        max_loss_usdt = 2.0
        stop_loss_pct = (max_loss_usdt / position_size) * 100

        # LONG: SL ต่ำกว่า entry, SHORT: SL สูงกว่า entry
        if side == 'LONG':
            stop_loss = entry_price * (1 - stop_loss_pct / 100)
        else:  # SHORT
            stop_loss = entry_price * (1 + stop_loss_pct / 100)

        print(f"  📉 Target Profit: ${target_profit_usdt:.2f} ({profit_pct:.2f}%) | Max Loss: ${max_loss_usdt}")
        print(f"  🧠 Learning: {self.learning_data['total_trades']} trades | Win rate: {self.get_win_rate():.1f}%")

        return {
            'entry': entry_price,
            'target': target_price,
            'stop_loss': stop_loss,
            'volatility': volatility,
            'stop_loss_pct': stop_loss_pct,
            'profit_pct': profit_pct,
            'target_profit_usdt': target_profit_usdt
        }

    def get_win_rate(self):
        if self.learning_data['total_trades'] == 0:
            return 0
        return (self.learning_data['profitable_trades'] / self.learning_data['total_trades']) * 100

    def update_learning_data(self, symbol, volatility, profit_usdt, profit_pct, duration_minutes, reason):
        """อัพเดทข้อมูลการเรียนรู้หลังปิด position"""
        try:
            self.learning_data['total_trades'] += 1

            is_win = profit_usdt > 0

            if is_win:
                self.learning_data['profitable_trades'] += 1
                self.consecutive_losses = 0  # รีเซ็ตเมื่อชนะ
            else:
                self.consecutive_losses += 1  # นับแพ้ติด

            # บันทึกสถิติรายวัน
            self.daily_stats['total_trades'] += 1
            if is_win:
                self.daily_stats['wins'] += 1
            else:
                self.daily_stats['losses'] += 1
            self.daily_stats['total_profit_usdt'] += profit_usdt
            self.daily_stats['trades_detail'].append({
                'symbol': symbol,
                'profit_usdt': profit_usdt,
                'profit_pct': profit_pct,
                'reason': reason,
                'time': datetime.now().strftime('%H:%M:%S')
            })

            # ตรวจสอบว่าแพ้ 3 ครั้งติดหรือไม่
            if self.consecutive_losses >= 3:
                self.pause_until = datetime.now().timestamp() + (20 * 60)  # พัก 20 นาที
                pause_time = datetime.fromtimestamp(self.pause_until).strftime('%H:%M:%S')
                msg = f"⚠️ <b>BOT PAUSED</b> - แพ้ติด 3 ครั้ง\n⏸️ พักจนถึง: {pause_time} (20 นาที)"
                self.log(msg)

            if self.learning_data['total_trades'] > 0:
                current_avg = self.learning_data.get('avg_profit_pct', 0.8)
                self.learning_data['avg_profit_pct'] = (current_avg * 0.9) + (profit_pct * 0.1)

            vol_key = f"vol_{int(volatility)}"
            if vol_key not in self.learning_data['volatility_success']:
                self.learning_data['volatility_success'][vol_key] = {
                    'total': 0,
                    'wins': 0,
                    'success_rate': 0.5,
                    'avg_profit': 0
                }

            vol_data = self.learning_data['volatility_success'][vol_key]
            vol_data['total'] += 1
            if profit_usdt > 0:
                vol_data['wins'] += 1
            vol_data['success_rate'] = vol_data['wins'] / vol_data['total']
            vol_data['avg_profit'] = ((vol_data.get('avg_profit', 0) * (vol_data['total'] - 1)) + profit_pct) / vol_data['total']

            # Track per-coin statistics
            if 'coin_history' not in self.learning_data:
                self.learning_data['coin_history'] = {}

            if symbol not in self.learning_data['coin_history']:
                self.learning_data['coin_history'][symbol] = {
                    'total': 0,
                    'wins': 0,
                    'win_rate': 0
                }

            coin_data = self.learning_data['coin_history'][symbol]
            coin_data['total'] += 1
            if profit_usdt > 0:
                coin_data['wins'] += 1
            coin_data['win_rate'] = (coin_data['wins'] / coin_data['total']) * 100

            self.save_learning_data()

            print(f"  🧠 Updated: {self.learning_data['total_trades']} trades | Win: {self.get_win_rate():.1f}%")
            print(f"  📊 Volatility {int(volatility)}%: {vol_data['success_rate']*100:.1f}% success ({vol_data['wins']}/{vol_data['total']})")
            print(f"  🪙 {symbol}: {coin_data['win_rate']:.1f}% win rate ({coin_data['wins']}/{coin_data['total']})")

        except Exception as e:
            print(f"⚠️ Learning update error: {str(e)}")

    def set_position_mode(self):
        """ตั้ง position mode เป็น One-Way Mode"""
        try:
            # ใช้ API โดยตรง
            response = self.exchange.fapiPrivatePostPositionsideDual({'dualSidePosition': 'false'})
            print(f"  🔄 Position mode: One-Way")
            return True
        except Exception as e:
            error_msg = str(e)
            if 'No need to change' in error_msg or 'already set' in error_msg:
                return True
            # ถ้า error อื่น ก็ข้ามไป (บางบัญชีไม่ต้องตั้ง)
            return True

    def set_leverage(self, symbol, leverage=None):
        """ตั้ง leverage สำหรับ symbol"""
        try:
            lev = leverage if leverage else self.leverage
            self.exchange.set_leverage(lev, symbol)
            print(f"  ⚡ Leverage set to {lev}x for {symbol}")
            return True
        except Exception as e:
            print(f"  ⚠️ Error setting leverage: {str(e)}")
            return False

    def set_margin_mode(self, symbol):
        """ตั้ง margin mode เป็น isolated"""
        try:
            self.exchange.set_margin_mode('isolated', symbol)
            print(f"  🔒 Margin mode: ISOLATED")
            return True
        except Exception as e:
            error_msg = str(e)
            # ถ้า error เรื่อง Multi-Assets Mode ให้แจ้ง user
            if 'Multi-Assets' in error_msg:
                print(f"  ⚠️ Please disable Multi-Assets Mode in Binance Futures Settings")
                print(f"  📱 Go to: Binance App → Futures → Settings → Toggle OFF 'Multi-Assets Mode'")
                return False
            # error อื่นๆ ก็ผ่าน
            return True

    def place_buy_order(self, symbol, amount_usdt, leverage=None):
        try:
            self.set_position_mode()
            self.set_margin_mode(symbol)
            if leverage:
                self.set_leverage(symbol, leverage)
            else:
                self.set_leverage(symbol)

            current_price = self.get_current_price(symbol)
            if not current_price:
                self.log(f"❌ Cannot get price for {symbol}")
                return None

            market_info = self.exchange.market(symbol)
            min_amount = market_info['limits']['amount']['min']
            min_cost = market_info['limits']['cost'].get('min', 0)

            # ใช้ leverage ที่ส่งมา
            actual_lev = leverage if leverage else self.leverage
            position_value = amount_usdt * actual_lev
            amount = position_value / current_price

            if amount < min_amount:
                amount = min_amount * 1.1

            if amount * current_price < min_cost:
                amount = (min_cost / current_price) * 1.1

            amount_precision = market_info.get('precision', {}).get('amount', 8)
            if amount_precision is None:
                amount_precision = 8
            amount_precision = int(amount_precision)
            amount = round(amount, amount_precision)

            print(f"  📝 Opening LONG: {amount} {symbol.split('/')[0]} @ Market")
            print(f"  💰 Margin: ${amount_usdt} | Position: ${position_value} ({actual_lev}x)")

            order = self.exchange.create_market_buy_order(symbol, amount)

            time.sleep(2)

            try:
                order_status = self.exchange.fetch_order(order['id'], symbol)
                actual_amount = order_status.get('filled', amount)
                actual_price = order_status.get('average', current_price)

                if order_status['status'] == 'closed' or order_status['status'] == 'filled':
                    print(f"  ✅ LONG Position OPENED: {actual_amount} @ ${actual_price}")

                    return {
                        'order_id': order['id'],
                        'amount': actual_amount,
                        'entry_price': actual_price,
                        'side': 'LONG'
                    }
                else:
                    self.log(f"⚠️ Order status: {order_status['status']}")
                    return None

            except Exception as e:
                print(f"  ⚠️ Using order info: amount={amount}, price~${current_price}")
                return {
                    'order_id': order['id'],
                    'amount': amount,
                    'entry_price': current_price,
                    'side': 'LONG'
                }

        except Exception as e:
            self.log(f"❌ Error placing buy order for {symbol}: {str(e)}")
            return None

    def place_sell_order(self, symbol, amount_usdt, leverage=None):
        """เปิด SHORT position"""
        try:
            self.set_position_mode()
            self.set_margin_mode(symbol)
            if leverage:
                self.set_leverage(symbol, leverage)
            else:
                self.set_leverage(symbol)

            current_price = self.get_current_price(symbol)
            if not current_price:
                self.log(f"❌ Cannot get price for {symbol}")
                return None

            market_info = self.exchange.market(symbol)
            min_amount = market_info['limits']['amount']['min']
            min_cost = market_info['limits']['cost'].get('min', 0)

            # ใช้ leverage ที่ส่งมา
            actual_lev = leverage if leverage else self.leverage
            position_value = amount_usdt * actual_lev
            amount = position_value / current_price

            if amount < min_amount:
                amount = min_amount * 1.1

            if amount * current_price < min_cost:
                amount = (min_cost / current_price) * 1.1

            amount_precision = market_info.get('precision', {}).get('amount', 8)
            if amount_precision is None:
                amount_precision = 8
            amount_precision = int(amount_precision)
            amount = round(amount, amount_precision)

            print(f"  📝 Opening SHORT: {amount} {symbol.split('/')[0]} @ Market")
            print(f"  💰 Margin: ${amount_usdt} | Position: ${position_value} ({actual_lev}x)")

            order = self.exchange.create_market_sell_order(symbol, amount)

            time.sleep(2)

            try:
                order_status = self.exchange.fetch_order(order['id'], symbol)
                actual_amount = order_status.get('filled', amount)
                actual_price = order_status.get('average', current_price)

                if order_status['status'] == 'closed' or order_status['status'] == 'filled':
                    print(f"  ✅ SHORT Position OPENED: {actual_amount} @ ${actual_price}")

                    return {
                        'order_id': order['id'],
                        'amount': actual_amount,
                        'entry_price': actual_price,
                        'side': 'SHORT'
                    }
                else:
                    self.log(f"⚠️ Order status: {order_status['status']}")
                    return None

            except Exception as e:
                print(f"  ⚠️ Using order info: amount={amount}, price~${current_price}")
                return {
                    'order_id': order['id'],
                    'amount': amount,
                    'entry_price': current_price,
                    'side': 'SHORT'
                }

        except Exception as e:
            self.log(f"❌ Error placing sell order for {symbol}: {str(e)}")
            return None

    def place_tp_sl_orders(self, symbol, amount, take_profit_price, stop_loss_price, side='LONG'):
        """วาง TP/SL สำหรับ Futures (รองรับทั้ง LONG และ SHORT)"""
        try:
            market_info = self.exchange.market(symbol)

            # ใช้ tickSize สำหรับ price precision
            price_tick = market_info.get('limits', {}).get('price', {}).get('min', 0.00000001)
            amount_precision = market_info.get('precision', {}).get('amount', 8)

            if amount_precision is None:
                amount_precision = 8
            amount_precision = int(amount_precision)

            # คำนวณ decimal places จาก tickSize
            price_precision = len(str(price_tick).rstrip('0').split('.')[-1]) if '.' in str(price_tick) else 0

            # ปัดให้เป็นทวีคูณของ tickSize
            def round_to_tick(price, tick):
                return round(price / tick) * tick

            amount = round(amount, amount_precision)
            take_profit_price = round_to_tick(take_profit_price, price_tick)
            stop_loss_price = round_to_tick(stop_loss_price, price_tick)

            # ตรวจสอบว่าราคาไม่ต่ำกว่า minimum
            min_price = market_info.get('limits', {}).get('price', {}).get('min', price_tick)
            if take_profit_price < min_price:
                take_profit_price = min_price
            if stop_loss_price < min_price:
                stop_loss_price = min_price

            print(f"  🎯 Setting TP/SL: TP=${take_profit_price:.{price_precision}f}, SL=${stop_loss_price:.{price_precision}f}")

            # สำหรับ LONG ใช้ sell, สำหรับ SHORT ใช้ buy
            close_side = 'sell' if side == 'LONG' else 'buy'

            tp_params = {
                'stopPrice': take_profit_price,
                'closePosition': 'true'
            }

            tp_order = self.exchange.create_order(
                symbol=symbol,
                type='TAKE_PROFIT_MARKET',
                side=close_side,
                amount=amount,
                params=tp_params
            )

            sl_params = {
                'stopPrice': stop_loss_price,
                'closePosition': 'true'
            }

            sl_order = self.exchange.create_order(
                symbol=symbol,
                type='STOP_MARKET',
                side=close_side,
                amount=amount,
                params=sl_params
            )

            print(f"  ✅ TP Order: {tp_order['id']}")
            print(f"  ✅ SL Order: {sl_order['id']}")

            return {
                'tp_order_id': tp_order['id'],
                'sl_order_id': sl_order['id']
            }

        except Exception as e:
            self.log(f"❌ Error placing TP/SL orders for {symbol}: {str(e)}")
            return None

    def check_position_closed(self, symbol):
        """เช็คว่า position ปิดแล้วหรือยัง"""
        try:
            positions = self.exchange.fetch_positions([symbol])

            for pos in positions:
                if pos['symbol'] == symbol:
                    contracts = float(pos.get('contracts', 0))
                    if contracts == 0:
                        return {'closed': True, 'info': pos}
                    else:
                        return {'closed': False, 'contracts': contracts}

            return {'closed': True, 'info': None}

        except Exception as e:
            print(f"⚠️ Error checking position: {str(e)}")
            return {'closed': False}

    def check_and_open_position(self, symbol, trend='LONG', mode='VOLATILE', mode_config=None):
        if symbol in self.active_positions:
            return False

        try:
            tradable, reason = self.is_market_tradable(symbol)
            if not tradable:
                print(f"⚠️ {symbol} not tradable: {reason}")
                return False

            current_price = self.get_current_price(symbol)
            if not current_price:
                print(f"⚠️ {symbol}: Cannot fetch price")
                return False

            # ปรับ leverage ตามโหมด
            base_leverage = self.config['trading']['leverage']
            leverage_multiplier = 1.0
            if mode_config:
                leverage_multiplier = mode_config.get('leverage_multiplier', 1.0)
            actual_leverage = int(base_leverage * leverage_multiplier)
            actual_leverage = max(1, min(actual_leverage, 10))  # จำกัด 1-10x

            mode_emoji = "🔥" if mode == 'VOLATILE' else "📊"
            print(f"  {mode_emoji} Mode: {mode} | Leverage: {actual_leverage}x")

            capital = self.config['trading']['capital_per_coin']
            position_value = capital * actual_leverage

            grid_params = self.calculate_grid_params(symbol, current_price, position_value, trend)

            self.log(f"{mode_emoji} {mode} | {symbol} | Price: ${current_price:.4f} | Vol: {grid_params['volatility']:.2f}% | {trend}")

            # เลือกว่าจะเปิด LONG หรือ SHORT ตาม trend
            if trend == 'LONG':
                order_result = self.place_buy_order(symbol, capital, actual_leverage)
            else:  # SHORT
                order_result = self.place_sell_order(symbol, capital, actual_leverage)

            buy_result = order_result  # Keep variable name for compatibility

            if buy_result:
                # คำนวณ profit/loss ตาม side
                if trend == 'LONG':
                    profit_pct = ((grid_params['target'] - buy_result['entry_price']) / buy_result['entry_price']) * 100
                    potential_profit = (grid_params['target'] - buy_result['entry_price']) * buy_result['amount']
                    potential_loss = (buy_result['entry_price'] - grid_params['stop_loss']) * buy_result['amount']
                else:  # SHORT
                    profit_pct = ((buy_result['entry_price'] - grid_params['target']) / buy_result['entry_price']) * 100
                    potential_profit = (buy_result['entry_price'] - grid_params['target']) * buy_result['amount']
                    potential_loss = (grid_params['stop_loss'] - buy_result['entry_price']) * buy_result['amount']

                tpsl_result = self.place_tp_sl_orders(
                    symbol,
                    buy_result['amount'],
                    grid_params['target'],
                    grid_params['stop_loss'],
                    trend
                )

                if tpsl_result:
                    self.active_positions[symbol] = {
                        'entry_price': buy_result['entry_price'],
                        'amount': buy_result['amount'],
                        'target_price': grid_params['target'],
                        'stop_loss': grid_params['stop_loss'],
                        'entry_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'tpsl_info': tpsl_result,
                        'side': trend,
                        'volatility': grid_params['volatility']
                    }

                    trend_emoji = "📈" if trend == 'LONG' else "📉"
                    msg = f"✅ <b>{trend_emoji} {trend} {symbol}</b> [{self.leverage}x]\n"
                    msg += f"💰 Entry: ${buy_result['entry_price']:.4f}\n"
                    msg += f"🎯 TP: ${grid_params['target']:.4f} (+{profit_pct:.2f}% | ~${potential_profit:.2f})\n"
                    msg += f"🛑 SL: ${grid_params['stop_loss']:.4f} (-{grid_params['stop_loss_pct']:.2f}% | Max -$2.00)\n"
                    msg += f"📦 Contracts: {buy_result['amount']:.6f}\n"
                    msg += f"💵 Margin: ${capital} | Position: ${position_value:.2f}\n"
                    msg += f"🤖 TP/SL Orders Active"

                    self.log(msg)
                    return True
                else:
                    self.log(f"⚠️ {symbol}: TP/SL failed, will use manual monitoring")
                    self.active_positions[symbol] = {
                        'entry_price': buy_result['entry_price'],
                        'amount': buy_result['amount'],
                        'target_price': grid_params['target'],
                        'stop_loss': grid_params['stop_loss'],
                        'entry_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'tpsl_info': None,
                        'side': trend,
                        'volatility': grid_params['volatility']
                    }
                    return True
            else:
                print(f"⚠️ {symbol}: Failed to place buy order")
                return False
        except Exception as e:
            self.log(f"❌ Error opening position for {symbol}: {str(e)}")
            return False

    def get_actual_balance(self, symbol):
        """ดึงยอดเหรียญจริงที่มีในกระเป๋า"""
        try:
            coin = symbol.split('/')[0]
            balance = self.exchange.fetch_balance()
            free_balance = balance.get(coin, {}).get('free', 0)
            return free_balance
        except Exception as e:
            print(f"⚠️ Error fetching balance for {coin}: {str(e)}")
            return 0

    def should_exit_early(self, symbol, position, current_price):
        """ตรวจสอบว่าควรปิดออเดอร์ก่อนถึง TP/SL หรือไม่"""
        try:
            if not self.config['trading']['dynamic_exit']['enabled']:
                return False, None

            side = position.get('side', 'LONG')
            entry_price = position['entry_price']
            target_price = position['target_price']

            # คำนวณกำไรปัจจุบัน
            if side == 'LONG':
                current_profit_usdt = (current_price - entry_price) * position['amount']
                current_profit_pct = ((current_price - entry_price) / entry_price) * 100
                target_profit_pct = ((target_price - entry_price) / entry_price) * 100
            else:  # SHORT
                current_profit_usdt = (entry_price - current_price) * position['amount']
                current_profit_pct = ((entry_price - current_price) / entry_price) * 100
                target_profit_pct = ((entry_price - target_price) / entry_price) * 100

            # 1. ตรวจสอบ Trailing Stop
            min_profit = self.config['trading']['dynamic_exit']['min_profit_to_trail']
            if current_profit_usdt >= min_profit:
                if 'highest_profit' not in position:
                    position['highest_profit'] = current_profit_usdt

                if current_profit_usdt > position['highest_profit']:
                    position['highest_profit'] = current_profit_usdt

                # ถ้ากำไรลดลงจากจุดสูงสุดเกิน trailing_stop_pct
                trailing_pct = self.config['trading']['dynamic_exit']['trailing_stop_pct']
                profit_drop = ((position['highest_profit'] - current_profit_usdt) / position['highest_profit']) * 100

                if profit_drop >= trailing_pct:
                    return True, f"TRAILING_STOP (Profit dropped {profit_drop:.1f}% from peak)"

            # 2. ปิดก่อนถึง TP (Take Profit Early)
            early_exit_pct = self.config['trading']['dynamic_exit']['take_profit_early_pct']
            if current_profit_pct >= (target_profit_pct * early_exit_pct / 100):
                # ตรวจสอบว่าเทรนด์กำลังกลับตัวหรือไม่
                current_trend = self.detect_trend(symbol)
                if current_trend != side:
                    return True, f"EARLY_EXIT (Hit {current_profit_pct:.1f}% & trend reversing)"

            # 3. ปิดเมื่อเจอสัญญาณกลับตัว
            if self.config['trading']['dynamic_exit']['reverse_signal_exit']:
                if current_profit_usdt > 0.5:  # มีกำไรอย่างน้อย $0.5
                    current_trend = self.detect_trend(symbol)
                    if current_trend != side:
                        return True, f"REVERSE_SIGNAL ({side} -> {current_trend})"

            # 4. ตัดขาดทุนเร็ว (Cut Loss Early)
            cut_loss_pct = self.config['trading']['dynamic_exit'].get('cut_loss_early_pct', 0)
            if cut_loss_pct > 0 and current_profit_usdt < 0:
                # ถ้าขาดทุนถึง 50% ของ SL + เทรนด์กลับตัว
                stop_loss_usdt = 2.0
                loss_pct = abs(current_profit_usdt) / stop_loss_usdt * 100

                if loss_pct >= cut_loss_pct:
                    current_trend = self.detect_trend(symbol)
                    if current_trend != side:
                        return True, f"CUT_LOSS_EARLY (Loss ${abs(current_profit_usdt):.2f} & trend reversed)"

            return False, None

        except Exception as e:
            print(f"⚠️ Dynamic exit check error: {str(e)}")
            return False, None

    def close_position_manually(self, symbol, reason="MANUAL"):
        """ปิด position ด้วยตนเอง (ไม่รอ TP/SL)"""
        try:
            position = self.active_positions[symbol]
            side = position.get('side', 'LONG')
            amount = position['amount']

            # ยกเลิก TP/SL orders ที่มีอยู่
            if position.get('tpsl_info'):
                try:
                    self.exchange.cancel_order(position['tpsl_info']['tp_order_id'], symbol)
                    self.exchange.cancel_order(position['tpsl_info']['sl_order_id'], symbol)
                except:
                    pass

            # ปิด position ด้วย Market Order
            if side == 'LONG':
                order = self.exchange.create_market_sell_order(symbol, amount)
            else:  # SHORT
                order = self.exchange.create_market_buy_order(symbol, amount)

            time.sleep(1)

            # ดึงราคาที่ปิด
            try:
                order_status = self.exchange.fetch_order(order['id'], symbol)
                exit_price = order_status.get('average', order_status.get('price'))
            except:
                exit_price = self.get_current_price(symbol)

            # คำนวณกำไร/ขาดทุน
            if side == 'LONG':
                profit_usdt = (exit_price - position['entry_price']) * amount
                profit_pct = ((exit_price - position['entry_price']) / position['entry_price']) * 100
            else:  # SHORT
                profit_usdt = (position['entry_price'] - exit_price) * amount
                profit_pct = ((position['entry_price'] - exit_price) / position['entry_price']) * 100

            # บันทึกการเรียนรู้
            entry_time = datetime.strptime(position['entry_time'], '%Y-%m-%d %H:%M:%S')
            duration_minutes = (datetime.now() - entry_time).total_seconds() / 60

            self.update_learning_data(
                symbol=symbol,
                volatility=position.get('volatility', 1.0),
                profit_usdt=profit_usdt,
                profit_pct=profit_pct,
                duration_minutes=duration_minutes,
                reason=reason
            )

            # ส่งแจ้งเตือน
            emoji = "🎉" if profit_usdt > 0 else "⚠️"
            side_emoji = "📈" if side == 'LONG' else "📉"
            msg = f"{emoji} <b>CLOSE {side_emoji} {side} {symbol}</b> [{reason}] [{self.leverage}x]\n"
            msg += f"💰 Entry: ${position['entry_price']:.4f}\n"
            msg += f"💵 Exit: ${exit_price:.4f}\n"
            msg += f"📈 P&L: ${profit_usdt:.2f} ({profit_pct:+.2f}%)\n"
            msg += f"⏱ Duration: {self.calculate_duration(position['entry_time'])}\n"
            msg += f"🧠 Win Rate: {self.get_win_rate():.1f}%"

            self.log(msg)

            del self.active_positions[symbol]
            return True

        except Exception as e:
            self.log(f"❌ Error closing position manually: {str(e)}")
            return False

    def check_and_close_position(self, symbol):
        if symbol not in self.active_positions:
            return

        try:
            position = self.active_positions[symbol]

            # ตรวจสอบว่าควรปิดก่อนถึง TP/SL หรือไม่
            current_price = self.get_current_price(symbol)
            if current_price:
                should_exit, exit_reason = self.should_exit_early(symbol, position, current_price)
                if should_exit:
                    print(f"🚀 Dynamic Exit triggered for {symbol}: {exit_reason}")
                    self.close_position_manually(symbol, exit_reason)
                    return

            pos_status = self.check_position_closed(symbol)

            if pos_status['closed']:
                try:
                    trades = self.exchange.fetch_my_trades(symbol, limit=10)

                    exit_price = position['entry_price']
                    reason = "UNKNOWN"
                    side = position.get('side', 'LONG')

                    # หา exit trade ตาม side
                    close_side = 'sell' if side == 'LONG' else 'buy'
                    for trade in reversed(trades):
                        if trade['side'] == close_side:
                            exit_price = trade['price']
                            break

                    # ตรวจสอบว่าถึง TP หรือ SL
                    if side == 'LONG':
                        if exit_price >= position['target_price']:
                            reason = "TARGET"
                        elif exit_price <= position['stop_loss']:
                            reason = "STOP_LOSS"
                    else:  # SHORT
                        if exit_price <= position['target_price']:
                            reason = "TARGET"
                        elif exit_price >= position['stop_loss']:
                            reason = "STOP_LOSS"

                    # คำนวณ profit ตาม side
                    if side == 'LONG':
                        profit_usdt = (exit_price - position['entry_price']) * position['amount']
                        profit_pct = ((exit_price - position['entry_price']) / position['entry_price']) * 100
                    else:  # SHORT
                        profit_usdt = (position['entry_price'] - exit_price) * position['amount']
                        profit_pct = ((position['entry_price'] - exit_price) / position['entry_price']) * 100

                    actual_profit_with_leverage = profit_usdt

                    entry_time = datetime.strptime(position['entry_time'], '%Y-%m-%d %H:%M:%S')
                    duration_minutes = (datetime.now() - entry_time).total_seconds() / 60

                    self.update_learning_data(
                        symbol=symbol,
                        volatility=position.get('volatility', 1.0),
                        profit_usdt=profit_usdt,
                        profit_pct=profit_pct,
                        duration_minutes=duration_minutes,
                        reason=reason
                    )

                    if profit_usdt > 0:
                        emoji = "🎉"
                    else:
                        emoji = "⚠️"

                    side_emoji = "📈" if side == 'LONG' else "📉"
                    msg = f"{emoji} <b>CLOSE {side_emoji} {side} {symbol}</b> [{reason}] [{self.leverage}x]\n"
                    msg += f"💰 Entry: ${position['entry_price']:.4f}\n"
                    msg += f"💵 Exit: ${exit_price:.4f}\n"
                    msg += f"📈 P&L: ${actual_profit_with_leverage:.2f} ({profit_pct:+.2f}%)\n"
                    msg += f"⏱ Duration: {self.calculate_duration(position['entry_time'])}\n"
                    msg += f"🧠 Win Rate: {self.get_win_rate():.1f}%"

                    self.log(msg)

                except Exception as e:
                    self.log(f"✅ {symbol} position closed (couldn't fetch details)")

                del self.active_positions[symbol]

        except Exception as e:
            self.log(f"❌ Error checking position for {symbol}: {str(e)}")

    def calculate_duration(self, entry_time_str):
        try:
            entry_time = datetime.strptime(entry_time_str, '%Y-%m-%d %H:%M:%S')
            duration = datetime.now() - entry_time
            minutes = duration.total_seconds() / 60

            if minutes < 60:
                return f"{int(minutes)}m"
            else:
                hours = minutes / 60
                return f"{hours:.1f}h"
        except:
            return "N/A"

    def send_daily_report(self):
        """ส่งรายงานประจำวันเวลาเที่ยงคืน 00:01"""
        try:
            stats = self.daily_stats
            win_rate = (stats['wins'] / stats['total_trades'] * 100) if stats['total_trades'] > 0 else 0

            # สร้างรายงาน
            msg = "📊 <b>รายงานประจำวัน</b>\n"
            msg += f"📅 วันที่: {stats['date']}\n"
            msg += f"━━━━━━━━━━━━━━━━━━━━\n"
            msg += f"📈 เทรดทั้งหมด: {stats['total_trades']} ไม้\n"
            msg += f"✅ ชนะ: {stats['wins']} ไม้\n"
            msg += f"❌ แพ้: {stats['losses']} ไม้\n"
            msg += f"🎯 Win Rate: {win_rate:.1f}%\n"
            msg += f"━━━━━━━━━━━━━━━━━━━━\n"

            if stats['total_profit_usdt'] >= 0:
                msg += f"💰 กำไรรวม: +${stats['total_profit_usdt']:.2f}\n"
            else:
                msg += f"📉 ขาดทุนรวม: ${stats['total_profit_usdt']:.2f}\n"

            # แสดงรายละเอียด 5 ไม้ล่าสุด
            if stats['trades_detail']:
                msg += f"\n🔍 รายการล่าสุด:\n"
                for i, trade in enumerate(stats['trades_detail'][-5:], 1):
                    emoji = "✅" if trade['profit_usdt'] > 0 else "❌"
                    msg += f"{emoji} {trade['symbol'].split('/')[0]}: ${trade['profit_usdt']:.2f} ({trade['profit_pct']:+.1f}%) [{trade['time']}]\n"

            msg += f"\n🧠 Win Rate ทั้งหมด: {self.get_win_rate():.1f}% ({self.learning_data['total_trades']} trades)"

            self.log(msg)

            # รีเซ็ตสถิติวันใหม่
            self.daily_stats = {
                'date': datetime.now().strftime('%Y-%m-%d'),
                'total_trades': 0,
                'wins': 0,
                'losses': 0,
                'total_profit_usdt': 0.0,
                'trades_detail': []
            }

        except Exception as e:
            print(f"⚠️ Error sending daily report: {str(e)}")

    def check_and_send_daily_report(self):
        """ตรวจสอบและส่งรายงานประจำวันเวลา 00:01"""
        try:
            now = datetime.now()
            current_date = now.strftime('%Y-%m-%d')

            # ตรวจสอบว่าเป็นวันใหม่และยังไม่ได้ส่งรายงาน
            if now.hour == 0 and now.minute <= 1:
                if self.last_daily_report != current_date:
                    # ส่งรายงานของวันที่แล้ว
                    if self.daily_stats['total_trades'] > 0:
                        self.send_daily_report()
                    self.last_daily_report = current_date

            # อัพเดท date ใน daily_stats ถ้าเป็นวันใหม่
            if self.daily_stats['date'] != current_date and now.hour == 0 and now.minute > 1:
                self.daily_stats['date'] = current_date

        except Exception as e:
            print(f"⚠️ Error checking daily report: {str(e)}")

    def monitor_positions(self):
        while self.running:
            try:
                # ตรวจสอบและส่งรายงานประจำวัน
                self.check_and_send_daily_report()

                for symbol in list(self.active_positions.keys()):
                    self.check_and_close_position(symbol)

                time.sleep(5)
            except Exception as e:
                self.log(f"❌ Monitor error: {str(e)}")
                time.sleep(5)

    def scan_and_trade(self):
        while self.running:
            try:
                # ตรวจสอบว่าบอทถูกพักหรือไม่
                if self.pause_until:
                    current_time = datetime.now().timestamp()
                    if current_time < self.pause_until:
                        remaining = int((self.pause_until - current_time) / 60)
                        print(f"\n⏸️ BOT PAUSED - แพ้ติด 3 ครั้ง | เหลือ {remaining} นาที")
                        time.sleep(60)  # เช็คทุก 1 นาที
                        continue
                    else:
                        # หมดเวลาพัก
                        self.pause_until = None
                        self.consecutive_losses = 0  # รีเซ็ต
                        self.log("✅ <b>BOT RESUMED</b> - เริ่มเทรดต่อ")

                balance = self.get_balance()
                active_count = len(self.active_positions)
                max_positions = self.config['trading']['max_positions']

                print(f"\n{'='*60}")
                print(f"=== Scan Cycle [{datetime.now().strftime('%H:%M:%S')}] ===")
                print(f"{'='*60}")
                print(f"💰 Balance: ${balance:.2f} USDT")
                print(f"📊 Active Positions: {active_count}/{max_positions}")
                if active_count > 0:
                    print(f"📈 Trading: {', '.join(self.active_positions.keys())}")
                print(f"💵 Capital per trade: ${self.config['trading']['capital_per_coin']} USDT")
                if self.consecutive_losses > 0:
                    print(f"⚠️ แพ้ติด: {self.consecutive_losses}/3")

                if active_count < max_positions and balance >= self.config['trading']['capital_per_coin']:
                    opportunities = self.scan_market_opportunities()

                    if opportunities:
                        success = False
                        for i, opportunity in enumerate(opportunities[:10]):
                            best_coin = opportunity['symbol']
                            trend = opportunity['trend']
                            mode = opportunity['mode']
                            mode_config = opportunity['mode_config']

                            trend_emoji = "📈" if trend == 'LONG' else "📉"
                            mode_emoji = "🔥" if mode == 'VOLATILE' else "📊"
                            print(f"\n🎯 Attempting #{i+1}: {mode_emoji} {mode} | {best_coin} {trend_emoji} {trend} (Vol: {opportunity['volatility']:.2f}%)")

                            success = self.check_and_open_position(best_coin, trend, mode, mode_config)

                            if success:
                                break
                            else:
                                print(f"⏩ Skipping {best_coin}, trying next coin...")
                                time.sleep(1)

                        if not success:
                            print(f"\n❌ Failed to open position in top 10 opportunities")
                    else:
                        print(f"\n⏸️ No suitable opportunities found. Waiting...")
                else:
                    if balance < self.config['trading']['capital_per_coin']:
                        print(f"\n⚠️ Insufficient balance: ${balance:.2f} < ${self.config['trading']['capital_per_coin']}")
                    if active_count >= max_positions:
                        print(f"\n⚠️ Max positions reached: {active_count}/{max_positions}")

                print(f"\n⏰ Next scan in {self.config['trading']['check_interval_seconds']}s...")
                time.sleep(self.config['trading']['check_interval_seconds'])
            except Exception as e:
                self.log(f"❌ Scan error: {str(e)}")
                time.sleep(30)

    def test_api_connection(self):
        print("\n🔍 Testing API Connection...")
        print(f"📡 Testing Binance Futures API...")

        try:
            print(f"  → API Base URL: {self.exchange.urls['api']['public']}")
            print(f"  → Default Type: {self.exchange.options.get('defaultType')}")

            print(f"\n  → Step 1: Loading markets...")
            markets = self.exchange.load_markets()
            futures_markets = [s for s in markets.keys() if ':USDT' in s]
            print(f"  ✅ Found {len(futures_markets)} Futures markets")

            print(f"\n  → Step 2: Testing public data (no auth)...")
            ticker = self.exchange.fetch_ticker('BTC/USDT:USDT')
            print(f"  ✅ Public API: OK (BTC: ${ticker['last']:.2f})")

            print(f"\n  → Step 3: Testing authenticated endpoints...")
            balance = self.exchange.fetch_balance({'type': 'future'})

            print(f"\n✅ API Connection Successful!")
            print(f"💰 USDT Balance (Futures): ${balance['USDT']['free']:.2f}")
            print(f"📊 Total Balance: ${balance['USDT']['total']:.2f}")

            print(f"\n📋 Trading Settings:")
            print(f"  • Mode: FUTURES GRID (USDT-M)")
            print(f"  • API Endpoint: {self.exchange.urls['api']['public']}")
            print(f"  • Leverage: {self.leverage}x")
            print(f"  • Margin Type: ISOLATED")
            print(f"  • Dynamic coin selection: ENABLED")
            print(f"  • Max positions: {self.config['trading']['max_positions']}")

            return True

        except ccxt.AuthenticationError as e:
            print(f"\n❌ Authentication Failed!")
            print(f"Error: {str(e)}")
            print("\n⚠️ This means:")
            print("  • API Key or Secret is incorrect")
            print("  • API doesn't have 'Enable Futures' permission")
            print("  • IP restriction is blocking your connection")
            print("\n🔧 Fix:")
            print("  1. Go to Binance → API Management")
            print("  2. Delete old API key")
            print("  3. Create NEW API with 'Enable Futures' ✓")
            print("  4. Set IP restriction to 'Unrestricted' (or add your IP)")
            print("  5. Copy new keys to config.json")
            return False

        except Exception as e:
            print(f"\n❌ Connection Failed!")
            print(f"Error: {str(e)}")
            print(f"\n💡 API Endpoint: https://fapi.binance.com")
            return False

    def run(self):
        self.log("🤖 <b>Grid Trading Bot Started</b>")

        if not self.test_api_connection():
            self.log("❌ Cannot start bot due to API connection issues")
            return

        balance = self.get_balance()
        self.log(f"💰 Available Balance: ${balance:.2f} USDT")

        if balance < self.config['trading']['capital_per_coin']:
            self.log(f"⚠️ Warning: Balance (${balance:.2f}) is less than required capital per coin (${self.config['trading']['capital_per_coin']})")

        monitor_thread = threading.Thread(target=self.monitor_positions, daemon=True)
        monitor_thread.start()

        try:
            self.scan_and_trade()
        except KeyboardInterrupt:
            self.log("🛑 <b>Bot Stopped by User</b>")
            self.running = False

if __name__ == "__main__":
    bot = GridTradingBot()
    bot.run()
