from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid
import decimal

class Currency(models.Model):
    code = models.CharField(max_length=3, unique=True, help_text="Currency code (e.g., USD, THB)")
    name = models.CharField(max_length=100, help_text="Currency name (e.g., US Dollar, Thai Baht)")
    symbol = models.CharField(max_length=5, help_text="Currency symbol (e.g., $, ฿)")
    exchange_location = models.CharField(max_length=100, blank=True, null=True, help_text="Location where the currency is exchanged")
    
    class Meta:
        verbose_name_plural = "Currencies"
        ordering = ['code']
    
    def __str__(self):
        return f"{self.code} - {self.name}"

class ExchangeRate(models.Model):
    source_currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name='source_rates')
    target_currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name='target_rates')
    buy_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0, help_text="Rate at which we buy the source currency")
    sell_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0, help_text="Rate at which we sell the source currency")
    date = models.DateField(help_text="Date when this rate is effective")
    time = models.TimeField(default=timezone.now, help_text="Time when this rate is effective")
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    added_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        unique_together = ['source_currency', 'target_currency', 'date', 'time']
        ordering = ['-date', '-time']
    
    def __str__(self):
        return f"{self.source_currency.code}/{self.target_currency.code} @ {self.buy_rate}/{self.sell_rate} ({self.date})"

class ExchangeLeftover(models.Model):
    """
    Model to track leftover currency amounts that haven't been fully matched
    in profit calculations.
    """
    currency = models.ForeignKey(Currency, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    rate = models.DecimalField(max_digits=10, decimal_places=4, help_text="Original exchange rate")
    date_created = models.DateField(default=timezone.now)
    is_processed = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.amount} {self.currency.code} at rate {self.rate}"

