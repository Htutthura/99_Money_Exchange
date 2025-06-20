from django.core.management.base import BaseCommand
from transactions.models import ExpenseType

class Command(BaseCommand):
    help = 'Creates default expense types'

    def handle(self, *args, **kwargs):
        default_types = [
            {
                'name': 'Food',
                'description': 'Food and beverages'
            },
            {
                'name': 'Rent',
                'description': 'Rent and lease payments'
            },
            {
                'name': 'Transport',
                'description': 'Transportation costs'
            },
            {
                'name': 'Utilities',
                'description': 'Electricity, water, etc.'
            }
        ]

        for type_data in default_types:
            ExpenseType.objects.get_or_create(
                name=type_data['name'],
                defaults={
                    'description': type_data['description'],
                    'is_active': True
                }
            )
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created expense type "{type_data["name"]}"')
            ) 