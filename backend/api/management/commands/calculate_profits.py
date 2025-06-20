from django.core.management.base import BaseCommand
from api.models import Transaction, Currency
from decimal import Decimal
from collections import defaultdict

class Command(BaseCommand):
    help = 'Calculates and displays profits for all transactions'

    def handle(self, *args, **options):
        # Get currencies
        thb = Currency.objects.get(code='THB')
        mmk = Currency.objects.get(code='MMK')

        # Get all transactions ordered by time
        transactions = Transaction.objects.all().order_by('date', 'time')

        # Track THB inventory and profits
        thb_inventory = Decimal('0')
        profits = defaultdict(Decimal)
        our_buys = []  # When customer sells THB to us
        our_sells = []  # When customer buys THB from us

        # First, let's print all transactions
        self.stdout.write(self.style.SUCCESS('\nAll Transactions:'))
        self.stdout.write('=' * 50)
        for tx in transactions:
            if tx.transaction_type == 'BUY':  # Customer buys THB = We sell THB
                self.stdout.write(f"\nCustomer BUY (We SELL): {tx.customer_name}")
                self.stdout.write(f"MMK: {tx.source_amount} → THB: {tx.target_amount}")
                self.stdout.write(f"Rate: {tx.rate:.2f} MMK/THB")
                thb_inventory -= tx.target_amount  # We're giving THB
                our_sells.append(tx)
            else:  # Customer SELL = We BUY
                self.stdout.write(f"\nCustomer SELL (We BUY): {tx.customer_name}")
                self.stdout.write(f"THB: {tx.source_amount} → MMK: {tx.target_amount}")
                self.stdout.write(f"Rate: {tx.rate:.2f} MMK/THB")
                thb_inventory += tx.source_amount  # We're receiving THB
                our_buys.append(tx)

        # Match our BUY and SELL transactions to calculate profits
        total_profit = Decimal('0')
        profit_details = []

        self.stdout.write(self.style.SUCCESS('\n\nTransaction Matches and Profit Calculation:'))
        self.stdout.write('=' * 50)

        while our_buys and our_sells:
            buy_tx = our_buys[0]  # When we buy THB (customer sells to us)
            sell_tx = our_sells[0]  # When we sell THB (customer buys from us)

            # Calculate matched amount in THB
            matched_thb = min(buy_tx.source_amount, sell_tx.target_amount)

            # Calculate profit
            # For each matched THB:
            # When we buy: We give MMK at buy_tx.rate
            # When we sell: We receive MMK at sell_tx.rate
            # Profit = MMK received - MMK paid
            mmk_paid = matched_thb * buy_tx.rate  # What we pay in MMK when buying THB
            mmk_received = matched_thb * sell_tx.rate  # What we receive in MMK when selling THB
            
            # Calculate profit in THB
            profit = (mmk_received - mmk_paid) / sell_tx.rate

            # Add to total profit
            total_profit += profit

            # Add to customer's profit contribution
            profits[sell_tx.customer_name] += profit

            # Record profit details
            profit_details.append({
                'buy_from_customer': buy_tx.customer_name,
                'sell_to_customer': sell_tx.customer_name,
                'matched_amount': matched_thb,
                'profit': profit,
                'mmk_paid': mmk_paid,
                'mmk_received': mmk_received,
                'buy_rate': buy_tx.rate,
                'sell_rate': sell_tx.rate
            })

            # Display match details
            self.stdout.write(f"\nMatch #{len(profit_details)}:")
            self.stdout.write(f"We BUY from: {buy_tx.customer_name}")
            self.stdout.write(f"  THB: {buy_tx.source_amount} → MMK: {buy_tx.target_amount}")
            self.stdout.write(f"  Rate: {buy_tx.rate:.2f} MMK/THB")
            self.stdout.write(f"We SELL to: {sell_tx.customer_name}")
            self.stdout.write(f"  THB: {sell_tx.target_amount} ← MMK: {sell_tx.source_amount}")
            self.stdout.write(f"  Rate: {sell_tx.rate:.2f} MMK/THB")
            self.stdout.write(f"Matched Amount: {matched_thb:.2f} THB")
            self.stdout.write(f"MMK Paid: {mmk_paid:.2f} MMK")
            self.stdout.write(f"MMK Received: {mmk_received:.2f} MMK")
            self.stdout.write(f"Rate Spread: {(sell_tx.rate - buy_tx.rate):.2f} MMK/THB")
            self.stdout.write(f"Profit: {profit:.2f} THB")
            self.stdout.write('-' * 30)

            # Update remaining amounts
            buy_tx.source_amount -= matched_thb
            sell_tx.target_amount -= matched_thb

            # Remove fully matched transactions
            if buy_tx.source_amount == 0:
                our_buys.pop(0)
            if sell_tx.target_amount == 0:
                our_sells.pop(0)

        # Display summary
        self.stdout.write(self.style.SUCCESS('\nSummary:'))
        self.stdout.write('=' * 50)
        self.stdout.write(f'\nTotal Profit: {total_profit:.2f} THB')
        self.stdout.write(f'Remaining THB Inventory: {thb_inventory:.2f} THB')
        
        self.stdout.write('\nProfit Contribution by Customer Transaction:')
        for customer, profit in profits.items():
            self.stdout.write(f'{customer}: {profit:.2f} THB') 