from django.core.management.base import BaseCommand
from api.models import Transaction, Currency
from decimal import Decimal
from django.utils import timezone
from datetime import datetime, timedelta
import json

class Command(BaseCommand):
    help = 'Calculates profits across days with inventory carryover'

    def handle(self, *args, **options):
        # Get currencies
        thb = Currency.objects.get(code='THB')
        mmk = Currency.objects.get(code='MMK')

        # Delete all existing transactions
        Transaction.objects.all().delete()

        # First day transactions (Group 1)
        day1_transactions = [
            {
                'transaction_type': 'SELL',
                'customer_name': 'Shanlay',
                'source_amount': Decimal('15560'),  # THB
                'target_amount': Decimal('2000000'),  # MMK
                'rate': Decimal('128.53'),  # 2000000/15560
                'source_currency': thb,
                'target_currency': mmk,
                'date': timezone.now().date() - timedelta(days=1),
                'time': timezone.now().time()
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'Aung Myint Myat',
                'source_amount': Decimal('312'),  # THB
                'target_amount': Decimal('40000'),  # MMK
                'rate': Decimal('128.21'),  # 40000/312
                'source_currency': thb,
                'target_currency': mmk,
                'date': timezone.now().date() - timedelta(days=1),
                'time': timezone.now().time()
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'PTK',
                'source_amount': Decimal('1000000'),  # MMK
                'target_amount': Decimal('7620'),  # THB
                'rate': Decimal('131.23'),  # 1000000/7620
                'source_currency': mmk,
                'target_currency': thb,
                'date': timezone.now().date() - timedelta(days=1),
                'time': timezone.now().time()
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'Yadanar Min Aung',
                'source_amount': Decimal('500000'),  # MMK
                'target_amount': Decimal('3805'),  # THB
                'rate': Decimal('131.41'),  # 500000/3805
                'source_currency': mmk,
                'target_currency': thb,
                'date': timezone.now().date() - timedelta(days=1),
                'time': timezone.now().time()
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'Aye Nyein',
                'source_amount': Decimal('15500'),  # THB
                'target_amount': Decimal('2000000'),  # MMK
                'rate': Decimal('129.03'),  # 2000000/15500
                'source_currency': thb,
                'target_currency': mmk,
                'date': timezone.now().date() - timedelta(days=1),
                'time': timezone.now().time()
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'Thein Htike Soe',
                'source_amount': Decimal('2628200'),  # MMK
                'target_amount': Decimal('20000'),  # THB
                'rate': Decimal('131.41'),  # 2628200/20000
                'source_currency': mmk,
                'target_currency': thb,
                'date': timezone.now().date() - timedelta(days=1),
                'time': timezone.now().time()
            }
        ]

        # Second day transactions (Group 2)
        day2_transactions = [
            {
                'transaction_type': 'SELL',
                'customer_name': 'THS',
                'source_amount': Decimal('1600'),  # THB
                'target_amount': Decimal('207250'),  # MMK
                'rate': Decimal('129.53'),  # 207250/1600
                'source_currency': thb,
                'target_currency': mmk,
                'date': timezone.now().date(),
                'time': timezone.now().time()
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'LKK',
                'source_amount': Decimal('13124'),  # THB
                'target_amount': Decimal('1700000'),  # MMK
                'rate': Decimal('129.53'),  # 1700000/13124
                'source_currency': thb,
                'target_currency': mmk,
                'date': timezone.now().date(),
                'time': timezone.now().time()
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'MCS',
                'source_amount': Decimal('4000000'),  # MMK
                'target_amount': Decimal('30280'),  # THB
                'rate': Decimal('132.10'),  # 4000000/30280
                'source_currency': mmk,
                'target_currency': thb,
                'date': timezone.now().date(),
                'time': timezone.now().time()
            }
        ]

        # Add all transactions
        for tx in day1_transactions + day2_transactions:
            Transaction.objects.create(**tx)

        # Calculate profits with cross-day matching
        total_profit = Decimal('0')
        remaining_thb = Decimal('0')
        customer_profits = {}
        transaction_matches = []
        rate_spreads = []
        daily_profits = {}

        print("\nAll Transactions:")
        print("=" * 50)
        for tx in Transaction.objects.all().order_by('date', 'time'):
            if tx.transaction_type == 'SELL':
                print(f"\nCustomer SELL (We BUY): {tx.customer_name}")
                print(f"THB: {tx.source_amount} → MMK: {tx.target_amount}")
                print(f"Rate: {tx.rate} MMK/THB")
                print(f"Date: {tx.date} Time: {tx.time}")
            else:
                print(f"\nCustomer BUY (We SELL): {tx.customer_name}")
                print(f"MMK: {tx.source_amount} → THB: {tx.target_amount}")
                print(f"Rate: {tx.rate} MMK/THB")
                print(f"Date: {tx.date} Time: {tx.time}")

        print("\n\nTransaction Matches and Profit Calculation:")
        print("=" * 50)

        # Get all transactions ordered by date and time
        all_transactions = Transaction.objects.all().order_by('date', 'time')
        sell_transactions = []
        buy_transactions = []

        # Separate transactions by type
        for tx in all_transactions:
            if tx.transaction_type == 'SELL':
                sell_transactions.append(tx)
            else:
                buy_transactions.append(tx)

        match_count = 1
        for buy_tx in buy_transactions:
            remaining_buy_amount = buy_tx.target_amount

            # Try to match with oldest sell transactions first
            for sell_tx in sell_transactions:
                if sell_tx.source_amount <= 0:
                    continue

                matched_amount = min(remaining_buy_amount, sell_tx.source_amount)
                if matched_amount <= 0:
                    continue

                # Calculate MMK amounts
                mmk_paid = matched_amount * sell_tx.rate
                mmk_received = matched_amount * buy_tx.rate
                rate_spread = buy_tx.rate - sell_tx.rate
                profit = (mmk_received - mmk_paid) / buy_tx.rate

                # Store match details
                match_details = {
                    'match_number': match_count,
                    'sell_customer': sell_tx.customer_name,
                    'buy_customer': buy_tx.customer_name,
                    'matched_amount': float(matched_amount),
                    'mmk_paid': float(mmk_paid),
                    'mmk_received': float(mmk_received),
                    'rate_spread': float(rate_spread),
                    'profit': float(profit),
                    'date': sell_tx.date.isoformat(),
                    'time': sell_tx.time.isoformat()
                }
                transaction_matches.append(match_details)
                rate_spreads.append(float(rate_spread))

                # Track daily profits
                date_key = sell_tx.date.isoformat()
                if date_key not in daily_profits:
                    daily_profits[date_key] = Decimal('0')
                daily_profits[date_key] += profit

                print(f"\nMatch #{match_count}:")
                print(f"We BUY from: {sell_tx.customer_name}")
                print(f"  THB: {sell_tx.source_amount} → MMK: {sell_tx.target_amount}")
                print(f"  Rate: {sell_tx.rate} MMK/THB")
                print(f"We SELL to: {buy_tx.customer_name}")
                print(f"  THB: {buy_tx.target_amount} ← MMK: {buy_tx.source_amount}")
                print(f"  Rate: {buy_tx.rate} MMK/THB")
                print(f"Matched Amount: {matched_amount} THB")
                print(f"MMK Paid: {mmk_paid:.2f} MMK")
                print(f"MMK Received: {mmk_received:.2f} MMK")
                print(f"Rate Spread: {rate_spread:.2f} MMK/THB")
                print(f"Profit: {profit:.2f} THB")
                print(f"Date: {sell_tx.date} Time: {sell_tx.time}")
                print("-" * 30)

                total_profit += profit
                remaining_buy_amount -= matched_amount
                sell_tx.source_amount -= matched_amount
                sell_tx.save()

                # Track profit by customer
                if buy_tx.customer_name not in customer_profits:
                    customer_profits[buy_tx.customer_name] = Decimal('0')
                customer_profits[buy_tx.customer_name] += profit

                match_count += 1

                if remaining_buy_amount <= 0:
                    break

            remaining_thb += remaining_buy_amount

        # Calculate statistics
        avg_rate_spread = sum(rate_spreads) / len(rate_spreads) if rate_spreads else 0
        min_rate_spread = min(rate_spreads) if rate_spreads else 0
        max_rate_spread = max(rate_spreads) if rate_spreads else 0

        print("\nEnhanced Summary:")
        print("=" * 50)
        print(f"\nTotal Profit: {total_profit:.2f} THB")
        print(f"Remaining THB Inventory: {remaining_thb:.2f} THB")

        print(f"\nRate Spread Statistics:")
        print(f"Average Rate Spread: {avg_rate_spread:.2f} MMK/THB")
        print(f"Minimum Rate Spread: {min_rate_spread:.2f} MMK/THB")
        print(f"Maximum Rate Spread: {max_rate_spread:.2f} MMK/THB")

        print("\nProfit Contribution by Customer Transaction:")
        for customer, profit in customer_profits.items():
            print(f"{customer}: {profit:.2f} THB")

        print("\nDaily Profit Breakdown:")
        for date, profit in daily_profits.items():
            print(f"{date}: {profit:.2f} THB")

        # Save detailed results to a JSON file
        results = {
            'total_profit': float(total_profit),
            'remaining_thb': float(remaining_thb),
            'rate_spread_stats': {
                'average': avg_rate_spread,
                'minimum': min_rate_spread,
                'maximum': max_rate_spread
            },
            'customer_profits': {k: float(v) for k, v in customer_profits.items()},
            'daily_profits': {k: float(v) for k, v in daily_profits.items()},
            'transaction_matches': transaction_matches
        }

        with open('profit_calculation_results.json', 'w') as f:
            json.dump(results, f, indent=4) 