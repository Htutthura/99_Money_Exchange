import os
import django
import sys
from decimal import Decimal
from datetime import datetime, date, timedelta

# Setup Django environment
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.utils import timezone
from api.models import Currency, Transaction, ExchangeRate, ExchangeLeftover
from django.contrib.auth.models import User
from django.db import transaction as db_transaction

print("Creating sample data that matches the Excel screenshot...")

# Get or create admin user
admin_user, _ = User.objects.get_or_create(
    username='admin',
    defaults={
        'is_staff': True,
        'is_superuser': True,
        'password': 'admin'
    }
)

# Clear all existing data
print("Clearing existing data...")
Transaction.objects.all().delete()
ExchangeRate.objects.all().delete()
ExchangeLeftover.objects.all().delete()
Currency.objects.all().delete()

# Create currencies
print("Creating currencies...")
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

# Create exchange rates for 09-04-25
date_obj = date(2025, 4, 9)  # Use the date from the Excel screenshot
time_obj = datetime.now().time()

# Create rates that match those in the Excel
ExchangeRate.objects.create(
    source_currency=mmk,
    target_currency=thb,
    buy_rate=Decimal('0.00775'),  # For 100K MMK = 775 THB
    sell_rate=Decimal('0.00770'),  # Slightly lower for selling
    date=date_obj,
    time=time_obj,
    added_by=admin_user
)

# Create THB to MMK rate
ExchangeRate.objects.create(
    source_currency=thb,
    target_currency=mmk,
    buy_rate=Decimal('129.03'),  # Based on first entry Customer Rate
    sell_rate=Decimal('125.63'),  # Based on entries for Shun Lai Maung
    date=date_obj,
    time=time_obj,
    added_by=admin_user
)

print("Creating transactions from the Excel data...")

# First create all BUY transactions
with db_transaction.atomic():
    # 1. Volg - BUY transaction
    t_volg = Transaction.objects.create(
        transaction_type='BUY',
        source_currency=mmk,
        target_currency=thb,
        source_amount=Decimal('2000000.00'),  # Kyat Inflow
        target_amount=Decimal('15500.00'),    # Baht Outflow
        rate=Decimal('0.00775'),              # Rate for 100K MMK = 775 THB
        date=date_obj,                        # 09-04-25
        time=time_obj,
        customer_name='Volg',
        added_by=admin_user
    )

    # 2. Thin Htet Soe - BUY transaction
    t_thin = Transaction.objects.create(
        transaction_type='BUY',
        source_currency=mmk,
        target_currency=thb,
        source_amount=Decimal('200000.00'),   # Kyat Inflow (approximately based on rate)
        target_amount=Decimal('1586.00'),     # Baht Outflow
        rate=Decimal('0.00793'),              # Rate for 100K MMK = 793 THB
        date=date_obj,                        # 09-04-25
        time=time_obj,
        customer_name='Thin Htet Soe',
        added_by=admin_user
    )

    # 3. Zay Lin Maung - BUY transaction
    t_zay1 = Transaction.objects.create(
        transaction_type='BUY',
        source_currency=mmk,
        target_currency=thb,
        source_amount=Decimal('100000.00'),   # Kyat Inflow
        target_amount=Decimal('779.00'),      # Baht Outflow
        rate=Decimal('0.00779'),              # Rate for 100K MMK = 779 THB
        date=date_obj,                        # 09-04-25
        time=time_obj,
        customer_name='Zay Lin Maung',
        added_by=admin_user
    )

    # 4. Zay Lin Maung - another BUY transaction
    t_zay2 = Transaction.objects.create(
        transaction_type='BUY',
        source_currency=mmk,
        target_currency=thb,
        source_amount=Decimal('140000.00'),   # Kyat Inflow
        target_amount=Decimal('1090.00'),     # Baht Outflow
        rate=Decimal('0.00779'),              # Rate calculated from 778.57 per 100K
        date=date_obj,                        # 09-04-25
        time=time_obj,
        customer_name='Zay Lin Maung',
        added_by=admin_user
    )

    # 5. PTK - BUY transaction
    t_ptk = Transaction.objects.create(
        transaction_type='BUY',
        source_currency=mmk,
        target_currency=thb,
        source_amount=Decimal('5000000.00'),  # Kyat Inflow
        target_amount=Decimal('39100.00'),    # Baht Outflow
        rate=Decimal('0.00782'),              # Rate for 100K MMK = 782 THB
        date=date_obj,                        # 09-04-25
        time=time_obj,
        customer_name='PTK',
        added_by=admin_user
    )

    # 6. Chue Eain Si Lwin - BUY transaction
    t_chue = Transaction.objects.create(
        transaction_type='BUY',
        source_currency=mmk,
        target_currency=thb,
        source_amount=Decimal('200000.00'),   # Kyat Inflow (estimated)
        target_amount=Decimal('1580.00'),     # Baht Outflow
        rate=Decimal('0.00790'),              # Rate for 100K MMK = 790 THB
        date=date_obj,                        # 09-04-25
        time=time_obj,
        customer_name='Chue Eain Si Lwin',
        added_by=admin_user
    )

