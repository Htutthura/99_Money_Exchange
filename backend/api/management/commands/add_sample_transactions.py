from django.core.management.base import BaseCommand
from api.models import Transaction, Currency
from django.utils import timezone
from decimal import Decimal

class Command(BaseCommand):
    help = 'Adds sample transactions for profit calculation'

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

        # List of transactions to add
        transactions = [
            {
                'transaction_type': 'BUY',
                'customer_name': 'Volg',
                'source_amount': Decimal('2000000'),
                'target_amount': Decimal('15500'),
                'rate': Decimal('129.03'),  # 2000000/15500
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'Thin Htet Soe',
                'source_amount': Decimal('1586'),
                'target_amount': Decimal('200000'),
                'rate': Decimal('126.10'),  # 200000/1586
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'Zay Lin Maung',
                'source_amount': Decimal('100000'),
                'target_amount': Decimal('779'),
                'rate': Decimal('128.37'),  # 100000/779
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'Zay Lin Maung',
                'source_amount': Decimal('140000'),
                'target_amount': Decimal('1090'),
                'rate': Decimal('128.44'),  # 140000/1090
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'Shun Lai Maung',
                'source_amount': Decimal('49750'),
                'target_amount': Decimal('6250000'),
                'rate': Decimal('125.63'),  # 6250000/49750
            },
            {
                'transaction_type': 'BUY',
                'customer_name': 'PTK',
                'source_amount': Decimal('5000000'),
                'target_amount': Decimal('39100'),
                'rate': Decimal('127.88'),  # 5000000/39100
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'Shun Lai Maung',
                'source_amount': Decimal('16875'),
                'target_amount': Decimal('2120000'),
                'rate': Decimal('125.63'),  # 2120000/16875
            },
            {
                'transaction_type': 'SELL',
                'customer_name': 'Chue Eain Si Lwin',
                'source_amount': Decimal('1580'),
                'target_amount': Decimal('200000'),
                'rate': Decimal('126.58'),  # 200000/1580
            },
        ]

        # Add transactions
        for tx in transactions:
            if tx['transaction_type'] == 'BUY':
                source_currency = mmk
                target_currency = thb
            else:  # SELL
                source_currency = thb
                target_currency = mmk

            Transaction.objects.create(
                transaction_type=tx['transaction_type'],
                source_currency=source_currency,
                target_currency=target_currency,
                source_amount=tx['source_amount'],
                target_amount=tx['target_amount'],
                rate=tx['rate'],
                customer_name=tx['customer_name'],
                date=timezone.now().date(),
                time=timezone.now().time()
            )

        self.stdout.write(self.style.SUCCESS('Successfully added all transactions')) 