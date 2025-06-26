from django.shortcuts import render
from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action, api_view
from django.db.models import Sum, F, Q, Avg, Count
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
import json
import logging
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from .models import Transaction, BankAccount, DailyBalance, DailyExchangeRate, DailyProfit, Expense, ExpenseType
# Remove dependency on api.models - we'll handle currencies directly in this app
# from api.models import Currency
from .serializers import (
    TransactionSerializer, BankAccountSerializer, 
    DailyBalanceSerializer, DailyBalanceSummarySerializer,
    DailyExchangeRateSerializer, DailyProfitSerializer,
    ExpenseSerializer, ExpenseTypeSerializer
)
import csv
from django.http import HttpResponse

# Configure logger
logger = logging.getLogger(__name__)

# Add proper documentation for security implications
# This endpoint returns a list of supported currencies
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def currencies_list(request):
    # Return a list of supported currencies
    currencies = [
        {"id": 1, "code": "THB", "name": "Thai Baht"},
        {"id": 2, "code": "MMK", "name": "Myanmar Kyat"}
    ]
    return Response(currencies)

class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all().order_by('-date_time')
    serializer_class = TransactionSerializer
    permission_classes = [permissions.AllowAny]  # Allow unauthenticated access
    
    @action(detail=False, methods=['get'])
    def currencies(self, request):
        # Return a list of supported currencies
        currencies = [
            {"id": 1, "code": "THB", "name": "Thai Baht"},
            {"id": 2, "code": "MMK", "name": "Myanmar Kyat"}
        ]
        return Response(currencies)
    
    @action(detail=False, methods=['get', 'post'])
    def calculate_profits(self, request):
        """
        Calculate profits by matching buy and sell transactions
        """
        # Call the standalone calculate_profits function to ensure consistent calculation
        return calculate_profits(request)
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Get dashboard data including profits and stats
        """
        # Call the standalone dashboard function to ensure consistent calculation
        return dashboard(request)

    @action(detail=False, methods=['GET'])
    def stats(self, request):
        # Get today's date range
        today = timezone.now()
        today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Calculate statistics
        total_transactions = Transaction.objects.count()
        today_transactions = Transaction.objects.filter(
            date_time__gte=today_start
        ).count()

        # Calculate volumes
        buy_transactions = Transaction.objects.filter(transaction_type='BUY')
        sell_transactions = Transaction.objects.filter(transaction_type='SELL')
        
        total_buy_volume = buy_transactions.aggregate(
            total=Sum('thb_amount')
        )['total'] or 0
        
        total_sell_volume = sell_transactions.aggregate(
            total=Sum('thb_amount')
        )['total'] or 0

        # Calculate average rate
        average_rate = Transaction.objects.aggregate(
            avg_rate=Avg('rate')
        )['avg_rate'] or 0

        # Calculate profits
        total_profit = Transaction.objects.aggregate(
            total=Sum('profit')
        )['total'] or 0
        
        today_profit = Transaction.objects.filter(
            date_time__gte=today_start
        ).aggregate(
            total=Sum('profit')
        )['total'] or 0

        return Response({
            'totalTransactions': total_transactions,
            'todayTransactions': today_transactions,
            'totalBuyVolume': float(total_buy_volume),
            'totalSellVolume': float(total_sell_volume),
            'averageRate': float(average_rate),
            'totalProfit': float(total_profit),
            'todayProfit': float(today_profit),
        })

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        # Handle custom datetime if provided
        if 'created_at' in data and data['created_at']:
            try:
                # Parse the ISO datetime string using Django's built-in parsing
                from django.utils.dateparse import parse_datetime
                from django.utils import timezone as django_timezone
                import datetime
                
                # Try Django's parse_datetime first (handles ISO format)
                custom_datetime = parse_datetime(data['created_at'])
                
                if custom_datetime is None:
                    # If Django's parser fails, try manual parsing for common formats
                    try:
                        # Handle format like "2025-06-15T12:30:52+07:00"
                        if '+' in data['created_at'] or data['created_at'].endswith('Z'):
                            # This is an ISO format with timezone
                            custom_datetime = datetime.datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
                        else:
                            # This might be a naive datetime
                            custom_datetime = datetime.datetime.fromisoformat(data['created_at'])
                    except ValueError:
                        raise ValueError(f"Unable to parse datetime format: {data['created_at']}")
                
                # Ensure the datetime is timezone-aware
                if custom_datetime.tzinfo is None:
                    # If naive, assume it's in the local timezone
                    custom_datetime = django_timezone.make_aware(custom_datetime)
                else:
                    # If already timezone-aware, convert to Django's default timezone
                    custom_datetime = django_timezone.localtime(custom_datetime)
                
                # Set the date_time field (this is the field name in the model)
                data['date_time'] = custom_datetime
                # Remove created_at as it's not a model field
                del data['created_at']
            except Exception as datetime_error:
                return Response(
                    {'detail': f'Invalid datetime format: {str(datetime_error)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # For OTHER type, set profit directly from thb_amount and validate required fields
        if data['transaction_type'] == 'OTHER':
            # Ensure profit is set correctly
            data['profit'] = data['thb_amount']
            
            # Validate required fields
            if 'customer' not in data or not data['customer']:
                return Response(
                    {'detail': 'Customer field is required for OTHER transactions'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if 'remarks' not in data or not data['remarks']:
                return Response(
                    {'detail': 'Remarks field is required for OTHER transactions'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if data['thb_amount'] <= 0:
                return Response(
                    {'detail': 'THB amount must be greater than zero for OTHER transactions'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create and save the transaction
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            transaction = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request, *args, **kwargs):
        # Get query parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        transaction_type = request.query_params.get('type')
        
        # Debug logging
        print(f"TransactionViewSet.list called with params: {dict(request.query_params)}")
        print(f"start_date: {start_date}, end_date: {end_date}, transaction_type: {transaction_type}")
        
        queryset = self.get_queryset()
        
        # Apply filters if provided
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d')
                queryset = queryset.filter(date_time__gte=start)
            except ValueError:
                pass
                
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d')
                end = end + timedelta(days=1)  # Include the entire end date
                queryset = queryset.filter(date_time__lt=end)
            except ValueError:
                pass
                
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type.upper())
        
        # Apply the filtered queryset to the instance
        self.queryset = queryset
        
        # Debug: print queryset count before pagination
        print(f"Filtered queryset count: {queryset.count()}")
        
        # Use the parent's list method to handle pagination
        response = super().list(request, *args, **kwargs)
        
        # Debug: print response data structure
        print(f"Response data type: {type(response.data)}")
        if hasattr(response.data, 'get'):
            print(f"Response has 'results': {'results' in response.data}")
            print(f"Response has 'count': {'count' in response.data}")
        
        return response

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def calculate_profits(request):
    """
    Calculate profits by matching buy and sell transactions in strict chronological order
    Returns detailed profit information including remaining transactions
    """
    from django.db import transaction

    try:
        print("Starting profit calculation...")
        
        # Use database transaction to ensure all updates are atomic
        with transaction.atomic():
            # Reset profit values for BUY/SELL transactions to zero first
            Transaction.objects.filter(transaction_type__in=['BUY', 'SELL']).update(profit=0)
            
            # Handle 'OTHER' profit transactions - these have direct profit values
            other_profits = Transaction.objects.filter(transaction_type='OTHER')
            other_profit_total = Decimal('0.00')
            
            print(f"Found {other_profits.count()} OTHER transactions")
            
            for tx in other_profits:
                try:
                    # Set the profit value (should be the same as thb_amount)
                    tx.profit = tx.thb_amount
                    tx.save(update_fields=['profit'])
                    other_profit_total += tx.profit
                except Exception as tx_error:
                    print(f"Error processing OTHER transaction {tx.id}: {str(tx_error)}")
            
            print(f"Total from 'OTHER' profit transactions: {other_profit_total}")
            
            # Get all BUY/SELL transactions ordered by date
            all_transactions = list(Transaction.objects.filter(
                transaction_type__in=['BUY', 'SELL']
            ).order_by('date_time'))
            
            print(f"Found {len(all_transactions)} BUY/SELL transactions for matching")
            
            total_profit_buysell = Decimal('0.00')
            profit_details = []
            
            # Track remaining amounts for each transaction
            remaining = {}
            for tx in all_transactions:
                try:
                    remaining[tx.id] = {
                        'mmk_remaining': tx.mmk_amount,
                        'transaction': tx,
                        'profit': Decimal('0.00'),
                        'fully_matched': False,  # Track if transaction is fully matched
                        'partially_matched': False,  # Track if transaction is partially matched
                        'matched_at_all': False  # Track if transaction has been matched at all
                    }
                except Exception as e:
                    print(f"Error processing transaction {tx.id}: {str(e)}")
                    # Skip this transaction but continue with others
            
            # Track remaining transactions
            remaining_buy = []
            remaining_sell = []
            
            # Queue for transactions with remaining amounts
            buy_queue = []
            sell_queue = []
            
            # Debug log
            print(f"Starting profit calculation with {len(all_transactions)} transactions")
            
            # Process transactions in strict chronological order
            for tx in all_transactions:
                try:
                    tx_type = tx.transaction_type
                    tx_mmk = tx.mmk_amount
                    tx_id = tx.id
                    
                    # Skip OTHER transactions - they're handled separately
                    if tx_type == 'OTHER':
                        continue
                    
                    if tx_type == 'BUY':
                        # Process any waiting SELL transactions first
                        while sell_queue and tx_mmk > 0:
                            try:
                                sell_id = sell_queue[0]
                                sell_tx = remaining[sell_id]['transaction']
                                sell_remaining = remaining[sell_id]['mmk_remaining']
                                
                                # Mark both transactions as having been matched
                                remaining[sell_id]['matched_at_all'] = True
                                remaining[tx_id]['matched_at_all'] = True
                                
                                # Match the amounts
                                match_amount = min(sell_remaining, tx_mmk)
                                
                                # Calculate profit from this match
                                buy_rate = tx.rate
                                sell_rate = sell_tx.rate
                                
                                # Profit = (matched_mmk / sell_rate) - (matched_mmk / buy_rate)
                                # Use high precision for calculation
                                match_amt_decimal = Decimal(str(match_amount))
                                buy_rate_decimal = Decimal(str(buy_rate))
                                sell_rate_decimal = Decimal(str(sell_rate))
                                
                                # Check for division by zero
                                if buy_rate_decimal == 0 or sell_rate_decimal == 0:
                                    print(f"Division by zero detected for match between BUY #{tx_id} and SELL #{sell_id}")
                                    # Skip this matching and try next
                                    sell_queue.pop(0)
                                    continue
                                
                                profit = (match_amt_decimal / sell_rate_decimal) - (match_amt_decimal / buy_rate_decimal)
                                # Round to 2 decimal places
                                profit = profit.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                                
                                total_profit_buysell += profit
                                remaining[tx_id]['partially_matched'] = True
                                
                                # Add detail record
                                profit_details.append({
                                    'buy_id': tx.id,
                                    'buy_date': tx.date_time.strftime('%Y-%m-%d %H:%M'),
                                    'buy_customer': tx.customer,
                                    'sell_id': sell_tx.id,
                                    'sell_date': sell_tx.date_time.strftime('%Y-%m-%d %H:%M'),
                                    'sell_customer': sell_tx.customer,
                                    'mmk_amount': float(match_amount),
                                    'thb_buy': float(match_amount / buy_rate),
                                    'thb_sell': float(match_amount / sell_rate),
                                    'profit': float(profit),
                                    'buy_rate': float(buy_rate),
                                    'sell_rate': float(sell_rate)
                                })
                                
                                # Update database profit values
                                if match_amount == sell_remaining:
                                    # SELL is fully matched, attribute profit to SELL
                                    sell_tx.profit += profit
                                    sell_tx.save(update_fields=['profit'])
                                    
                                    remaining[sell_id]['profit'] += profit
                                    remaining[sell_id]['fully_matched'] = True
                                    remaining[sell_id]['partially_matched'] = False
                                    
                                    # Remove from queue
                                    sell_queue.pop(0)
                                else:
                                    # BUY is fully matched, attribute profit to BUY
                                    tx.profit += profit
                                    tx.save(update_fields=['profit'])
                                    
                                    remaining[tx_id]['profit'] += profit
                                
                                # Update remaining amounts
                                remaining[sell_id]['mmk_remaining'] -= match_amount
                                tx_mmk -= match_amount
                            except Exception as e:
                                print(f"Error processing BUY-SELL match: {str(e)}")
                                # Skip to next in queue
                                if sell_queue:
                                    sell_queue.pop(0)
                        
                        # After processing all SELLs, check if there's remaining amount
                        if tx_mmk > 0:
                            remaining[tx_id]['mmk_remaining'] = tx_mmk
                            # Explicitly set partially_matched to true if this transaction has been matched at all
                            if remaining[tx_id]['matched_at_all']:
                                remaining[tx_id]['partially_matched'] = True
                            if tx_id not in buy_queue:
                                buy_queue.append(tx_id)
                        else:
                            remaining[tx_id]['fully_matched'] = True
                            remaining[tx_id]['partially_matched'] = False
                    
                    elif tx_type == 'SELL':
                        # Process any waiting BUY transactions first
                        # Similar try-except pattern for error handling...
                        while buy_queue and tx_mmk > 0:
                            try:
                                buy_id = buy_queue[0]
                                buy_tx = remaining[buy_id]['transaction']
                                buy_remaining = remaining[buy_id]['mmk_remaining']
                                
                                # Mark both transactions as having been matched
                                remaining[buy_id]['matched_at_all'] = True
                                remaining[tx_id]['matched_at_all'] = True
                                
                                # Match the amounts
                                match_amount = min(buy_remaining, tx_mmk)
                                
                                # Calculate profit from this match
                                buy_rate = buy_tx.rate
                                sell_rate = tx.rate
                                
                                # Profit = (matched_mmk / sell_rate) - (matched_mmk / buy_rate)
                                # Use high precision for calculation
                                match_amt_decimal = Decimal(str(match_amount))
                                buy_rate_decimal = Decimal(str(buy_rate))
                                sell_rate_decimal = Decimal(str(sell_rate))
                                
                                # Check for division by zero
                                if buy_rate_decimal == 0 or sell_rate_decimal == 0:
                                    print(f"Division by zero detected for match between SELL #{tx_id} and BUY #{buy_id}")
                                    # Skip this matching and try next
                                    buy_queue.pop(0)
                                    continue
                                
                                profit = (match_amt_decimal / sell_rate_decimal) - (match_amt_decimal / buy_rate_decimal)
                                # Round to 2 decimal places
                                profit = profit.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                                
                                total_profit_buysell += profit
                                remaining[tx_id]['partially_matched'] = True
                                
                                # Add detail record
                                profit_details.append({
                                    'buy_id': buy_tx.id,
                                    'buy_date': buy_tx.date_time.strftime('%Y-%m-%d %H:%M'),
                                    'buy_customer': buy_tx.customer,
                                    'sell_id': tx.id,
                                    'sell_date': tx.date_time.strftime('%Y-%m-%d %H:%M'),
                                    'sell_customer': tx.customer,
                                    'mmk_amount': float(match_amount),
                                    'thb_buy': float(match_amount / buy_rate),
                                    'thb_sell': float(match_amount / sell_rate),
                                    'profit': float(profit),
                                    'buy_rate': float(buy_rate),
                                    'sell_rate': float(sell_rate)
                                })
                                
                                # Update database profit values
                                if match_amount == buy_remaining:
                                    # BUY is fully matched, attribute profit to BUY
                                    buy_tx.profit += profit
                                    buy_tx.save(update_fields=['profit'])
                                    
                                    remaining[buy_id]['profit'] += profit
                                    remaining[buy_id]['fully_matched'] = True
                                    remaining[buy_id]['partially_matched'] = False
                                    
                                    # Remove from queue
                                    buy_queue.pop(0)
                                else:
                                    # SELL is fully matched, attribute profit to SELL
                                    tx.profit += profit
                                    tx.save(update_fields=['profit'])
                                    
                                    remaining[tx_id]['profit'] += profit
                                
                                # Update remaining amounts
                                remaining[buy_id]['mmk_remaining'] -= match_amount
                                tx_mmk -= match_amount
                            except Exception as e:
                                print(f"Error processing SELL-BUY match: {str(e)}")
                                # Skip to next in queue
                                if buy_queue:
                                    buy_queue.pop(0)
                        
                        # After processing all BUYS, check if there's remaining amount
                        if tx_mmk > 0:
                            remaining[tx_id]['mmk_remaining'] = tx_mmk
                            # Explicitly set partially_matched to true if this transaction has been matched at all
                            if remaining[tx_id]['matched_at_all']:
                                remaining[tx_id]['partially_matched'] = True
                            if tx_id not in sell_queue:
                                sell_queue.append(tx_id)
                        else:
                            remaining[tx_id]['fully_matched'] = True
                            remaining[tx_id]['partially_matched'] = False
                except Exception as inner_e:
                    print(f"Error processing transaction {tx.id}: {str(inner_e)}")
                    # Continue with next transaction
            
            print("Processing completed, saving results to database...")
            
            # Save profits to database
            for tx_id, data in remaining.items():
                try:
                    if data['profit'] > 0:
                        tx = data['transaction']
                        tx.profit = data['profit']
                        tx.save(update_fields=['profit'])
                        print(f"Saving profit {data['profit']} to transaction #{tx_id} ({tx.transaction_type})")
                except Exception as e:
                    print(f"Error saving profit for transaction {tx_id}: {str(e)}")
            
            print("Building remaining transactions lists...")
            
            # Build remaining transactions lists
            for tx_id, data in remaining.items():
                try:
                    tx = data['transaction']
                    remaining_amount = data['mmk_remaining']
                    
                    # IMPROVED LOGIC: Only include transactions in the remaining list if:
                    # 1. They have remaining MMK amounts > 0
                    # 2. They are not fully matched
                    # 3. IMPORTANT: Make sure each transaction only appears in the correct list (BUY or SELL)
                    if remaining_amount > 0 and not data['fully_matched']:
                        remaining_item = {
                            'id': tx.id,
                            'customer': tx.customer,
                            'date_time': tx.date_time,
                            'mmk_amount': float(remaining_amount),
                            'thb_amount': float(remaining_amount / tx.rate),
                            'rate': float(tx.rate),
                            'hundred_k_rate': float(tx.hundred_k_rate)
                        }
                        
                        # Ensure each transaction only gets added to one list based on its type
                        if tx.transaction_type == 'BUY':
                            remaining_buy.append(remaining_item)
                            print(f"Added BUY #{tx.id} to remaining list with {remaining_amount} MMK")
                        elif tx.transaction_type == 'SELL':
                            remaining_sell.append(remaining_item)
                            print(f"Added SELL #{tx.id} to remaining list with {remaining_amount} MMK")
                except Exception as e:
                    print(f"Error processing remaining transaction {tx_id}: {str(e)}")
            
            # VERIFICATION STEP: Check for duplicate transaction IDs across remaining buy/sell lists
            buy_ids = set(item['id'] for item in remaining_buy)
            sell_ids = set(item['id'] for item in remaining_sell)
            duplicate_ids = buy_ids.intersection(sell_ids)
            
            if duplicate_ids:
                print(f"Found {len(duplicate_ids)} transactions in both BUY and SELL remaining lists: {duplicate_ids}")
                # Remove duplicates - keep them in the list matching their transaction type
                for dup_id in duplicate_ids:
                    tx = Transaction.objects.get(id=dup_id)
                    if tx.transaction_type == 'BUY':
                        # Remove from SELL list
                        remaining_sell = [item for item in remaining_sell if item['id'] != dup_id]
                    else:
                        # Remove from BUY list
                        remaining_buy = [item for item in remaining_buy if item['id'] != dup_id]
                
                print("Duplicates removed from remaining lists")
            
            # Print summary
            print(f"Profit calculation complete. Total profit: {total_profit_buysell}")
            print(f"Remaining BUY transactions: {len(remaining_buy)}")
            print(f"Remaining SELL transactions: {len(remaining_sell)}")
        
        # Calculate total profit including OTHER transactions
        total_profit = total_profit_buysell + other_profit_total
        
        # Return results
        result = {
            'total_profit': float(total_profit),
            'transaction_count': Transaction.objects.count(),
            'profit_details': profit_details,
            'remaining_transactions': {
                'buy': remaining_buy,
                'sell': remaining_sell
            }
        }
        print("Returning calculation result")
        return Response(result)
        
    except Exception as e:
        import traceback
        print(f"Error in calculate_profits: {str(e)}")
        traceback.print_exc()
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def dashboard(request):
    try:
        # Get force_calculate param - when True, we'll calculate profits first
        force_calculate = request.query_params.get('force_calculate') == 'true'
        
        # Get date param if provided - filter dashboard data by this date
        date_param = request.query_params.get('date')
        
        # Parse the date parameter if provided
        if date_param:
            try:
                selected_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                print(f"Dashboard requested for specific date: {selected_date}")
            except ValueError:
                print(f"Invalid date format: {date_param}")
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Default to today if no date specified
            selected_date = timezone.now().date()
            print(f"Dashboard requested without date parameter, using today: {selected_date}")
        
        # Get remaining transactions data
        remaining_transactions = {'buy': [], 'sell': []}
        other_profit_total = Decimal('0.00')
        
        # Only calculate profits if explicitly requested
        if force_calculate:
            try:
                print("Force calculating profits for dashboard")
                profit_calculation_result = calculate_profits(request._request)
                
                # Extract data from the response if successful
                if hasattr(profit_calculation_result, 'data'):
                    profit_data = profit_calculation_result.data
                    remaining_transactions = profit_data.get('remaining_transactions', {'buy': [], 'sell': []})
            except Exception as calc_error:
                print(f"Error in profit calculation for dashboard: {calc_error}")
                # Continue even if profit calculation fails
        else:
            # Try to get the most recent remaining transactions by querying for unmatched txns
            print("Using existing profit data for dashboard (skipping calculation)")
            
            # Handle 'OTHER' profit transactions for profit calculations
            other_profits = Transaction.objects.filter(transaction_type='OTHER')
            for tx in other_profits:
                other_profit_total += tx.thb_amount
                
        # Get total transactions and amount
        total_transactions = Transaction.objects.count()
        total_amount = Transaction.objects.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0

        # Get today's date range - if date parameter provided, use that date instead
        if date_param:
            day = selected_date
        else:
            day = timezone.now().date()
            
        # Get day start/end for filtering
        day_start = timezone.datetime.combine(day, timezone.datetime.min.time())
        day_end = timezone.datetime.combine(day, timezone.datetime.max.time())

        # Get selected day's transactions
        day_transactions = Transaction.objects.filter(date_time__gte=day_start, date_time__lte=day_end)
        day_count = day_transactions.count()
        day_amount = day_transactions.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0

        # Calculate total profit (all time)
        total_profit = Transaction.objects.aggregate(Sum('profit'))
        total_profit_thb = total_profit['profit__sum'] if total_profit['profit__sum'] is not None else 0
        
        # Calculate selected day's profit
        day_profit = day_transactions.aggregate(Sum('profit'))
        day_profit_thb = day_profit['profit__sum'] if day_profit['profit__sum'] is not None else 0
        
        # Calculate this month's profit
        month_start = day.replace(day=1)
        month_profit = Transaction.objects.filter(
            date_time__date__gte=month_start,
            date_time__date__lte=day
        ).aggregate(Sum('profit'))
        month_profit_thb = month_profit['profit__sum'] if month_profit['profit__sum'] is not None else 0
        
        # Get daily summary - if specific date requested, show that date plus surrounding dates
        # otherwise show last 30 days
        if date_param:
            # Show the selected date plus 3 days before and after (7 days total)
            start_date = day - timedelta(days=3)
            end_date = day + timedelta(days=3)
        else:
            # Default to last 30 days
            end_date = day
            start_date = end_date - timedelta(days=29)
            
        daily_data = []
        
        # Get data for each day in the range
        current_date = start_date
        while current_date <= end_date:
            day_txns = Transaction.objects.filter(
                date_time__date=current_date
            )
            
            thb_volume = day_txns.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0
            mmk_volume = day_txns.aggregate(Sum('mmk_amount'))['mmk_amount__sum'] or 0
            profit = day_txns.aggregate(Sum('profit'))['profit__sum'] or 0
            count = day_txns.count()
            
            if count > 0:
                daily_data.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'thb_volume': float(thb_volume),
                    'mmk_volume': float(mmk_volume),
                    'profit': float(profit),
                    'transaction_count': count
                })
                
            current_date += timedelta(days=1)

        # Print debug info for profit values
        print(f"Dashboard profit values - Total: {total_profit_thb}, Selected day: {day_profit_thb}, Month: {month_profit_thb}")
        print(f"Including 'OTHER' profit contribution: {other_profit_total}")
        
        # Return the data with remaining_transactions included
        return Response({
            'total_transactions': total_transactions,
            'total_amount': float(total_amount),
            'today_transactions': day_count,
            'today_amount': float(day_amount),
            'total_profit_thb': float(total_profit_thb),
            'today_profit_thb': float(day_profit_thb),
            'month_profit_thb': float(month_profit_thb),
            'other_profit_total': float(other_profit_total),
            'selected_date': day.strftime('%Y-%m-%d'),
            'daily_summary': daily_data,
            'remaining_transactions': remaining_transactions
        })
    except Exception as e:
        print(f"Dashboard error: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def create_transaction(request):
    """
    Create a new transaction with proper decimal handling and custom datetime support
    """
    try:
        # Write to a file to verify this function is being called
        data = request.data.copy()
        
        # Handle custom datetime if provided
        if 'created_at' in data and data['created_at']:
            try:
                # Parse the ISO datetime string using Django's built-in parsing
                from django.utils.dateparse import parse_datetime
                from django.utils import timezone as django_timezone
                import datetime
                
                # Try Django's parse_datetime first (handles ISO format)
                custom_datetime = parse_datetime(data['created_at'])
                
                if custom_datetime is None:
                    # If Django's parser fails, try manual parsing for common formats
                    try:
                        # Handle format like "2025-06-15T12:30:52+07:00"
                        if '+' in data['created_at'] or data['created_at'].endswith('Z'):
                            # This is an ISO format with timezone
                            custom_datetime = datetime.datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
                        else:
                            # This might be a naive datetime
                            custom_datetime = datetime.datetime.fromisoformat(data['created_at'])
                    except ValueError:
                        raise ValueError(f"Unable to parse datetime format: {data['created_at']}")
                
                # Ensure the datetime is timezone-aware
                if custom_datetime.tzinfo is None:
                    # If naive, assume it's in the local timezone
                    custom_datetime = django_timezone.make_aware(custom_datetime)
                else:
                    # If already timezone-aware, convert to Django's default timezone
                    custom_datetime = django_timezone.localtime(custom_datetime)
                
                # Set the date_time field (this is the field name in the model)
                data['date_time'] = custom_datetime
                # Remove created_at as it's not a model field
                del data['created_at']
            except Exception as datetime_error:
                return Response(
                    {'detail': f'Invalid datetime format: {str(datetime_error)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        # If no custom datetime provided, Django will use the current time
        
        # Format profit to ensure it has exactly 2 decimal places
        if 'profit' in data:
            try:
                # Convert to Decimal for precise handling
                profit = Decimal(str(data['profit']))
                # Quantize to 2 decimal places
                profit = profit.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                data['profit'] = profit
            except (ValueError, InvalidOperation):
                return Response(
                    {"error": "Invalid profit value"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create and validate the transaction
        serializer = TransactionSerializer(data=data)
        if serializer.is_valid():
            transaction = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def export_transactions(request):
    """
    Export transactions as a CSV file
    """
    try:
        # Get query parameters
        period = request.query_params.get('period', 'all')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # Set up the queryset
        queryset = Transaction.objects.all().order_by('date_time')
        
        # Apply filters based on period
        today = timezone.now().date()
        if period == 'today':
            queryset = queryset.filter(date_time__date=today)
        elif period == 'week':
            week_start = today - timedelta(days=today.weekday())
            queryset = queryset.filter(date_time__date__gte=week_start)
        elif period == 'month':
            month_start = today.replace(day=1)
            queryset = queryset.filter(date_time__date__gte=month_start)
        
        # Apply custom date range if provided
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                queryset = queryset.filter(date_time__date__gte=start)
            except ValueError:
                pass
                
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                queryset = queryset.filter(date_time__date__lte=end)
            except ValueError:
                pass
        
        # Generate filename
        filename = f"money_exchange_transactions_{today.strftime('%Y-%m-%d')}.csv"
        
        # Create a response object with CSV content type
        response = HttpResponse(content_type='text/csv')
        
        # Set headers for file download - use stronger download forcing
        response['Content-Disposition'] = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'
        
        # Add CORS headers to ensure browser allows the download
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Content-Disposition'
        
        # Add cache control to prevent caching
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        
        # Create CSV writer
        writer = csv.writer(response)
        
        # Write CSV header
        writer.writerow([
            'ID', 'Transaction Type', 'Date & Time', 'Customer Name',
            'THB Amount', 'MMK Amount', 'Rate', '100K Rate', 'Profit', 'Remarks'
        ])
        
        # Write transaction data
        for transaction in queryset:
            # Calculate 100K rate correctly
            hundred_k_rate = 100000 / float(transaction.rate) if transaction.rate else 0
            
            writer.writerow([
                transaction.id,
                transaction.transaction_type,
                transaction.date_time.strftime('%Y-%m-%d %H:%M:%S'),
                transaction.customer,
                float(transaction.thb_amount),
                float(transaction.mmk_amount),
                float(transaction.rate),
                float(hundred_k_rate),
                float(transaction.profit or 0),
                transaction.remarks or ''  # Include remarks (empty string if None)
            ])
        
        print(f"Exporting {queryset.count()} transactions to CSV file: {filename}")
        return response
    except Exception as e:
        print(f"Error exporting transactions: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Simple error response
        return HttpResponse(
            f"Failed to export transactions: {str(e)}",
            content_type="text/plain",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

class BankAccountViewSet(viewsets.ModelViewSet):
    queryset = BankAccount.objects.all()
    serializer_class = BankAccountSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = BankAccount.objects.all()
        
        # Filter by currency if specified
        currency = self.request.query_params.get('currency')
        if currency:
            queryset = queryset.filter(currency=currency.upper())
        
        # Filter by active status
        active = self.request.query_params.get('active')
        if active is not None:
            is_active = active.lower() == 'true'
            queryset = queryset.filter(is_active=is_active)
        
        return queryset

class DailyBalanceViewSet(viewsets.ModelViewSet):
    queryset = DailyBalance.objects.all()
    serializer_class = DailyBalanceSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = DailyBalance.objects.all()
        
        # Filter by date if specified
        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                date = datetime.strptime(date_param, '%Y-%m-%d').date()
                queryset = queryset.filter(date=date)
            except ValueError:
                pass
        
        # Filter by bank account
        account_id = self.request.query_params.get('account_id')
        if account_id:
            queryset = queryset.filter(bank_account_id=account_id)
        
        # Filter by currency
        currency = self.request.query_params.get('currency')
        if currency:
            queryset = queryset.filter(bank_account__currency=currency.upper())
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """
        Get the latest balance entry for each bank account
        """
        # Get the latest date for which we have balance entries
        latest_entry = DailyBalance.objects.order_by('-date').first()
        
        if not latest_entry:
            return Response({
                'message': 'No balance entries found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        latest_date = latest_entry.date
        
        # Get all entries for the latest date
        latest_balances = DailyBalance.objects.filter(date=latest_date)
        serializer = self.get_serializer(latest_balances, many=True)
        
        return Response({
            'date': latest_date,
            'balances': serializer.data
        })
    
    @action(detail=False, methods=['post'])
    def batch_update(self, request):
        """
        Create or update multiple balance entries at once
        """
        date = request.data.get('date')
        balances = request.data.get('balances', [])
        
        if not date:
            return Response({
                'error': 'Date is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Invalid date format. Use YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        results = []
        
        for balance_data in balances:
            account_id = balance_data.get('bank_account')
            balance_amount = balance_data.get('balance')
            notes = balance_data.get('notes', '')
            
            if not account_id or balance_amount is None:
                results.append({
                    'status': 'error',
                    'error': 'Bank account ID and balance are required',
                    'data': balance_data
                })
                continue
            
            try:
                # Try to find existing entry for this account and date
                entry, created = DailyBalance.objects.update_or_create(
                    bank_account_id=account_id,
                    date=date_obj,
                    defaults={
                        'balance': Decimal(str(balance_amount)),
                        'notes': notes
                    }
                )
                
                serializer = self.get_serializer(entry)
                results.append({
                    'status': 'created' if created else 'updated',
                    'data': serializer.data
                })
            except Exception as e:
                results.append({
                    'status': 'error',
                    'error': str(e),
                    'data': balance_data
                })
        
        return Response({
            'date': date,
            'results': results
        })

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def balance_summary(request):
    """
    Get a summary of balances with conversion to THB
    """
    # Add logger for debugging intermittent issues
    print("Balance summary requested")
    
    try:
        # Get date from query params, default to today
        date_param = request.query_params.get('date')
        rate_param = request.query_params.get('rate')
        
        try:
            if date_param:
                date = datetime.strptime(date_param, '%Y-%m-%d').date()
            else:
                date = timezone.now().date()
                
            # Get or create the exchange rate for the specified date
            exchange_rate = None
            default_rate = Decimal('0.8')
            
            # If a rate parameter is provided, update the exchange rate for this date
            if rate_param:
                try:
                    rate_value = Decimal(str(rate_param))
                    
                    # Save the rate for this date
                    exchange_rate, created = DailyExchangeRate.objects.update_or_create(
                        date=date,
                        defaults={'rate': rate_value}
                    )
                    rate = rate_value
                except (ValueError, InvalidOperation, Exception) as e:
                    print(f"Error saving exchange rate: {str(e)}")
                    rate = default_rate
            else:
                # Try to get the saved rate for this date
                try:
                    exchange_rate = DailyExchangeRate.objects.get(date=date)
                    rate = exchange_rate.rate
                except DailyExchangeRate.DoesNotExist:
                    # No rate exists for this date yet, use default rate
                    rate = default_rate
                except Exception as e:
                    print(f"Error getting exchange rate: {str(e)}")
                    rate = default_rate
            
        except (ValueError, InvalidOperation, Exception) as e:
            print(f"Error processing date or rate parameters: {str(e)}")
            return Response({
                'error': 'Invalid date or rate format'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get balances for the specified date
        try:
            balances = DailyBalance.objects.filter(date=date)
            
            if not balances.exists():
                # If no balances for the specified date, find the closest date
                try:
                    closest_balance = DailyBalance.objects.filter(date__lte=date).order_by('-date').first()
                    
                    if not closest_balance:
                        return Response({
                            'error': 'No balance data found'
                        }, status=status.HTTP_404_NOT_FOUND)
                        
                    date = closest_balance.date
                    balances = DailyBalance.objects.filter(date=date)
                    
                    # Since we switched to a different date, check if we have a rate for this date
                    try:
                        exchange_rate = DailyExchangeRate.objects.get(date=date)
                        rate = exchange_rate.rate
                    except DailyExchangeRate.DoesNotExist:
                        # No saved rate for this date, use default
                        rate = default_rate
                    except Exception as e:
                        print(f"Error getting exchange rate for alternative date: {str(e)}")
                        rate = default_rate
                except Exception as e:
                    print(f"Error finding closest balance date: {str(e)}")
                    return Response({
                        'error': 'Error finding balance data'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            print(f"Error getting balances: {str(e)}")
            return Response({
                'error': 'Error retrieving balance data'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Calculate totals by currency - wrap in try/except to handle potential errors
        try:
            thb_total = Decimal('0')
            mmk_total = Decimal('0')
            
            # Get balances by currency
            thb_balances = balances.filter(bank_account__currency='THB')
            mmk_balances = balances.filter(bank_account__currency='MMK')
            
            # Calculate sums
            thb_sum = thb_balances.aggregate(total=Sum('balance'))
            mmk_sum = mmk_balances.aggregate(total=Sum('balance'))
            
            thb_total = thb_sum['total'] or Decimal('0')
            mmk_total = mmk_sum['total'] or Decimal('0')
            
            # Convert MMK to THB
            mmk_in_thb = Decimal('0')
            if rate > 0:
                mmk_in_thb = mmk_total / rate
            
            # Calculate grand total in THB
            grand_total_thb = thb_total + mmk_in_thb
        except Exception as e:
            print(f"Error calculating currency totals: {str(e)}")
            return Response({
                'error': 'Error calculating currency totals'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Calculate difference from previous day
        try:
            difference = Decimal('0')
            previous_day_total = None
            
            # Find the previous day that has balance data
            previous_day_balance = DailyBalance.objects.filter(date__lt=date).order_by('-date').first()
            
            if previous_day_balance:
                previous_day = previous_day_balance.date
                previous_balances = DailyBalance.objects.filter(date=previous_day)
                
                # Get the exchange rate for the previous day
                try:
                    previous_exchange_rate = DailyExchangeRate.objects.get(date=previous_day)
                    previous_rate = previous_exchange_rate.rate
                except DailyExchangeRate.DoesNotExist:
                    previous_rate = default_rate
                except Exception as e:
                    print(f"Error getting previous day exchange rate: {str(e)}")
                    previous_rate = default_rate
                
                # Calculate the previous day's totals
                prev_thb_balances = previous_balances.filter(bank_account__currency='THB')
                prev_mmk_balances = previous_balances.filter(bank_account__currency='MMK')
                
                prev_thb_sum = prev_thb_balances.aggregate(total=Sum('balance'))
                prev_mmk_sum = prev_mmk_balances.aggregate(total=Sum('balance'))
                
                prev_thb_total = prev_thb_sum['total'] or Decimal('0')
                prev_mmk_total = prev_mmk_sum['total'] or Decimal('0')
                
                # Convert previous day's MMK to THB using the rate from that day
                prev_mmk_in_thb = Decimal('0')
                if previous_rate > 0:
                    prev_mmk_in_thb = prev_mmk_total / previous_rate
                
                # Calculate previous day's grand total
                previous_day_total = prev_thb_total + prev_mmk_in_thb
                
                # Calculate difference
                difference = grand_total_thb - previous_day_total
        except Exception as e:
            print(f"Error calculating previous day comparison: {str(e)}")
            # Don't fail completely, just skip the previous day comparison
            difference = Decimal('0')
            previous_day_total = None
        
        # Prepare the response
        try:
            summary = {
                'date': date,
                'thb_total': float(thb_total),
                'mmk_total': float(mmk_total),
                'mmk_in_thb': float(mmk_in_thb),
                'grand_total_thb': float(grand_total_thb),
                'rate': float(rate),
                'thb_accounts': [],
                'mmk_accounts': [],
                'previous_day_total': float(previous_day_total) if previous_day_total is not None else None,
                'difference': float(difference),
            }
            
            # Add detailed account balances
            for balance in thb_balances:
                try:
                    summary['thb_accounts'].append({
                        'id': balance.bank_account.id,
                        'name': balance.bank_account.name,
                        'balance': float(balance.balance),
                        'notes': balance.notes or ''
                    })
                except Exception as item_error:
                    print(f"Error processing THB account: {str(item_error)}")
                    # Skip this account but continue processing others
            
            for balance in mmk_balances:
                try:
                    summary['mmk_accounts'].append({
                        'id': balance.bank_account.id,
                        'name': balance.bank_account.name,
                        'balance': float(balance.balance),
                        'notes': balance.notes or ''
                    })
                except Exception as item_error:
                    print(f"Error processing MMK account: {str(item_error)}")
                    # Skip this account but continue processing others
            
            print(f"Balance summary generated successfully for date: {date}")
            return Response(summary)
        except Exception as e:
            print(f"Error preparing response data: {str(e)}")
            return Response({
                'error': 'Error preparing balance summary'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        # Catch-all for any other unexpected errors
        print(f"Unexpected error in balance_summary: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': 'An unexpected error occurred'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def export_balances(request):
    """
    Export bank balances as a CSV file
    """
    try:
        # Get query parameters
        date_param = request.query_params.get('date')
        
        # Set default date if not provided
        if date_param:
            try:
                date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                date = timezone.now().date()
        else:
            date = timezone.now().date()
        
        # Get all bank accounts
        accounts = BankAccount.objects.filter(is_active=True).order_by('currency', 'name')
        
        # Get balances for the specified date
        balances = DailyBalance.objects.filter(date=date)
        
        # Create a mapping of account_id to balance
        balance_map = {b.bank_account_id: b for b in balances}
        
        # Generate filename
        filename = f"bank_balances_{date}.csv"
        
        # Create a response object with CSV content type
        response = HttpResponse(content_type='text/csv')
        
        # Set headers for file download - use stronger download forcing
        response['Content-Disposition'] = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'
        
        # Add CORS headers to ensure browser allows the download
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Content-Disposition'
        
        # Add cache control to prevent caching
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        
        # Create CSV writer
        writer = csv.writer(response)
        
        # Write CSV header
        writer.writerow([
            'Date', 'Currency', 'Bank Name', 'Balance', 'Notes'
        ])
        
        # Write THB accounts first
        thb_accounts = accounts.filter(currency='THB')
        for account in thb_accounts:
            balance = balance_map.get(account.id)
            writer.writerow([
                date,
                'THB',
                account.name,
                float(balance.balance) if balance else 0,
                balance.notes if balance and balance.notes else ''
            ])
        
        # Write MMK accounts
        mmk_accounts = accounts.filter(currency='MMK')
        for account in mmk_accounts:
            balance = balance_map.get(account.id)
            writer.writerow([
                date,
                'MMK',
                account.name,
                float(balance.balance) if balance else 0,
                balance.notes if balance and balance.notes else ''
            ])
        
        # Write summary row
        rate_param = request.query_params.get('rate', '0.8')
        try:
            rate = Decimal(str(rate_param))
        except InvalidOperation:
            rate = Decimal('0.8')
        
        # Calculate currency totals
        thb_total = sum(float(balance_map.get(a.id).balance) if balance_map.get(a.id) else 0 for a in thb_accounts)
        mmk_total = sum(float(balance_map.get(a.id).balance) if balance_map.get(a.id) else 0 for a in mmk_accounts)
        
        # Convert MMK to THB
        mmk_in_thb = mmk_total / float(rate) if float(rate) > 0 else 0
        grand_total_thb = thb_total + mmk_in_thb
        
        # Add summary rows
        writer.writerow([])
        writer.writerow(['Date', date, '', '', ''])
        writer.writerow(['THB Total', thb_total, '', '', ''])
        writer.writerow(['MMK Total', mmk_total, '', '', ''])
        writer.writerow(['Exchange Rate (MMK/THB)', float(rate), '', '', ''])
        writer.writerow(['MMK in THB', mmk_in_thb, '', '', ''])
        writer.writerow(['Grand Total (THB)', grand_total_thb, '', '', ''])
        
        print(f"Exporting bank balances for {date} to CSV file: {filename}")
        return response
    except Exception as e:
        print(f"Error exporting balances: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Simple error response
        return HttpResponse(
            f"Failed to export balances: {str(e)}",
            content_type="text/plain",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def list_transactions(request):
    # Get query parameters
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    transaction_type = request.query_params.get('type')
    show_all = request.query_params.get('show_all', 'false').lower() == 'true'
    search = request.query_params.get('search', '')
    
    # Pagination parameters
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 10))
    
    # Ordering parameters
    ordering = request.query_params.get('ordering', '-date_time')
    
    # Debug logging
    print(f"list_transactions called with params: {dict(request.query_params)}")
    print(f"start_date: {start_date}, end_date: {end_date}, transaction_type: {transaction_type}")
    print(f"show_all: {show_all}, search: {search}, page: {page}, page_size: {page_size}")
    
    # Initialize queryset with all transactions
    queryset = Transaction.objects.all()
    
    # Apply search filter if provided
    if search:
        queryset = queryset.filter(
            Q(customer__icontains=search) |
            Q(remarks__icontains=search)
        )
    
    # If show_all is True, we don't apply date filters but still apply other filters
    if not show_all:
        # Apply date filters only if not showing all
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d')
                queryset = queryset.filter(date_time__gte=start)
            except ValueError:
                return Response(
                    {"detail": "Invalid start_date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d')
                end = end + timedelta(days=1)  # Include the entire end date
                queryset = queryset.filter(date_time__lt=end)
            except ValueError:
                return Response(
                    {"detail": "Invalid end_date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # If neither start_date nor end_date is provided and not showing all, 
        # don't apply default date filter - let user see filtered results
        
    if transaction_type:
        # Validate transaction type
        valid_types = [t[0] for t in Transaction.TRANSACTION_TYPES]
        if transaction_type.upper() in valid_types:
            queryset = queryset.filter(transaction_type=transaction_type.upper())
        else:
            return Response(
                {"detail": f"Invalid transaction type. Must be one of {', '.join(valid_types)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Apply ordering
    try:
        queryset = queryset.order_by(ordering)
    except:
        # Default ordering if invalid ordering field provided
        queryset = queryset.order_by('-date_time')
    
    # Get total count before pagination
    total_count = queryset.count()
    
    # Apply pagination
    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    paginated_queryset = queryset[start_index:end_index]
    
    # Log the count of transactions being returned
    print(f"Total transactions: {total_count}, returning page {page} with {len(paginated_queryset)} transactions")
    
    # Serialize and return with pagination info
    serializer = TransactionSerializer(paginated_queryset, many=True)
    
    return Response({
        'results': serializer.data,
        'count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': (total_count + page_size - 1) // page_size,
        'has_next': end_index < total_count,
        'has_previous': page > 1
    })

class DailyExchangeRateViewSet(viewsets.ModelViewSet):
    queryset = DailyExchangeRate.objects.all()
    serializer_class = DailyExchangeRateSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = DailyExchangeRate.objects.all()
        
        # Filter by date if specified
        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                date = datetime.strptime(date_param, '%Y-%m-%d').date()
                queryset = queryset.filter(date=date)
            except ValueError:
                pass
                
        return queryset
    
    @action(detail=False, methods=['post'])
    def update_or_create(self, request):
        """
        Update an existing exchange rate or create a new one if it doesn't exist
        """
        date = request.data.get('date')
        rate = request.data.get('rate')
        
        if not date or rate is None:
            return Response({
                'error': 'Date and rate are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Parse date
            date_obj = datetime.strptime(date, '%Y-%m-%d').date()
            
            # Convert rate to Decimal
            rate_decimal = Decimal(str(rate))
            
            # Try to find existing rate for this date
            exchange_rate, created = DailyExchangeRate.objects.update_or_create(
                date=date_obj,
                defaults={'rate': rate_decimal}
            )
            
            serializer = self.get_serializer(exchange_rate)
            return Response(serializer.data)
        except (ValueError, InvalidOperation) as e:
            return Response({
                'error': f'Invalid date or rate format: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """
        Get the exchange rate for today or a specific date
        """
        date_param = request.query_params.get('date')
        
        try:
            if date_param:
                date = datetime.strptime(date_param, '%Y-%m-%d').date()
            else:
                date = timezone.now().date()
                
            # Try to get the exchange rate for this date
            try:
                exchange_rate = DailyExchangeRate.objects.get(date=date)
                serializer = self.get_serializer(exchange_rate)
                return Response(serializer.data)
            except DailyExchangeRate.DoesNotExist:
                # If no rate exists for this date, try to find the most recent one
                latest_rate = DailyExchangeRate.objects.filter(
                    date__lte=date
                ).order_by('-date').first()
                
                if latest_rate:
                    serializer = self.get_serializer(latest_rate)
                    return Response({
                        **serializer.data,
                        'note': f'Using rate from {latest_rate.date} as no rate exists for {date}'
                    })
                else:
                    # No existing rates at all, return default
                    return Response({
                        'date': date,
                        'rate': 0.8,
                        'note': 'Using default rate as no rates exist in system'
                    })
                    
        except ValueError:
            return Response({
                'error': 'Invalid date format. Use YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def last_transaction_time(request):
    """
    Return the timestamp of the most recent transaction
    """
    try:
        # Get the most recent transaction
        latest_transaction = Transaction.objects.all().order_by('-date_time').first()
        
        if latest_transaction:
            return Response({
                'last_transaction_time': latest_transaction.date_time.isoformat(),
                'transaction_id': latest_transaction.id
            })
        else:
            return Response({
                'last_transaction_time': None,
                'message': 'No transactions found'
            })
    except Exception as e:
        print(f"Error getting last transaction time: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def export_daily_summary(request):
    """
    Export daily summary data as a CSV file, similar to the dashboard's Recent Activity section
    """
    try:
        # Get query parameters
        period = request.query_params.get('period', 'all')
        date_param = request.query_params.get('date')
        
        # Set up the date range
        if date_param:
            try:
                selected_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            selected_date = timezone.now().date()
        
        # Determine date range based on period
        if period == 'month':
            # Get data for the month of the selected date
            start_date = selected_date.replace(day=1)
            if selected_date.month == 12:
                next_month = selected_date.replace(year=selected_date.year + 1, month=1, day=1)
            else:
                next_month = selected_date.replace(month=selected_date.month + 1, day=1)
            end_date = next_month - timedelta(days=1)
            filename = f"daily_summary_{start_date.strftime('%Y-%m')}.csv"
        else:
            # Get all data
            start_date = Transaction.objects.order_by('date_time').first()
            if start_date:
                start_date = start_date.date_time.date()
            else:
                start_date = selected_date  # Default to current date if no transactions
            end_date = selected_date
            filename = f"daily_summary_all_to_{selected_date.strftime('%Y-%m-%d')}.csv"
        
        print(f"Exporting daily summary from {start_date} to {end_date}")
        
        # Create a response object with CSV content type
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'
        
        # Add CORS headers
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Content-Disposition'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        
        # Create CSV writer
        writer = csv.writer(response)
        
        # Write CSV header (similar to the Recent Activity table)
        writer.writerow(['Date', 'Transactions', 'THB Volume', 'MMK Volume', 'Profit (THB)'])
        
        # Process each day in the range
        current_date = start_date
        daily_data = []
        
        while current_date <= end_date:
            day_txns = Transaction.objects.filter(date_time__date=current_date)
            
            if day_txns.exists():
                # Calculate daily summary data
                thb_volume = day_txns.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0
                mmk_volume = day_txns.aggregate(Sum('mmk_amount'))['mmk_amount__sum'] or 0
                profit = day_txns.aggregate(Sum('profit'))['profit__sum'] or 0
                count = day_txns.count()
                
                # Write data to CSV
                writer.writerow([
                    current_date.strftime('%Y-%m-%d'),
                    count,
                    float(thb_volume),
                    float(mmk_volume),
                    float(profit)
                ])
                
                # Store data for logging
                daily_data.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'transaction_count': count,
                    'thb_volume': float(thb_volume),
                    'mmk_volume': float(mmk_volume),
                    'profit': float(profit),
                })
            
            current_date += timedelta(days=1)
        
        print(f"Exported {len(daily_data)} days of daily summary data to CSV")
        return response
        
    except Exception as e:
        print(f"Error exporting daily summary: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return Response(
            {'error': f'Failed to export daily summary: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def calculate_daily_profits(request):
    """
    Calculate profits for a specific date using chronological matching within that date only
    No unmatched amounts or transactions are carried over from other days
    """
    from django.db import transaction as db_transaction
    
    try:
        # Get the date from query parameters or use today
        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            target_date = timezone.now().date()

        print(f"Calculating daily profits for date: {target_date}")

        # Use database transaction to ensure all updates are atomic
        with db_transaction.atomic():
            # Get all transactions for the specific date only
            day_transactions = Transaction.objects.filter(
                date_time__date=target_date
            ).order_by('date_time')

            print(f"Found {day_transactions.count()} transactions for {target_date}")

            # Reset profit values for this day's BUY/SELL transactions
            day_transactions.filter(transaction_type__in=['BUY', 'SELL']).update(profit=0)
            
            # Handle 'OTHER' profit transactions - these have direct profit values
            other_transactions = day_transactions.filter(transaction_type='OTHER')
            other_profit = Decimal('0.00')

            for tx in other_transactions:
                try:
                    # Set the profit value (should be the same as thb_amount)
                    tx.profit = tx.thb_amount
                    tx.save(update_fields=['profit'])
                    other_profit += tx.profit
                except Exception as tx_error:
                    print(f"Error processing OTHER transaction {tx.id}: {str(tx_error)}")
            
            print(f"Total from 'OTHER' profit transactions on {target_date}: {other_profit}")
            
            # Get BUY/SELL transactions for this date only
            buysell_transactions = list(day_transactions.filter(
                transaction_type__in=['BUY', 'SELL']
            ).order_by('date_time'))
            
            print(f"Found {len(buysell_transactions)} BUY/SELL transactions for matching on {target_date}")
            
            buy_sell_profit = Decimal('0.00')
            
            if not buysell_transactions:
                print(f"No BUY/SELL transactions found for {target_date}")
            else:
                # Track remaining amounts for each transaction
                remaining = {}
                for tx in buysell_transactions:
                    remaining[tx.id] = {
                        'mmk_remaining': tx.mmk_amount,
                        'transaction': tx,
                        'profit': Decimal('0.00')
                    }
                
                # Queue for transactions with remaining amounts
                buy_queue = []
                sell_queue = []
                
                # Process transactions in strict chronological order (same day only)
                for tx in buysell_transactions:
                    try:
                        tx_type = tx.transaction_type
                        tx_mmk = tx.mmk_amount
                        tx_id = tx.id
                        
                        if tx_type == 'BUY':
                            # Process any waiting SELL transactions first
                            while sell_queue and tx_mmk > 0:
                                try:
                                    sell_id = sell_queue[0]
                                    sell_tx = remaining[sell_id]['transaction']
                                    sell_remaining = remaining[sell_id]['mmk_remaining']
                                    
                                    # Match the amounts
                                    match_amount = min(sell_remaining, tx_mmk)
                                    
                                    # Calculate profit from this match
                                    buy_rate = tx.rate
                                    sell_rate = sell_tx.rate
                                    
                                    # Profit = (matched_mmk / sell_rate) - (matched_mmk / buy_rate)
                                    match_amt_decimal = Decimal(str(match_amount))
                                    buy_rate_decimal = Decimal(str(buy_rate))
                                    sell_rate_decimal = Decimal(str(sell_rate))
                                    
                                    # Check for division by zero
                                    if buy_rate_decimal == 0 or sell_rate_decimal == 0:
                                        print(f"Division by zero detected for match between BUY #{tx_id} and SELL #{sell_id}")
                                        sell_queue.pop(0)
                                        continue
                                    
                                    profit = (match_amt_decimal / sell_rate_decimal) - (match_amt_decimal / buy_rate_decimal)
                                    profit = profit.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                                    
                                    buy_sell_profit += profit
                                    
                                    print(f"Matched {match_amount} MMK: BUY #{tx_id} with SELL #{sell_id}, profit: {profit}")
                                    
                                    # Update database profit values
                                    if match_amount == sell_remaining:
                                        # SELL is fully matched, attribute profit to SELL
                                        sell_tx.profit += profit
                                        sell_tx.save(update_fields=['profit'])
                                        remaining[sell_id]['profit'] += profit
                                        sell_queue.pop(0)
                                    else:
                                        # BUY is fully matched, attribute profit to BUY
                                        tx.profit += profit
                                        tx.save(update_fields=['profit'])
                                        remaining[tx_id]['profit'] += profit
                                    
                                    # Update remaining amounts
                                    remaining[sell_id]['mmk_remaining'] -= match_amount
                                    tx_mmk -= match_amount
                                except Exception as e:
                                    print(f"Error processing BUY-SELL match: {str(e)}")
                                    if sell_queue:
                                        sell_queue.pop(0)
                            
                            # After processing all SELLs, check if there's remaining amount
                            if tx_mmk > 0:
                                remaining[tx_id]['mmk_remaining'] = tx_mmk
                                if tx_id not in buy_queue:
                                    buy_queue.append(tx_id)
                        
                        elif tx_type == 'SELL':
                            # Process any waiting BUY transactions first
                            while buy_queue and tx_mmk > 0:
                                try:
                                    buy_id = buy_queue[0]
                                    buy_tx = remaining[buy_id]['transaction']
                                    buy_remaining = remaining[buy_id]['mmk_remaining']
                                    
                                    # Match the amounts
                                    match_amount = min(buy_remaining, tx_mmk)
                                    
                                    # Calculate profit from this match
                                    buy_rate = buy_tx.rate
                                    sell_rate = tx.rate
                                    
                                    match_amt_decimal = Decimal(str(match_amount))
                                    buy_rate_decimal = Decimal(str(buy_rate))
                                    sell_rate_decimal = Decimal(str(sell_rate))
                                    
                                    if buy_rate_decimal == 0 or sell_rate_decimal == 0:
                                        print(f"Division by zero detected for match between BUY #{buy_id} and SELL #{tx_id}")
                                        buy_queue.pop(0)
                                        continue
                                    
                                    profit = (match_amt_decimal / sell_rate_decimal) - (match_amt_decimal / buy_rate_decimal)
                                    profit = profit.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                                    
                                    buy_sell_profit += profit
                                    
                                    print(f"Matched {match_amount} MMK: BUY #{buy_id} with SELL #{tx_id}, profit: {profit}")
                                    
                                    # Update database profit values
                                    if match_amount == buy_remaining:
                                        # BUY is fully matched, attribute profit to BUY
                                        buy_tx.profit += profit
                                        buy_tx.save(update_fields=['profit'])
                                        remaining[buy_id]['profit'] += profit
                                        buy_queue.pop(0)
                                    else:
                                        # SELL is fully matched, attribute profit to SELL
                                        tx.profit += profit
                                        tx.save(update_fields=['profit'])
                                        remaining[tx_id]['profit'] += profit
                                    
                                    # Update remaining amounts
                                    remaining[buy_id]['mmk_remaining'] -= match_amount
                                    tx_mmk -= match_amount
                                except Exception as e:
                                    print(f"Error processing SELL-BUY match: {str(e)}")
                                    if buy_queue:
                                        buy_queue.pop(0)
                            
                            # After processing all BUYs, check if there's remaining amount
                            if tx_mmk > 0:
                                remaining[tx_id]['mmk_remaining'] = tx_mmk
                                if tx_id not in sell_queue:
                                    sell_queue.append(tx_id)
                    
                    except Exception as e:
                        print(f"Error processing transaction {tx.id}: {str(e)}")
                        continue

            print(f"Daily profit calculation complete for {target_date}")
            print(f"Buy/Sell profit: {buy_sell_profit}, Other profit: {other_profit}")

        # Create or update DailyProfit record
        try:
            daily_profit, created = DailyProfit.objects.update_or_create(
                date=target_date,
                defaults={
                    'buy_sell_profit': buy_sell_profit,
                    'other_profit': other_profit,
                    'total_profit': buy_sell_profit + other_profit
                }
            )
            
            print(f"Daily profit for {target_date}: buy/sell={buy_sell_profit}, other={other_profit}, total={buy_sell_profit + other_profit}")
            
            serializer = DailyProfitSerializer(daily_profit)
            return Response(serializer.data)
        except Exception as db_error:
            print(f"Database error when saving daily profit: {str(db_error)}")
            return Response({
                'date': target_date.strftime('%Y-%m-%d'),
                'buy_sell_profit': float(buy_sell_profit),
                'other_profit': float(other_profit),
                'total_profit': float(buy_sell_profit + other_profit)
            })

    except Exception as e:
        print(f"Error calculating daily profits: {str(e)}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

class DailyProfitViewSet(viewsets.ModelViewSet):
    queryset = DailyProfit.objects.all()
    serializer_class = DailyProfitSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def calculate(self, request):
        """
        Calculate profits for a specific date or today if no date provided
        """
        return calculate_daily_profits(request._request)  # Use the original Django request

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all().order_by('-date', '-created_at')
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.AllowAny]
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']

    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.AllowAny]
        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        print(f"Received expense creation request with data: {request.data}")
        try:
            # Validate required fields
            required_fields = ['expense_type', 'amount', 'description', 'date']
            missing_fields = [field for field in required_fields if not request.data.get(field)]
            if missing_fields:
                return Response(
                    {"error": f"Missing required fields: {', '.join(missing_fields)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate amount is a positive number
            try:
                amount = float(request.data.get('amount', 0))
                if amount <= 0:
                    return Response(
                        {"error": "Amount must be greater than 0"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                return Response(
                    {"error": "Invalid amount value"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                print(f"Expense validation errors: {serializer.errors}")
                return Response(
                    {"error": "Validation failed", "details": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            self.perform_create(serializer)
            print(f"Successfully created expense: {serializer.data}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(f"Failed to create expense: {str(e)}")
            return Response(
                {"error": f"Failed to create expense: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    def list(self, request, *args, **kwargs):
        print("Received GET request for expenses list")
        try:
            # Get query parameters
            date = request.query_params.get('date')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')

            # Filter queryset based on date parameters
            queryset = self.queryset
            if date:
                queryset = queryset.filter(date=date)
            elif start_date and end_date:
                queryset = queryset.filter(date__range=[start_date, end_date])

            serializer = self.get_serializer(queryset, many=True)
            print(f"Successfully retrieved expenses: {len(serializer.data)} items")
            return Response(serializer.data)
        except Exception as e:
            print(f"Failed to list expenses: {str(e)}")
            return Response(
                {"error": f"Failed to list expenses: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

class ExpenseTypeViewSet(viewsets.ModelViewSet):
    queryset = ExpenseType.objects.filter(is_active=True)
    serializer_class = ExpenseTypeSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        print(f"Received expense type creation request with data: {request.data}")
        try:
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                print(f"Expense type validation errors: {serializer.errors}")
                return Response(
                    {"error": "Validation failed", "details": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            self.perform_create(serializer)
            print(f"Successfully created expense type: {serializer.data}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(f"Failed to create expense type: {str(e)}")
            return Response(
                {"error": f"Failed to create expense type: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            ) 