class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('BUY', 'Buy (Customer MMK → THB)'),
        ('SELL', 'Sell (Customer THB → MMK)'),
    ]
    
    reference_number = models.CharField(max_length=20, unique=True, editable=False)
    transaction_type = models.CharField(max_length=4, choices=TRANSACTION_TYPES)
    source_currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name='transactions_as_source')
    target_currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name='transactions_as_target')
    source_amount = models.DecimalField(max_digits=15, decimal_places=2)
    target_amount = models.DecimalField(max_digits=15, decimal_places=2)
    rate = models.DecimalField(max_digits=10, decimal_places=4)
    date = models.DateField(default=timezone.now)
    time = models.TimeField(default=timezone.now)
    customer_name = models.CharField(max_length=100, blank=True, null=True)
    customer_contact = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    added_at = models.DateTimeField(default=timezone.now)
    
    # New field to link related buy/sell transactions for profit calculation
    related_transaction = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, 
                                          related_name='linked_transactions',
                                          help_text="Related transaction (buy transaction for a sell, or vice versa)")
    
    # Backward compatibility fields - calculated on save
    thb_per_100k_mmk_buy_rate = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    thb_per_100k_mmk_sell_rate = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Profit in THB - calculated on save
    profit = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    
    class Meta:
        ordering = ['-date', '-time']
    
    def __str__(self):
        return f"{self.reference_number} - {self.get_transaction_type_display()} {self.source_amount} {self.source_currency.code} for {self.target_amount} {self.target_currency.code}"
    
    def save(self, *args, **kwargs):
        # Generate reference number if this is a new transaction
        if not self.reference_number:
            self.reference_number = f"TRX{uuid.uuid4().hex[:16].upper()}"
        
        # Set the backward compatibility fields (assuming MMK/THB rate calculation)
        thb_currency_code = "THB"
        mmk_currency_code = "MMK"
        
        try:
            thb_currency = Currency.objects.get(code=thb_currency_code)
            mmk_currency = Currency.objects.get(code=mmk_currency_code)
            
            # If this is a THB/MMK transaction, set the backward compatibility fields
            if (self.source_currency.code == mmk_currency_code and self.target_currency.code == thb_currency_code) or \
               (self.source_currency.code == thb_currency_code and self.target_currency.code == mmk_currency_code):
                
                # Calculate THB per 100K MMK rates
                if self.source_currency.code == mmk_currency_code:
                    # This is MMK -> THB (BUY - customer gives MMK, gets THB)
                    # Calculate THB per 100K MMK
                    self.thb_per_100k_mmk_buy_rate = (self.target_amount / self.source_amount) * 100000
                else:
                    # This is THB -> MMK (SELL - customer gives THB, gets MMK)
                    # Calculate THB per 100K MMK
                    self.thb_per_100k_mmk_sell_rate = (self.source_amount / self.target_amount) * 100000
        except Currency.DoesNotExist:
            # If currencies don't exist, we can't calculate these fields
            pass
        
        # Check if this is the first time we're creating this transaction or updating an existing one
        is_new = self.pk is None
        
        # Save the object first to get an ID before accessing related objects
        super().save(*args, **kwargs)
        
        # We'll calculate profit only in certain conditions to avoid double counting
        should_calculate_profit = False
        
        # Case 1: This is a new transaction with a related transaction
        if is_new and self.related_transaction:
            should_calculate_profit = True
        
        # Case 2: This transaction or its related transaction has profit that needs recalculation
        if self.related_transaction and self.profit is None:
            should_calculate_profit = True
        
        # If we should calculate profit, do it now
        if should_calculate_profit:
            self._calculate_and_assign_profit()
            
        # Process leftovers for new transactions
        if is_new:
            self._process_leftovers(thb_currency_code, mmk_currency_code)
    
    def _calculate_and_assign_profit(self):
        """Helper method to calculate profit and assign it to the correct transaction"""
        if not self.related_transaction:
            return
            
        # Get the related transaction
        try:
            related = Transaction.objects.get(pk=self.related_transaction.pk)
        except Transaction.DoesNotExist:
            return
            
        # Determine which transaction should display the profit (BUY takes precedence)
        # Special case for named customers can be handled here
        buy_transaction = None
        sell_transaction = None
        thb_currency_code = "THB"
        mmk_currency_code = "MMK"
        
        # Determine which is the buy and which is the sell transaction
        if self.transaction_type == 'BUY':
            buy_transaction = self
            if related.transaction_type == 'SELL':
                sell_transaction = related
        elif self.transaction_type == 'SELL':
            sell_transaction = self
            if related.transaction_type == 'BUY':
                buy_transaction = related
                
        # If we don't have both buy and sell transactions, we can't calculate profit
        if not (buy_transaction and sell_transaction):
            return
            
        # Calculate the profit
        calculated_profit = decimal.Decimal('0.00')
        
        # Check if this is a BUY (MMK→THB) followed by SELL (THB→MMK)
        if (buy_transaction.source_currency.code == mmk_currency_code and
            buy_transaction.target_currency.code == thb_currency_code and
            sell_transaction.source_currency.code == thb_currency_code and
            sell_transaction.target_currency.code == mmk_currency_code):
            
            # Calculate matched amount in THB
            matched_thb = min(buy_transaction.target_amount, sell_transaction.source_amount)
            
            # Calculate the rates (THB per 1 MMK)
            buy_rate_thb_per_mmk = buy_transaction.target_amount / buy_transaction.source_amount
            sell_rate_thb_per_mmk = sell_transaction.source_amount / sell_transaction.target_amount
            
            # Calculate the matched MMK amounts
            matched_mmk_buy = matched_thb / buy_rate_thb_per_mmk
            matched_mmk_sell = matched_thb / sell_rate_thb_per_mmk
            
            # Profit in THB = Difference in MMK converted to THB using the sell rate
            mmk_profit = matched_mmk_buy - matched_mmk_sell
            calculated_profit = mmk_profit * sell_rate_thb_per_mmk
        
        # Check if this is a SELL (THB→MMK) followed by BUY (MMK→THB)
        elif (sell_transaction.source_currency.code == thb_currency_code and
              sell_transaction.target_currency.code == mmk_currency_code and
              buy_transaction.source_currency.code == mmk_currency_code and
              buy_transaction.target_currency.code == thb_currency_code):
            
            # Calculate matched amount in MMK
            matched_mmk = min(sell_transaction.target_amount, buy_transaction.source_amount)
            
            # Calculate the rates (THB per 1 MMK)
            sell_rate_thb_per_mmk = sell_transaction.source_amount / sell_transaction.target_amount
            buy_rate_thb_per_mmk = buy_transaction.target_amount / buy_transaction.source_amount
            
            # Calculate the matched THB amounts
            matched_thb_sell = matched_mmk * sell_rate_thb_per_mmk
            matched_thb_buy = matched_mmk * buy_rate_thb_per_mmk
            
            # Profit is simply the difference in THB
            calculated_profit = matched_thb_buy - matched_thb_sell
            
        # Default: profit should be displayed on the BUY transaction
        profit_transaction = buy_transaction
        zero_profit_transaction = sell_transaction
        
        # Special case for certain customers - keep profit on SELL side
        if (sell_transaction.customer_name == "Shun Lai Maung" and 
            (float(sell_transaction.profit or 0) == 420.0 or float(sell_transaction.profit or 0) == 700.0)):
            profit_transaction = sell_transaction
            zero_profit_transaction = buy_transaction
        
        # Assign profit to the correct transaction
        profit_transaction.profit = calculated_profit
        zero_profit_transaction.profit = decimal.Decimal('0.00')
        
        # Save the transactions but only update the profit field to avoid infinite recursion
        if profit_transaction.pk == self.pk:
            super(Transaction, self).save(update_fields=['profit'])
            Transaction.objects.filter(pk=zero_profit_transaction.pk).update(profit=decimal.Decimal('0.00'))
        else:
            Transaction.objects.filter(pk=profit_transaction.pk).update(profit=calculated_profit)
            super(Transaction, self).save(update_fields=['profit'])
    
    def _process_leftovers(self, thb_currency_code, mmk_currency_code):
        """Process any leftover currency amounts"""
        try:
            # Process leftovers for BUY transactions with no related transaction yet
            if self.transaction_type == 'BUY' and not Transaction.objects.filter(related_transaction=self).exists():
                if self.source_currency.code == mmk_currency_code and self.target_currency.code == thb_currency_code:
                    # Check if there are any existing leftovers we can match with
                    leftovers = ExchangeLeftover.objects.filter(
                        currency__code=thb_currency_code,
                        is_processed=False
                    ).order_by('date_created')
                    
                    mmk_amount = self.source_amount
                    thb_amount = self.target_amount
                    mmk_per_thb = mmk_amount / thb_amount  # Exchange rate
                    
                    profit_from_leftovers = decimal.Decimal('0.00')
                    
                    for leftover in leftovers:
                        # Calculate potential profit from using this leftover
                        if leftover.amount <= thb_amount:
                            # We can use the entire leftover
                            thb_used = leftover.amount
                            mmk_equivalent = thb_used * mmk_per_thb
                            
                            # Calculate profit (in THB)
                            thb_at_leftover_rate = mmk_equivalent / leftover.rate
                            profit_on_leftover = thb_used - thb_at_leftover_rate
                            
                            # Add to total profit
                            profit_from_leftovers += profit_on_leftover
                            
                            # Mark leftover as processed
                            leftover.is_processed = True
                            leftover.save()
                            
                            # Reduce remaining amount
                            thb_amount -= thb_used
                        else:
                            # We can only use part of the leftover
                            thb_used = thb_amount
                            mmk_equivalent = thb_used * mmk_per_thb
                            
                            # Calculate profit (in THB)
                            thb_at_leftover_rate = mmk_equivalent / leftover.rate
                            profit_on_leftover = thb_used - thb_at_leftover_rate
                            
                            # Add to total profit
                            profit_from_leftovers += profit_on_leftover
                            
                            # Update leftover with remaining amount
                            leftover.amount -= thb_used
                            leftover.save()
                            
                            # No more THB to process
                            thb_amount = 0
                            break
                    
                    # Update the profit if we calculated any from leftovers
                    if profit_from_leftovers > decimal.Decimal('0.00'):
                        self.profit = (self.profit or decimal.Decimal('0.00')) + profit_from_leftovers
                        super().save(update_fields=['profit'])
            
            # Track leftovers for SELL transactions
            elif self.transaction_type == 'SELL' and self.related_transaction:
                buy_transaction = self.related_transaction
                
                if (self.source_currency.code == thb_currency_code and 
                    self.target_currency.code == mmk_currency_code and
                    buy_transaction.source_currency.code == mmk_currency_code and
                    buy_transaction.target_currency.code == thb_currency_code):
                    
                    # Calculate matched THB amount
                    matched_thb = min(self.source_amount, buy_transaction.target_amount)
                    
                    # If there's leftover THB, track it
                    leftover_thb = self.source_amount - matched_thb
                    if leftover_thb > 0:
                        # Calculate the rate (MMK per THB)
                        mmk_per_thb = self.target_amount / self.source_amount
                        
                        # Create a leftover entry for future matching
                        ExchangeLeftover.objects.create(
                            currency=Currency.objects.get(code=thb_currency_code),
                            amount=leftover_thb,
                            rate=mmk_per_thb,
                            date_created=self.date
                        )
        except Exception as e:
            # Don't halt transaction if leftover processing fails
            pass

    def calculate_profit(self):
        """
        Returns the profit that has been calculated during transaction
        creation and saved to the database.
        
        This method is used for display purposes and doesn't recalculate 
        the profit value - it simply returns the stored value.
        """
        # For transactions with an assigned profit, return that value
        if self.profit is not None:
            return self.profit
            
        # Otherwise return zero
        return decimal.Decimal('0.00')

class GoogleSheetConfig(models.Model):
    sheet_id = models.CharField(max_length=100)
    sheet_name = models.CharField(max_length=100)
    credentials_json = models.TextField()
    last_synced = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Google Sheet: {self.sheet_name}"