# Allow the BUY transactions to be saved first
Transaction.objects.all().count()

# Set profit values for BUY transactions to match the Excel
Transaction.objects.filter(id=t_thin.id).update(profit=Decimal('420.00'))  # Thin Htet Soe
Transaction.objects.filter(id=t_zay1.id).update(profit=Decimal('14.00'))   # Zay Lin Maung
Transaction.objects.filter(id=t_zay2.id).update(profit=Decimal('20.20'))   # Zay Lin Maung
Transaction.objects.filter(id=t_ptk.id).update(profit=Decimal('700.00'))   # PTK

# Now create SELL transactions with related transaction links
with db_transaction.atomic():
    # 7. Shun Lai Maung - SELL transaction (related to PTK)
    # This transaction should generate approximately 700 THB profit
    t_shun1 = Transaction.objects.create(
        transaction_type='SELL',
        source_currency=thb,
        target_currency=mmk,
        source_amount=Decimal('49750.00'),    # Baht Inflow
        target_amount=Decimal('6250000.00'),  # Kyat Outflow
        rate=Decimal('125.63'),               # Customer Rate 125.63
        date=date_obj,                        # 09-04-25
        time=time_obj,
        customer_name='Shun Lai Maung',
        added_by=admin_user,
        related_transaction=t_ptk              # Connect to PTK transaction
    )

    # 8. Shun Lai Maung - SELL transaction (related to Thin Htet Soe)
    # This transaction should generate approximately 420 THB profit
    t_shun2 = Transaction.objects.create(
        transaction_type='SELL',
        source_currency=thb,
        target_currency=mmk,
        source_amount=Decimal('16875.00'),    # Baht Inflow
        target_amount=Decimal('2120000.00'),  # Kyat Outflow
        rate=Decimal('125.63'),               # Customer Rate 125.63
        date=date_obj,                        # 09-04-25
        time=time_obj,
        customer_name='Shun Lai Maung',
        added_by=admin_user,
        related_transaction=t_thin            # Connect to Thin Htet Soe transaction
    )

# Update SELL transactions profit values directly
Transaction.objects.filter(id=t_shun1.id).update(profit=Decimal('700.00'))  # First SELL transaction
Transaction.objects.filter(id=t_shun2.id).update(profit=Decimal('420.00'))  # Second SELL transaction

# Get fresh objects
t_shun1_refreshed = Transaction.objects.get(id=t_shun1.id)
t_shun2_refreshed = Transaction.objects.get(id=t_shun2.id)

print(f"Profit for first SELL transaction: {t_shun1_refreshed.profit}")
print(f"Profit for second SELL transaction: {t_shun2_refreshed.profit}")

# Print transaction information
print("\nCreated transactions:")
for t in Transaction.objects.all().order_by('id'):
    if t.transaction_type == 'BUY':
        print(f"{t.id}: {t.transaction_type}: {t.source_amount} MMK → {t.target_amount} THB (Rate: {t.rate}) - Profit: {t.profit} THB - Customer: {t.customer_name}")
    else:
        print(f"{t.id}: {t.transaction_type}: {t.source_amount} THB → {t.target_amount} MMK (Rate: {t.rate}) - Profit: {t.profit} THB - Customer: {t.customer_name}")

print("\nSample data creation completed!")
print("\nNow you can view the transactions in the admin interface with our custom format.")
print("Go to: http://127.0.0.1:8000/admin/api/transaction/") 