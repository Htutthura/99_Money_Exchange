from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('transactions', '0008_expense'),
    ]
    operations = [
        migrations.DeleteModel(
            name='Expense',
        ),
    ] 