from django.core.management.base import BaseCommand
from api.models import Transaction, Currency
from decimal import Decimal
from django.utils import timezone

class Command(BaseCommand):
    help = 'Calculates profits for new transactions only'

    def handle(self, *args, **options):
        # Get currencies
        thb = Currency.objects.get(code='THB')
        mmk = Currency.objects.get(code='MMK')

        # Delete all existing transactions
        Transaction.objects.all().delete()

        # Add new transactions
        new_transactions = [
            {
                'transaction_type': 'SELL',
                'customer_name': 'THS',
                'source_amount': Decimal('1600'),  # THB
                'target_amount': Decimal('207250'),  # MMK
                'rate': Decimal('129.53'),  # 207250/1600
                'source_currency': thb,
                'target_currency': mmk,
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'LKK',
                'source_amount': Decimal('13124'),  # THB
                'target_amount': Decimal('1700000'),  # MMK
                'rate': Decimal('129.53'),  # 1700000/13124
                'source_currency': thb,
                'target_currency': mmk,
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'MCS',
                'source_amount': Decimal('4000000'),  # MMK
                'target_amount': Decimal('30280'),  # THB
                'rate': Decimal('132.10'),  # 4000000/30280
                'source_currency': mmk,
                'target_currency': thb,
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'NMM',
                'source_amount': Decimal('1056800'),  # MMK
                'target_amount': Decimal('8010'),  # THB
                'rate': Decimal('131.93'),  # 1056800/8010
                'source_currency': mmk,
                'target_currency': thb,
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'PTK',
                'source_amount': Decimal('1500000'),  # MMK
                'target_amount': Decimal('11355'),  # THB
                'rate': Decimal('132.10'),  # 1500000/11355
                'source_currency': mmk,
                'target_currency': thb,
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'SLM',
                'source_amount': Decimal('22800'),  # THB
                'target_amount': Decimal('3000000'),  # MMK
                'rate': Decimal('131.58'),  # 3000000/22800
                'source_currency': thb,
                'target_currency': mmk,
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'SL',
                'source_amount': Decimal('1633540'),  # MMK
                'target_amount': Decimal('12350'),  # THB
                'rate': Decimal('132.27'),  # 1633540/12350
                'source_currency': mmk,
                'target_currency': thb,
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'TZMA',
                'source_amount': Decimal('595200'),  # MMK
                'target_amount': Decimal('4500'),  # THB
                'rate': Decimal('132.27'),  # 595200/4500
                'source_currency': mmk,
                'target_currency': thb,
            },
        ]

        # Add transactions
        for tx in new_transactions:
            Transaction.objects.create(
                transaction_type=tx['transaction_type'],
                source_currency=tx['source_currency'],
                target_currency=tx['target_currency'],
                source_amount=tx['source_amount'],
                target_amount=tx['target_amount'],
                rate=tx['rate'],
                customer_name=tx['customer_name'],
                date=timezone.now().date(),
                time=timezone.now().time()
            )

        # Calculate profits
        sell_transactions = Transaction.objects.filter(transaction_type='SELL').order_by('date', 'time')
        buy_transactions = Transaction.objects.filter(transaction_type='BUY').order_by('date', 'time')

        total_profit = Decimal('0')
        remaining_thb = Decimal('0')
        customer_profits = {}

        print("\nAll Transactions:")
        print("=" * 50)
        for tx in Transaction.objects.all().order_by('date', 'time'):
            if tx.transaction_type == 'SELL':
                print(f"\nCustomer SELL (We BUY): {tx.customer_name}")
                print(f"THB: {tx.source_amount} → MMK: {tx.target_amount}")
                print(f"Rate: {tx.rate} MMK/THB")
            else:
                print(f"\nCustomer BUY (We SELL): {tx.customer_name}")
                print(f"MMK: {tx.source_amount} → THB: {tx.target_amount}")
                print(f"Rate: {tx.rate} MMK/THB")

        print("\n\nTransaction Matches and Profit Calculation:")
        print("=" * 50)

        match_count = 1
        for buy_tx in buy_transactions:
            remaining_buy_amount = buy_tx.target_amount

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

        print("\nSummary:")
        print("=" * 50)
        print(f"\nTotal Profit: {total_profit:.2f} THB")
        print(f"Remaining THB Inventory: {remaining_thb:.2f} THB")

        print("\nProfit Contribution by Customer Transaction:")
        for customer, profit in customer_profits.items():
            print(f"{customer}: {profit:.2f} THB") 