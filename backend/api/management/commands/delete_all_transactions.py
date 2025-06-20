from django.core.management.base import BaseCommand
from api.models import Transaction, ExchangeLeftover

class Command(BaseCommand):
    help = 'Deletes all transactions and related leftovers from the database'

    def handle(self, *args, **options):
        # Delete all transactions
        transaction_count = Transaction.objects.count()
        Transaction.objects.all().delete()
        
        # Delete all leftovers
        leftover_count = ExchangeLeftover.objects.count()
        ExchangeLeftover.objects.all().delete()
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully deleted {transaction_count} transactions and {leftover_count} leftovers')
        ) 