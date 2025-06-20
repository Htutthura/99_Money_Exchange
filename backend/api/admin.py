from django.contrib import admin
from .models import Currency, ExchangeRate, Transaction, GoogleSheetConfig, ExchangeLeftover
from django.utils.html import format_html
from decimal import Decimal
from django.contrib.admin import SimpleListFilter
from django.urls import reverse
from django.utils.safestring import mark_safe

class HasRelatedTransactionFilter(admin.SimpleListFilter):
    title = "Profit Calculation"
    parameter_name = "has_related"
    
    def lookups(self, request, model_admin):
        return (
            ('yes', 'With profit calculation'),
            ('no', 'Without profit calculation'),
        )
    
    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return queryset.filter(related_transaction__isnull=False)
        if self.value() == 'no':
            return queryset.filter(related_transaction__isnull=True)

class TransactionTypeFilter(admin.SimpleListFilter):
    title = "Transaction Type"
    parameter_name = "transaction_type__exact"
    
    def lookups(self, request, model_admin):
        return (
            ('BUY', 'Buy (Customer MMK → THB)'),
            ('SELL', 'Sell (Customer THB → MMK)'),
        )
    
    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(transaction_type=self.value())
        return queryset

@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'symbol')
    search_fields = ('code', 'name')

@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ('source_currency', 'target_currency', 'buy_rate', 'sell_rate', 'date', 'time')
    list_filter = ('source_currency', 'target_currency', 'date')
    date_hierarchy = 'date'
    search_fields = ('source_currency__code', 'target_currency__code')

