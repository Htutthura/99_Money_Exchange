from django.core.management.base import BaseCommand
from api.models import Transaction, Currency
from django.utils import timezone
from decimal import Decimal

class Command(BaseCommand):
    help = 'Adds new test transactions for profit calculation while preserving existing ones'

    def handle(self, *args, **options):
        # Get or create currencies
        thb, _ = Currency.objects.get_or_create(
            code='THB',
            defaults={'name': 'Thai Baht', 'symbol': '฿'}
        )
        mmk, _ = Currency.objects.get_or_create(
            code='MMK',
            defaults={'name': 'Myanmar Kyat', 'symbol': 'K'}
        )

        # List of new transactions to add
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

        # Add new transactions
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

        self.stdout.write(self.style.SUCCESS('Successfully added new test transactions')) 