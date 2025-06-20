import os
import django
import datetime

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import Currency, ExchangeRate, Transaction
from django.contrib.auth.models import User

def populate_currencies():
    """Create initial currencies"""
    # Create THB
    thb, created = Currency.objects.get_or_create(
        code='THB',
        defaults={
            'name': 'Thai Baht',
            'symbol': '฿'
        }
    )
    if created:
        print(f"Created currency: {thb}")
    else:
        print(f"Currency already exists: {thb}")
        
    # Create MMK
    mmk, created = Currency.objects.get_or_create(
        code='MMK',
        defaults={
            'name': 'Myanmar Kyat',
            'symbol': 'K'
        }
    )
    if created:
        print(f"Created currency: {mmk}")
    else:
        print(f"Currency already exists: {mmk}")
    
    return thb, mmk

def populate_exchange_rates(thb, mmk):
    """Create sample exchange rates"""
    # Get admin user for attribution
    admin = User.objects.filter(is_superuser=True).first()
    
    # Example rates (adjust these to your actual rates)
    rates = [
        # THB to MMK rate (buying THB with MMK)
        {
            'source': thb,
            'target': mmk,
            'rate': 114.5,  # 1 THB = 114.5 MMK
            'date': datetime.date.today(),
            'time': datetime.time(9, 0)  # 9:00 AM
        },
        # MMK to THB rate (buying MMK with THB)
        {
            'source': mmk,
            'target': thb,
            'rate': 0.0085,  # 1 MMK = 0.0085 THB
            'date': datetime.date.today(),
            'time': datetime.time(9, 0)  # 9:00 AM
        },
        # Afternoon rates
        {
            'source': thb,
            'target': mmk,
            'rate': 115.0,  # Rate increased
            'date': datetime.date.today(),
            'time': datetime.time(14, 30)  # 2:30 PM
        },
        {
            'source': mmk,
            'target': thb,
            'rate': 0.0084,  # Rate decreased
            'date': datetime.date.today(),
            'time': datetime.time(14, 30)  # 2:30 PM
        }
    ]
    
    for rate_data in rates:
        rate, created = ExchangeRate.objects.get_or_create(
            source_currency=rate_data['source'],
            target_currency=rate_data['target'],
            date=rate_data['date'],
            time=rate_data['time'],
            defaults={
                'rate': rate_data['rate'],
                'added_by': admin
            }
        )
        
        if created:
            print(f"Created exchange rate: {rate}")
        else:
            print(f"Exchange rate already exists: {rate}")

def create_sample_transactions():
    """Create sample transactions with the new fields"""
    # Get currencies
    try:
        thb = Currency.objects.get(code='THB')
        mmk = Currency.objects.get(code='MMK')
    except Currency.DoesNotExist:
        print("Currencies not found. Please run populate_currencies first.")
        return
    
    # Get admin user
    admin = User.objects.filter(is_superuser=True).first()
    
    # Example transactions
    transactions = [
        # Customer buys THB
        {
            'transaction_type': 'BUY',
            'customer_name': 'John Doe',
            'customer_phone': '09123456789',
            'thb_inflow': 1000,  # Customer receives 1000 THB
            'mmk_outflow': 115000,  # Customer pays 115,000 MMK
            'mmk_per_thb_buy_rate': 115.0,  # Rate: 1 THB = 115 MMK
            'mmk_per_thb_sell_rate': 114.0,  # For reference 
        },
        # Customer sells THB
        {
            'transaction_type': 'SELL',
            'customer_name': 'Jane Smith',
            'customer_phone': '09987654321',
            'thb_outflow': 500,  # Customer gives 500 THB
            'mmk_inflow': 57000,  # Customer receives 57,000 MMK
            'mmk_per_thb_buy_rate': 115.0,  # For reference
            'mmk_per_thb_sell_rate': 114.0,  # Rate: 1 THB = 114 MMK
        }
    ]
    
    for tx_data in transactions:
        # Check if transaction already exists (by customer name and amount as a simple check)
        existing = Transaction.objects.filter(
            customer_name=tx_data['customer_name'],
            transaction_type=tx_data['transaction_type']
        ).exists()
        
        if not existing:
            tx = Transaction(
                **tx_data,
                added_by=admin
            )
            tx.save()
            print(f"Created transaction: {tx}")
        else:
            print(f"Transaction for {tx_data['customer_name']} already exists.")

if __name__ == '__main__':
    print("Starting population script...")
    thb, mmk = populate_currencies()
    populate_exchange_rates(thb, mmk)
    create_sample_transactions()
    print("Population completed!") 