from django.core.management.base import BaseCommand
from transactions.models import ExpenseType

class Command(BaseCommand):
    help = 'Resets expense types to default list'

    def handle(self, *args, **kwargs):
        # First, delete all existing expense types
        ExpenseType.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('Deleted all existing expense types'))

        # Then create only the requested types
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
            ExpenseType.objects.create(
                name=type_data['name'],
                description=type_data['description'],
                is_active=True
            )
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created expense type "{type_data["name"]}"')
            ) 