from rest_framework import serializers
from .models import Transaction, BankAccount, DailyBalance, DailyExchangeRate, DailyProfit, Expense, ExpenseType
# from core.serializers import StandardDateField, StandardDateTimeField, DisplayDateTimeField
# from core.utils import DateTimeService
import logging

class TransactionSerializer(serializers.ModelSerializer):
    date_time = serializers.DateTimeField(required=False)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'transaction_type', 'customer', 'thb_amount', 
            'mmk_amount', 'rate', 'hundred_k_rate', 'profit', 
            'date_time', 'remarks'
        ]
        read_only_fields = ['id']
    
    def create(self, validated_data):
        # Log the validated data to see what we're working with
        logger = logging.getLogger(__name__)
        logger.info(f"TransactionSerializer.create called with: {validated_data}")
        
        # If date_time is not provided, it will use the model's default (timezone.now)
        transaction = super().create(validated_data)
        logger.info(f"Created transaction with date_time: {transaction.date_time}")
        return transaction

class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = [
            'id', 'name', 'currency', 'is_active', 'description',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class DailyExchangeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyExchangeRate
        fields = [
            'id', 'date', 'rate', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class DailyBalanceSerializer(serializers.ModelSerializer):
    bank_account_name = serializers.CharField(source='bank_account.name', read_only=True)
    currency = serializers.CharField(source='bank_account.currency', read_only=True)

    class Meta:
        model = DailyBalance
        fields = [
            'id', 'bank_account', 'bank_account_name', 'currency',
            'date', 'balance', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class DailyBalanceSummarySerializer(serializers.Serializer):
    date = serializers.DateField()
    thb_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    mmk_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    mmk_in_thb = serializers.DecimalField(max_digits=15, decimal_places=2)
    grand_total_thb = serializers.DecimalField(max_digits=15, decimal_places=2)
    rate = serializers.DecimalField(max_digits=10, decimal_places=4)

class DailyProfitSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyProfit
        fields = [
            'id', 'date', 'buy_sell_profit', 'other_profit', 
            'total_profit', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class ExpenseTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseType
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class ExpenseSerializer(serializers.ModelSerializer):
    expense_type_name = serializers.CharField(source='expense_type.name', read_only=True)
    expense_type_details = ExpenseTypeSerializer(source='expense_type', read_only=True)
    amount_thb = serializers.SerializerMethodField()
    amount_thb_rate_info = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            'id', 'expense_type', 'expense_type_name', 'expense_type_details',
            'amount', 'amount_thb', 'amount_thb_rate_info', 'description', 'remarks', 'date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_amount_thb(self, obj):
        rate = self._get_exchange_rate_for_expense(obj)
        if rate and obj.amount is not None:
            return obj.amount * rate.rate
        return None

    def get_amount_thb_rate_info(self, obj):
        rate = self._get_exchange_rate_for_expense(obj)
        if not rate:
            return "No exchange rate available"
        if rate.date == obj.date:
            return f"Rate: {rate.rate} on {rate.date}"
        return f"Using rate from {rate.date} ({rate.rate}) as no rate exists for {obj.date}"

    def _get_exchange_rate_for_expense(self, obj):
        # Cache the rate on the object to avoid redundant lookups
        if hasattr(self, '_cached_rate') and self._cached_rate and self._cached_rate.date == obj.date:
             return self._cached_rate

        # Try to get the rate for the specific date of the expense
        rate = DailyExchangeRate.objects.filter(date=obj.date).first()
        if rate:
            self._cached_rate = rate
            return rate

        # If no rate is found for that day, find the most recent one
        most_recent_rate = DailyExchangeRate.objects.filter(date__lte=obj.date).order_by('-date').first()
        if most_recent_rate:
            self._cached_rate = most_recent_rate
            return most_recent_rate
            
        return None

    def create(self, validated_data):
        # Get the expense_type instance
        expense_type = validated_data.pop('expense_type')
        if isinstance(expense_type, str):
            # If a string is provided, try to get or create the expense type
            expense_type, _ = ExpenseType.objects.get_or_create(
                name=expense_type,
                defaults={'is_active': True}
            )
        # Create the expense with the expense_type instance
        expense = Expense.objects.create(expense_type=expense_type, **validated_data)
        return expense 