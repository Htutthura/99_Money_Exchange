from django.db import models
from django.utils import timezone

class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('BUY', 'Buy'),
        ('SELL', 'Sell'),
        ('OTHER', 'Other Profit'),
    ]
    
    transaction_type = models.CharField(max_length=5, choices=TRANSACTION_TYPES, default='BUY', db_index=True)
    date_time = models.DateTimeField(default=timezone.now, db_index=True)
    customer = models.CharField(max_length=200, db_index=True)
    thb_amount = models.DecimalField(max_digits=10, decimal_places=2)
    mmk_amount = models.DecimalField(max_digits=15, decimal_places=2)
    rate = models.DecimalField(max_digits=10, decimal_places=4)
    hundred_k_rate = models.DecimalField(max_digits=10, decimal_places=2)
    profit = models.DecimalField(max_digits=10, decimal_places=2)
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.date_time.strftime('%Y-%m-%d %H:%M')} - {self.customer} ({self.transaction_type})"

    class Meta:
        ordering = ['-date_time'] 

class BankAccount(models.Model):
    CURRENCY_CHOICES = [
        ('THB', 'Thai Baht'),
        ('MMK', 'Myanmar Kyat'),
    ]
    
    name = models.CharField(max_length=100)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.currency})"
        
    class Meta:
        ordering = ['currency', 'name']

class DailyExchangeRate(models.Model):
    date = models.DateField(unique=True)
    rate = models.DecimalField(max_digits=10, decimal_places=4, help_text="MMK to THB exchange rate")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.date}: {self.rate} MMK/THB"
    
    class Meta:
        ordering = ['-date']

class DailyBalance(models.Model):
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='balances')
    date = models.DateField()
    balance = models.DecimalField(max_digits=15, decimal_places=2)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['bank_account', 'date']  # Prevent duplicate entries
        ordering = ['-date', 'bank_account__currency', 'bank_account__name']
        
    def __str__(self):
        return f"{self.bank_account.name} - {self.date}: {self.balance} {self.bank_account.currency}"

class DailyProfit(models.Model):
    date = models.DateField(unique=True)
    buy_sell_profit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_profit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_profit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        
    def __str__(self):
        return f"{self.date}: {self.total_profit} THB"
        
    def save(self, *args, **kwargs):
        # Calculate total profit before saving
        self.total_profit = self.buy_sell_profit + self.other_profit
        super().save(*args, **kwargs) 

class ExpenseType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Expense(models.Model):
    expense_type = models.ForeignKey(ExpenseType, on_delete=models.PROTECT, related_name='expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    remarks = models.TextField(blank=True, null=True)
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.date} - {self.expense_type.name}: {self.amount}"

# Temporary management command for clearing Expense records
if __name__ == '__main__':
    from django.conf import settings
    import django
    django.setup()
    from transactions.models import Expense
    Expense.objects.all().delete()
    print('All Expense records deleted.') 