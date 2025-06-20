from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Currency, ExchangeRate, Transaction, GoogleSheetConfig, ExchangeLeftover

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']

class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = '__all__'

class ExchangeRateSerializer(serializers.ModelSerializer):
    source_currency_code = serializers.CharField(source='source_currency.code', read_only=True)
    target_currency_code = serializers.CharField(source='target_currency.code', read_only=True)
    added_by_username = serializers.CharField(source='added_by.username', read_only=True)
    formatted_datetime = serializers.SerializerMethodField()
    
    class Meta:
        model = ExchangeRate
        fields = '__all__'
    
    def get_formatted_datetime(self, obj):
        return f"{obj.date} {obj.time.strftime('%H:%M')}"

class TransactionSerializer(serializers.ModelSerializer):
    source_currency_code = serializers.CharField(source='source_currency.code', read_only=True)
    target_currency_code = serializers.CharField(source='target_currency.code', read_only=True)
    added_by_username = serializers.CharField(source='added_by.username', read_only=True)
    
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = [
            'reference_number', 'profit', 
            'thb_per_100k_mmk_buy_rate', 'thb_per_100k_mmk_sell_rate'
        ]
    
    def create(self, validated_data):
        # Set the user who created the transaction
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['added_by'] = request.user
        
        # Let the model's save method handle all the calculations    
        return super().create(validated_data)

class GoogleSheetConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoogleSheetConfig
        fields = '__all__'
        extra_kwargs = {
            'credentials_json': {'write_only': True}
        }

class ExchangeLeftoverSerializer(serializers.ModelSerializer):
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    
    class Meta:
        model = ExchangeLeftover
        fields = '__all__'
        read_only_fields = ['is_processed'] 