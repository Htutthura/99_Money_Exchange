import os
import django
import sys
from decimal import Decimal
from datetime import datetime, timedelta

# Setup Django environment
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.utils import timezone
from api.models import Currency, Transaction, ExchangeRate, ExchangeLeftover
from django.contrib.auth.models import User

# Get or create admin user
admin_user, _ = User.objects.get_or_create(
    username='admin',
    defaults={
        'is_staff': True,
        'is_superuser': True
    }
)

# Get currency objects
try:
    thb = Currency.objects.get(code='THB')
    mmk = Currency.objects.get(code='MMK')
except Currency.DoesNotExist:
    # Create currencies if they don't exist
    thb = Currency.objects.create(
        code='THB',
        name='Thai Baht',
        symbol='฿'
    )
    mmk = Currency.objects.create(
        code='MMK',
        name='Myanmar Kyat',
        symbol='K'
    )
    print("Created THB and MMK currencies")

# Create test exchange rates if needed
today = timezone.now().date()
current_time = timezone.now().time()

# Check if we already have exchange rates for today
if not ExchangeRate.objects.filter(date=today, source_currency=thb, target_currency=mmk).exists():
    # Create THB to MMK rate
    ExchangeRate.objects.create(
        source_currency=thb,
        target_currency=mmk,
        buy_rate=Decimal('60.00'),  # 1 THB = 60 MMK when buying
        sell_rate=Decimal('58.00'),  # 1 THB = 58 MMK when selling
        date=today,
        time=current_time,
        added_by=admin_user
    )
    
    # Create MMK to THB rate
    ExchangeRate.objects.create(
        source_currency=mmk,
        target_currency=thb,
        buy_rate=Decimal('0.0166'),  # 1 MMK = 0.0166 THB when buying (1/60)
        sell_rate=Decimal('0.0172'),  # 1 MMK = 0.0172 THB when selling (1/58)
        date=today,
        time=current_time,
        added_by=admin_user
    )
    print("Created exchange rates for today")

# Clear existing test transactions and leftovers
Transaction.objects.filter(customer_name__startswith='Test Customer').delete()
ExchangeLeftover.objects.all().delete()
print("Cleared existing test transactions and leftovers")

# Scenario 1: Customer exchanges MMK to THB, then another customer exchanges THB to MMK
# 1. Buy transaction: Customer gives 600,000 MMK and gets 10,000 THB (rate: 1 THB = 60 MMK)
buy_transaction1 = Transaction.objects.create(
    transaction_type='BUY',  # Customer MMK → THB
    source_currency=mmk,
    target_currency=thb,
    source_amount=Decimal('600000.00'),
    target_amount=Decimal('10000.00'),
    rate=Decimal('0.0167'),  # 1 MMK = 0.0167 THB
    date=today,
    time=current_time,
    customer_name='Test Customer 1',
    added_by=admin_user
)
print(f"Created BUY transaction: {buy_transaction1.reference_number}")

# 2. Sell transaction: Customer gives 5,000 THB and gets 300,000 MMK (rate: 1 THB = 60 MMK)
sell_transaction1 = Transaction.objects.create(
    transaction_type='SELL',  # Customer THB → MMK
    source_currency=thb,
    target_currency=mmk,
    source_amount=Decimal('5000.00'),
    target_amount=Decimal('300000.00'),
    rate=Decimal('60.00'),  # 1 THB = 60 MMK
    date=today + timedelta(days=1),
    time=current_time,
    customer_name='Test Customer 2',
    related_transaction=buy_transaction1,
    added_by=admin_user
)
print(f"Created SELL transaction: {sell_transaction1.reference_number}")

# 3. Sell transaction: Customer gives 5,000 THB and gets 305,000 MMK (rate: 1 THB = 61 MMK)
sell_transaction2 = Transaction.objects.create(
    transaction_type='SELL',  # Customer THB → MMK
    source_currency=thb,
    target_currency=mmk,
    source_amount=Decimal('5000.00'),
    target_amount=Decimal('305000.00'),
    rate=Decimal('61.00'),  # 1 THB = 61 MMK
    date=today + timedelta(days=2),
    time=current_time,
    customer_name='Test Customer 3',
    related_transaction=buy_transaction1,
    added_by=admin_user
)
print(f"Created SELL transaction: {sell_transaction2.reference_number}")

# Scenario 2: Customer exchanges MMK to THB, then later exchanges THB back to MMK
# 1. Buy transaction: Customer gives 580,000 MMK and gets 10,000 THB (rate: 1 THB = 58 MMK)
buy_transaction2 = Transaction.objects.create(
    transaction_type='BUY',  # Customer MMK → THB
    source_currency=mmk,
    target_currency=thb,
    source_amount=Decimal('580000.00'),
    target_amount=Decimal('10000.00'),
    rate=Decimal('0.0172'),  # 1 MMK = 0.0172 THB
    date=today,
    time=current_time,
    customer_name='Test Customer 4',
    added_by=admin_user
)
print(f"Created BUY transaction: {buy_transaction2.reference_number}")

# 2. Buy transaction: Customer gives 300,000 MMK and gets 5,000 THB (rate: 1 THB = 60 MMK)
buy_transaction3 = Transaction.objects.create(
    transaction_type='BUY',  # Customer MMK → THB
    source_currency=mmk,
    target_currency=thb,
    source_amount=Decimal('300000.00'),
    target_amount=Decimal('5000.00'),
    rate=Decimal('0.0167'),  # 1 MMK = 0.0167 THB
    date=today + timedelta(days=1),
    time=current_time,
    customer_name='Test Customer 5',
    added_by=admin_user
)
print(f"Created BUY transaction: {buy_transaction3.reference_number}")

# 3. Sell transaction: Customer gives 8,000 THB and gets 480,000 MMK (rate: 1 THB = 60 MMK)
sell_transaction3 = Transaction.objects.create(
    transaction_type='SELL',  # Customer THB → MMK
    source_currency=thb,
    target_currency=mmk,
    source_amount=Decimal('8000.00'),
    target_amount=Decimal('480000.00'),
    rate=Decimal('60.00'),  # 1 THB = 60 MMK
    date=today + timedelta(days=2),
    time=current_time,
    customer_name='Test Customer 6',
    related_transaction=buy_transaction2,  # Link to first buy transaction
    added_by=admin_user
)
print(f"Created SELL transaction: {sell_transaction3.reference_number}")

# Retrieve and print transactions with profit
print("\nTransactions with profit calculation:")
for transaction in Transaction.objects.filter(customer_name__startswith='Test Customer').order_by('date', 'time'):
    print(f"{transaction.reference_number} - {transaction.transaction_type} - {transaction.source_amount} {transaction.source_currency.code} -> {transaction.target_amount} {transaction.target_currency.code} - Profit: {transaction.profit} THB") 