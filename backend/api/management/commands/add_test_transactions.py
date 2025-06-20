from django.core.management.base import BaseCommand
from api.models import Transaction, Currency
from django.utils import timezone
from decimal import Decimal

class Command(BaseCommand):
    help = 'Adds test transactions for profit calculation'

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

        # Delete all existing transactions
        Transaction.objects.all().delete()

        # List of transactions to add
        transactions = [
            {
                'transaction_type': 'SELL',
                'customer_name': 'Shanlay',
                'source_amount': Decimal('15560'),  # THB
                'target_amount': Decimal('2000000'),  # MMK
                'rate': Decimal('128.53'),  # 2000000/15560
                'source_currency': thb,
                'target_currency': mmk,
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'Aung Myint Myat',
                'source_amount': Decimal('312'),  # THB
                'target_amount': Decimal('40000'),  # MMK
                'rate': Decimal('128.21'),  # 40000/312
                'source_currency': thb,
                'target_currency': mmk,
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'PTK',
                'source_amount': Decimal('1000000'),  # MMK
                'target_amount': Decimal('7620'),  # THB
                'rate': Decimal('131.23'),  # 1000000/7620
                'source_currency': mmk,
                'target_currency': thb,
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'Yadanar Min Aung',
                'source_amount': Decimal('500000'),  # MMK
                'target_amount': Decimal('3805'),  # THB
                'rate': Decimal('131.41'),  # 500000/3805
                'source_currency': mmk,
                'target_currency': thb,
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'Aye Nyein',
                'source_amount': Decimal('15500'),  # THB
                'target_amount': Decimal('2000000'),  # MMK
                'rate': Decimal('129.03'),  # 2000000/15500
                'source_currency': thb,
                'target_currency': mmk,
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'Thein Htike Soe',
                'source_amount': Decimal('2628200'),  # MMK
                'target_amount': Decimal('20000'),  # THB
                'rate': Decimal('131.41'),  # 2628200/20000
                'source_currency': mmk,
                'target_currency': thb,
            },
        ]

        # Add transactions
        for tx in transactions:
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

        self.stdout.write(self.style.SUCCESS('Successfully added test transactions')) 