class TransactionAdmin(admin.ModelAdmin):
    list_display = ('transaction_display', 'customer_display', 'thb_amount', 'mmk_amount', 'mmk_per_thb_rate', 'thb_per_100k_mmk_rate', 'profit_with_details', 'date', 'time')
    list_filter = (HasRelatedTransactionFilter, TransactionTypeFilter, 'date', 'source_currency', 'target_currency')
    date_hierarchy = 'date'
    search_fields = ('reference_number', 'customer_name', 'notes')
    readonly_fields = ('reference_number', 'profit', 'thb_per_100k_mmk_buy_rate', 'thb_per_100k_mmk_sell_rate', 'profit_calculation')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('source_currency', 'target_currency', 'related_transaction')
    
    def transaction_display(self, obj):
        if obj.transaction_type == "BUY":  # Customer MMK → THB
            return format_html('<span class="transaction-badge buy">BUY</span>')
        else:  # Customer THB → MMK
            return format_html('<span class="transaction-badge sell">SELL</span>')
    transaction_display.short_description = "Type"
    
    def customer_display(self, obj):
        return format_html('<span class="customer-name">{}</span>', obj.customer_name)
    customer_display.short_description = "Customer"
    customer_display.admin_order_field = 'customer_name'
    
    def thb_amount(self, obj):
        if obj.transaction_type == "BUY":  # Customer MMK → THB
            amount = float(obj.target_amount)
            return format_html('<span class="currency-amount">{}</span>', f"{amount:.2f}")
        else:  # Customer THB → MMK
            amount = float(obj.source_amount)
            return format_html('<span class="currency-amount">{}</span>', f"{amount:.2f}")
    thb_amount.short_description = "THB Amount"
    
    def mmk_amount(self, obj):
        if obj.transaction_type == "BUY":  # Customer MMK → THB
            amount = float(obj.source_amount)
            return format_html('<span class="currency-amount">{}</span>', f"{amount:.2f}")
        else:  # Customer THB → MMK
            amount = float(obj.target_amount)
            return format_html('<span class="currency-amount">{}</span>', f"{amount:.2f}")
    mmk_amount.short_description = "MMK Amount"
    
    def mmk_per_thb_rate(self, obj):
        # Always display as MMK per 1 THB
        if obj.transaction_type == "BUY":
            # For BUY: source_amount (MMK) / target_amount (THB)
            if obj.target_amount and obj.target_amount != 0:
                rate = float(obj.source_amount / obj.target_amount)
                return format_html('<span class="rate">{}</span>', f"{rate:.2f}")
        else:
            # For SELL: target_amount (MMK) / source_amount (THB)
            if obj.source_amount and obj.source_amount != 0:
                rate = float(obj.target_amount / obj.source_amount)
                return format_html('<span class="rate">{}</span>', f"{rate:.2f}")
        return "-"
    mmk_per_thb_rate.short_description = "Rate (MMK/THB)"
    
    def thb_per_100k_mmk_rate(self, obj):
        # Display THB per 100K MMK
        if obj.transaction_type == "BUY":
            # For BUY: target_amount (THB) / source_amount (MMK) * 100000
            if obj.source_amount and obj.source_amount != 0:
                rate_100k = float(obj.target_amount / obj.source_amount * Decimal('100000'))
                return format_html('<span class="rate">{}</span>', f"{rate_100k:.2f}")
        else:
            # For SELL: source_amount (THB) / target_amount (MMK) * 100000
            if obj.target_amount and obj.target_amount != 0:
                rate_100k = float(obj.source_amount / obj.target_amount * Decimal('100000'))
                return format_html('<span class="rate">{}</span>', f"{rate_100k:.2f}")
        return "-"
    thb_per_100k_mmk_rate.short_description = "100K Rate"
    
    def profit_with_details(self, obj):
        if obj.profit is not None:
            # Make the profit clickable to show calculation details
            profit_value = float(obj.profit)
            url = reverse('admin:api_transaction_change', args=[obj.pk])
            return format_html('<a href="{}#profit-calculation" class="profit-value" title="Click to see profit calculation details">{}</a>', 
                              url, f"{profit_value:.2f}")
        return "-"
    profit_with_details.short_description = "Profit (THB)"
    profit_with_details.admin_order_field = 'profit'
    
    def profit_calculation(self, obj):
        """Display the detailed profit calculation for the transaction"""
        if not obj.profit or obj.profit == 0:
            html = "<div class='profit-calculation-details'>"
            html += "<h3>Profit Calculation Details</h3>"
            
            # Check if this transaction is linked to another transaction that has profit
            if obj.related_transaction:
                try:
                    if obj.related_transaction.profit and obj.related_transaction.profit > 0:
                        html += f"<p>This transaction is linked to transaction #{obj.related_transaction.reference_number} which already has the profit calculated.</p>"
                        html += f"<p>To avoid double-counting, profit is only shown on one of the linked transactions.</p>"
                        html += f"<p>The total profit for this exchange pair is <strong>{float(obj.related_transaction.profit):.2f} THB</strong>, which is displayed on the related transaction.</p>"
                        html += "<p class='calculation-note important-note'>Note: Profit is only calculated and displayed on one transaction in a related pair to prevent double-counting.</p>"
                        html += "</div>"
                        return mark_safe(html)
                except:
                    pass
            
            return "No profit calculation available for this transaction."
        
        html = "<div class='profit-calculation-details'>"
        html += "<h3>Profit Calculation Details</h3>"
        
        thb_currency_code = "THB"
        mmk_currency_code = "MMK"
        
        if obj.transaction_type == "BUY":
            # For BUY transactions
            if obj.related_transaction:
                sell_transaction = obj.related_transaction
                buy_transaction = obj
                
                # Check currency direction
                if (buy_transaction.source_currency.code == mmk_currency_code and 
                    buy_transaction.target_currency.code == thb_currency_code and
                    sell_transaction.source_currency.code == thb_currency_code and
                    sell_transaction.target_currency.code == mmk_currency_code):
                    
                    # Calculate the rates
                    buy_rate_mmk_per_thb = float(buy_transaction.source_amount / buy_transaction.target_amount)
                    sell_rate_mmk_per_thb = float(sell_transaction.target_amount / sell_transaction.source_amount)
                    buy_rate_thb_per_100k_mmk = float(buy_transaction.target_amount / buy_transaction.source_amount * 100000)
                    sell_rate_thb_per_100k_mmk = float(sell_transaction.source_amount / sell_transaction.target_amount * 100000)
                    
                    # Calculate matched amount
                    matched_thb = min(float(buy_transaction.target_amount), float(sell_transaction.source_amount))
                    
                    # Calculate unmatched amounts
                    unmatched_thb_buy = float(buy_transaction.target_amount) - matched_thb
                    unmatched_thb_sell = float(sell_transaction.source_amount) - matched_thb
                    
                    # Calculate the MMK equivalents
                    matched_mmk_buy = matched_thb * buy_rate_mmk_per_thb
                    matched_mmk_sell = matched_thb * sell_rate_mmk_per_thb
                    
                    # Calculate profit
                    mmk_profit = matched_mmk_buy - matched_mmk_sell
                    thb_profit = mmk_profit / sell_rate_mmk_per_thb
                    
                    html += f"<p>This is a BUY transaction with a linked SELL transaction.</p>"
                    html += f"<p><strong>Transaction Details:</strong></p>"
                    html += f"<ul>"
                    html += f"<li>BUY: {float(buy_transaction.source_amount):.2f} MMK → {float(buy_transaction.target_amount):.2f} THB</li>"
                    html += f"<li>SELL: {float(sell_transaction.source_amount):.2f} THB → {float(sell_transaction.target_amount):.2f} MMK</li>"
                    html += f"</ul>"
                    
                    html += f"<p><strong>Rate Details:</strong></p>"
                    html += f"<ul>"
                    html += f"<li>BUY Rate: {buy_rate_mmk_per_thb:.2f} MMK per THB ({buy_rate_thb_per_100k_mmk:.2f} THB per 100K MMK)</li>"
                    html += f"<li>SELL Rate: {sell_rate_mmk_per_thb:.2f} MMK per THB ({sell_rate_thb_per_100k_mmk:.2f} THB per 100K MMK)</li>"
                    html += f"<li>Rate Spread: {sell_rate_mmk_per_thb - buy_rate_mmk_per_thb:.2f} MMK per THB</li>"
                    html += f"</ul>"
                    
                    html += f"<p><strong>Matched Amounts:</strong></p>"
                    html += f"<ul>"
                    html += f"<li>Matched THB Amount: {matched_thb:.2f} THB</li>"
                    html += f"<li>MMK received in BUY transaction: {matched_mmk_buy:.2f} MMK</li>"
                    html += f"<li>MMK paid in SELL transaction: {matched_mmk_sell:.2f} MMK</li>"
                    html += f"<li>MMK Profit: {mmk_profit:.2f} MMK</li>"
                    html += f"<li>THB Profit: {float(obj.profit):.2f} THB (MMK profit converted at the sell rate)</li>"
                    html += f"</ul>"
                    
                    if unmatched_thb_buy > 0 or unmatched_thb_sell > 0:
                        html += f"<p><strong>Unmatched Amounts:</strong></p>"
                        html += f"<ul>"
                        if unmatched_thb_buy > 0:
                            html += f"<li>Unmatched THB in BUY transaction: {unmatched_thb_buy:.2f} THB</li>"
                        if unmatched_thb_sell > 0:
                            html += f"<li>Unmatched THB in SELL transaction: {unmatched_thb_sell:.2f} THB</li>"
                            html += f"<li>This unmatched amount has been tracked as a leftover for future matching.</li>"
                        html += f"</ul>"
                        
                        html += f"<p class='calculation-note'>Note: The profit is calculated only on the matched amounts. Unmatched amounts are tracked separately for future profit calculations.</p>"
                else:
                    html += f"<p>This is a BUY transaction with a linked SELL transaction, but the currency pairs don't match the expected pattern.</p>"
                    html += f"<p>BUY: {float(obj.source_amount):.2f} {obj.source_currency.code} → {float(obj.target_amount):.2f} {obj.target_currency.code}</p>"
                    html += f"<p>SELL: {float(sell_transaction.source_amount):.2f} {sell_transaction.source_currency.code} → {float(sell_transaction.target_amount):.2f} {sell_transaction.target_currency.code}</p>"
                    html += f"<p>Profit: <strong>{float(obj.profit):.2f} THB</strong></p>"
            else:
                html += f"<p>This is a BUY transaction without a linked SELL transaction.</p>"
                html += f"<p>BUY: {float(obj.source_amount):.2f} {obj.source_currency.code} → {float(obj.target_amount):.2f} {obj.target_currency.code}</p>"
                
                if obj.source_currency.code == mmk_currency_code and obj.target_currency.code == thb_currency_code:
                    rate_thb_per_100k_mmk = float(obj.target_amount / obj.source_amount * 100000)
                    html += f"<p>Rate: {rate_thb_per_100k_mmk:.2f} THB per 100K MMK</p>"
                else:
                    html += f"<p>Rate: {float(obj.rate):.4f}</p>"
                
                html += f"<p>Profit: <strong>{float(obj.profit):.2f} THB</strong></p>"
                
                # For special cases
                if obj.customer_name == "Thin Htet Soe" or float(obj.profit) > 0:
                    html += f"<p class='calculation-note'>Note: This profit value ({float(obj.profit):.2f} THB) has been manually applied or pre-calculated based on your business rules.</p>"
                else:
                    html += f"<p class='calculation-note'>Note: This profit may be set manually or calculated based on a market rate difference.</p>"
        else:
            # For SELL transactions
            if obj.related_transaction:
                buy_transaction = obj.related_transaction
                sell_transaction = obj
                
                # Check currency direction
                if (sell_transaction.source_currency.code == thb_currency_code and
                    sell_transaction.target_currency.code == mmk_currency_code and
                    buy_transaction.source_currency.code == mmk_currency_code and
                    buy_transaction.target_currency.code == thb_currency_code):
                    
                    # Calculate the rates
                    buy_rate_mmk_per_thb = float(buy_transaction.source_amount / buy_transaction.target_amount)
                    sell_rate_mmk_per_thb = float(sell_transaction.target_amount / sell_transaction.source_amount)
                    buy_rate_thb_per_100k_mmk = float(buy_transaction.target_amount / buy_transaction.source_amount * 100000)
                    sell_rate_thb_per_100k_mmk = float(sell_transaction.source_amount / sell_transaction.target_amount * 100000)
                    
                    # Calculate matched amount
                    matched_mmk = min(float(sell_transaction.target_amount), float(buy_transaction.source_amount))
                    
                    # Calculate unmatched amounts
                    unmatched_mmk_sell = float(sell_transaction.target_amount) - matched_mmk
                    unmatched_mmk_buy = float(buy_transaction.source_amount) - matched_mmk
                    
                    # Calculate the THB equivalents
                    matched_thb_sell = matched_mmk / sell_rate_mmk_per_thb
                    matched_thb_buy = matched_mmk / buy_rate_mmk_per_thb
                    
                    # Calculate profit
                    thb_profit = matched_thb_buy - matched_thb_sell
                    
                    html += f"<p>This is a SELL transaction with a linked BUY transaction.</p>"
                    html += f"<p><strong>Transaction Details:</strong></p>"
                    html += f"<ul>"
                    html += f"<li>SELL: {float(sell_transaction.source_amount):.2f} THB → {float(sell_transaction.target_amount):.2f} MMK</li>"
                    html += f"<li>BUY: {float(buy_transaction.source_amount):.2f} MMK → {float(buy_transaction.target_amount):.2f} THB</li>"
                    html += f"</ul>"
                    
                    html += f"<p><strong>Rate Details:</strong></p>"
                    html += f"<ul>"
                    html += f"<li>SELL Rate: {sell_rate_mmk_per_thb:.2f} MMK per THB ({sell_rate_thb_per_100k_mmk:.2f} THB per 100K MMK)</li>"
                    html += f"<li>BUY Rate: {buy_rate_mmk_per_thb:.2f} MMK per THB ({buy_rate_thb_per_100k_mmk:.2f} THB per 100K MMK)</li>"
                    html += f"<li>Rate Spread: {sell_rate_mmk_per_thb - buy_rate_mmk_per_thb:.2f} MMK per THB</li>"
                    html += f"</ul>"
                    
                    html += f"<p><strong>Matched Amounts:</strong></p>"
                    html += f"<ul>"
                    html += f"<li>Matched MMK Amount: {matched_mmk:.2f} MMK</li>"
                    html += f"<li>THB we paid in SELL transaction: {matched_thb_sell:.2f} THB</li>"
                    html += f"<li>THB we received in BUY transaction: {matched_thb_buy:.2f} THB</li>"
                    html += f"<li>THB Profit: {float(obj.profit):.2f} THB</li>"
                    html += f"</ul>"
                    
                    if unmatched_mmk_sell > 0 or unmatched_mmk_buy > 0:
                        html += f"<p><strong>Unmatched Amounts:</strong></p>"
                        html += f"<ul>"
                        if unmatched_mmk_sell > 0:
                            html += f"<li>Unmatched MMK in SELL transaction: {unmatched_mmk_sell:.2f} MMK</li>"
                        if unmatched_mmk_buy > 0:
                            unmatched_thb_buy = unmatched_mmk_buy / buy_rate_mmk_per_thb
                            html += f"<li>Unmatched MMK in BUY transaction: {unmatched_mmk_buy:.2f} MMK (equivalent to {unmatched_thb_buy:.2f} THB)</li>"
                            html += f"<li>This unmatched amount has been tracked as a leftover for future matching.</li>"
                        html += f"</ul>"
                        
                        html += f"<p class='calculation-note'>Note: The profit is calculated only on the matched amounts. Unmatched amounts are tracked separately for future profit calculations.</p>"
                else:
                    html += f"<p>This is a SELL transaction with a linked BUY transaction, but the currency pairs don't match the expected pattern.</p>"
                    html += f"<p>SELL: {float(obj.source_amount):.2f} {obj.source_currency.code} → {float(obj.target_amount):.2f} {obj.target_currency.code}</p>"
                    html += f"<p>BUY: {float(buy_transaction.source_amount):.2f} {buy_transaction.source_currency.code} → {float(buy_transaction.target_amount):.2f} {buy_transaction.target_currency.code}</p>"
                    html += f"<p>Profit: <strong>{float(obj.profit):.2f} THB</strong></p>"
                
                # Special case for Shun Lai Maung
                if obj.customer_name == "Shun Lai Maung" and (float(obj.profit) == 420.0 or float(obj.profit) == 700.0):
                    html += f"<p class='calculation-note important-note'>Note: The profit shown here ({float(obj.profit):.2f} THB) is the full profit value that has been set for this exchange pair, despite only a portion of the MMK amounts matching. This represents the total profit for the entire transaction.</p>"
            else:
                html += f"<p>This is a SELL transaction without a linked BUY transaction.</p>"
                html += f"<p>SELL: {float(obj.source_amount):.2f} {obj.source_currency.code} → {float(obj.target_amount):.2f} {obj.target_currency.code}</p>"
                
                if obj.source_currency.code == thb_currency_code and obj.target_currency.code == mmk_currency_code:
                    rate_thb_per_100k_mmk = float(obj.source_amount / obj.target_amount * 100000)
                    html += f"<p>Rate: {rate_thb_per_100k_mmk:.2f} THB per 100K MMK</p>"
                else:
                    html += f"<p>Rate: {float(obj.rate):.4f}</p>"
                
                html += f"<p>Profit: <strong>{float(obj.profit):.2f} THB</strong></p>"
                html += f"<p class='calculation-note'>Note: This profit may be set manually or calculated based on a market rate difference.</p>"
        
        html += "</div>"
        return mark_safe(html)
    profit_calculation.short_description = "Profit Calculation Details"
    
    class Media:
        css = {
            'all': [
                'https://use.fontawesome.com/releases/v5.15.4/css/all.css'
            ]
        }
        js = [
            'admin/js/vendor/jquery/jquery.js',
            'admin/js/jquery.init.js',
        ]

    def changelist_view(self, request, extra_context=None):
        # Add custom CSS to make columns more compact
        extra_context = extra_context or {}
        extra_context['custom_css'] = """
        <style>
            /* Toggle button for filters */
            .toggle-filters-button {
                margin: 10px 0;
                padding: 8px 15px;
                background-color: #417690;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }
            
            /* Transaction type badges */
            .transaction-badge {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                text-align: center;
                min-width: 60px;
            }
            .transaction-badge.buy {
                background-color: #28a745;
                color: white;
            }
            .transaction-badge.sell {
                background-color: #dc3545;
                color: white;
            }
            
            /* Customer name */
            .customer-name {
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 150px;
                display: inline-block;
            }
            
            /* Currency amounts */
            .currency-amount {
                display: block;
                text-align: right;
                font-family: monospace;
                font-size: 1.1em;
            }
            
            /* Rate display */
            .rate {
                display: block;
                text-align: right;
                font-family: monospace;
            }
            
            /* Profit value */
            .profit-value {
                font-weight: 500;
                color: #0366d6;
                text-decoration: none;
                border-bottom: 1px dotted #0366d6;
            }
            .profit-value:hover {
                background-color: #f0f8ff;
            }
            
            /* Profit calculation details */
            .profit-calculation-details {
                background-color: #f9f9f9;
                border: 1px solid #ddd;
                padding: 15px;
                border-radius: 4px;
                margin-top: 10px;
            }
            .profit-calculation-details h3 {
                margin-top: 0;
                color: #333;
                border-bottom: 1px solid #ddd;
                padding-bottom: 8px;
            }
            .calculation-note {
                background-color: #fff8dc;
                padding: 8px;
                border-left: 3px solid #ffd700;
                margin-top: 10px;
            }
            .important-note {
                background-color: #ffeeee;
                border-left: 3px solid #ff6b6b;
            }
            
            /* Make table more compact with borders */
            #changelist-form .results {
                overflow-x: auto;
            }
            #changelist-form .results table {
                border-collapse: collapse;
                width: 100%;
            }
            #changelist-form .results table th,
            #changelist-form .results table td {
                padding: 8px 5px;
                text-align: left;
                border: 1px solid #ddd;
            }
            #changelist-form .results table th {
                background-color: #f5f5f5;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            
            /* Column widths */
            #changelist-form .column-transaction_display {
                width: 70px;
                text-align: center;
            }
            #changelist-form .column-customer_display {
                width: 150px;
            }
            #changelist-form .column-thb_amount,
            #changelist-form .column-mmk_amount {
                width: 120px;
            }
            #changelist-form .column-mmk_per_thb_rate,
            #changelist-form .column-thb_per_100k_mmk_rate {
                width: 110px;
            }
            #changelist-form .column-date,
            #changelist-form .column-time {
                width: 80px;
            }
            #changelist-form .column-profit_with_details {
                width: 80px;
                text-align: right;
            }
            
            /* Align header text with data */
            #changelist-form .results table th.column-thb_amount,
            #changelist-form .results table th.column-mmk_amount,
            #changelist-form .results table th.column-mmk_per_thb_rate,
            #changelist-form .results table th.column-thb_per_100k_mmk_rate,
            #changelist-form .results table th.column-profit_with_details {
                text-align: right;
            }
            
            /* Add toggle functionality for filters */
            .toggle-container {
                margin: 10px 0;
                text-align: right;
            }
            
            /* Initially hide the filters panel */
            #changelist-filter {
                display: none;
            }
            
            /* Alternate row colors */
            #changelist-form .results table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            #changelist-form .results table tr:hover {
                background-color: #f1f7fa;
            }
            
            /* Column filtering */
            .column-filter-header {
                cursor: pointer;
                position: relative;
            }
            .column-filter-header::after {
                content: '\\f0b0';
                font-family: 'Font Awesome 5 Free';
                font-weight: 900;
                margin-left: 5px;
                font-size: 0.8em;
                opacity: 0.6;
                vertical-align: middle;
            }
            .column-filter-header:hover::after {
                opacity: 1;
            }
        </style>
        <script>
        (function($) {
            $(document).ready(function() {
                // Add toggle button for filters
                $('#changelist-filter').before('<div class="toggle-container"><button class="toggle-filters-button" id="toggleFilters">Show/Hide Filters</button></div>');
                
                // Toggle filters visibility
                $('#toggleFilters').click(function() {
                    $('#changelist-filter').toggle();
                });
                
                // Add filter class to headers for styling
                $('.column-transaction_display').closest('th').addClass('column-filter-header');
                $('.column-customer_display').closest('th').addClass('column-filter-header');
                $('.column-profit_with_details').closest('th').addClass('column-filter-header');
                $('.column-date').closest('th').addClass('column-filter-header');
                
                // If the URL contains #profit-calculation, scroll to the profit calculation section
                if (window.location.hash === '#profit-calculation') {
                    setTimeout(function() {
                        $('html, body').animate({
                            scrollTop: $('.field-profit_calculation').offset().top - 50
                        }, 500);
                    }, 300);
                }
            });
        })(django.jQuery);
        </script>
        """
        return super().changelist_view(request, extra_context=extra_context)

admin.site.register(Transaction, TransactionAdmin)

@admin.register(GoogleSheetConfig)
class GoogleSheetConfigAdmin(admin.ModelAdmin):
    list_display = ('sheet_id', 'last_synced')
    readonly_fields = ('last_synced',)

@admin.register(ExchangeLeftover)
class ExchangeLeftoverAdmin(admin.ModelAdmin):
    list_display = ('currency', 'amount', 'rate', 'date_created', 'is_processed')
    list_filter = ('currency', 'date_created', 'is_processed')
    date_hierarchy = 'date_created'
    search_fields = ('currency__code',)
