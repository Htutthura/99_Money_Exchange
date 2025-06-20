from api.models import Transaction
from django.utils import timezone

# Delete all existing transactions
Transaction.objects.all().delete()

# Add new transactions
transactions = [
    {
        'customer_name': 'Shanlay',
        'transaction_type': 'SELL',
        'thb_amount': 15560,
        'mmk_amount': 2000000,
        'rate': 2000000/15560,
        'date': timezone.now()
    },
    {
        'customer_name': 'Aung Myint Myat',
        'transaction_type': 'SELL',
        'thb_amount': 312,
        'mmk_amount': 40000,
        'rate': 40000/312,
        'date': timezone.now()
    },
    {
        'customer_name': 'PTK',
        'transaction_type': 'BUY',
        'thb_amount': 7620,
        'mmk_amount': 1000000,
        'rate': 1000000/7620,
        'date': timezone.now()
    },
    {
        'customer_name': 'Yadanar Min Aung',
        'transaction_type': 'BUY',
        'thb_amount': 3805,
        'mmk_amount': 500000,
        'rate': 500000/3805,
        'date': timezone.now()
    },
    {
        'customer_name': 'Aye Nyein',
        'transaction_type': 'SELL',
        'thb_amount': 15500,
        'mmk_amount': 2000000,
        'rate': 2000000/15500,
        'date': timezone.now()
    },
    {
        'customer_name': 'Thein Htike Soe',
        'transaction_type': 'BUY',
        'thb_amount': 20000,
        'mmk_amount': 2628200,
        'rate': 2628200/20000,
        'date': timezone.now()
    }
]

# Create transactions
for transaction_data in transactions:
    Transaction.objects.create(**transaction_data)

print("Successfully added test transactions") 