# Generated by Django 5.0.2 on 2025-05-08 12:37

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transaction',
            name='hundred_k_rate',
            field=models.DecimalField(decimal_places=2, max_digits=10),
        ),
    ]
