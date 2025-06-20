from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny
from rest_framework.decorators import permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.decorators import permission_classes

class TransactionViewSet(viewsets.ModelViewSet):
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Get dashboard data including profits and stats
        """
        try:
            # First, calculate all profits to ensure they're up to date
            # This is important to ensure dashboard shows the same profit values as the Calculate Profit function
            try:
                calculate_profits(request)
            except Exception as calc_error:
                print(f"Error calculating profits for dashboard: {calc_error}")
                # Continue even if profit calculation fails

            # Get total transactions and amount
            total_transactions = Transaction.objects.count()
            total_amount = Transaction.objects.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0

            # Get today's date range
            today = timezone.now().date()
            today_start = timezone.datetime.combine(today, timezone.datetime.min.time())

            # Get today's transactions
            today_transactions = Transaction.objects.filter(date_time__date=today)
            today_count = today_transactions.count()
            today_amount = today_transactions.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0
            
            # Calculate total profit (all time) - include both BUY and SELL transactions
            # Since our profit calculation algorithm attributes profits to both types
            total_profit = Transaction.objects.aggregate(Sum('profit'))
            total_profit_thb = total_profit['profit__sum'] if total_profit['profit__sum'] is not None else 0
            
            # Calculate today's profit - include both BUY and SELL transactions
            today_profit = Transaction.objects.filter(
                date_time__date=today
            ).aggregate(Sum('profit'))
            today_profit_thb = today_profit['profit__sum'] if today_profit['profit__sum'] is not None else 0
            
            # Calculate this month's profit more reliably - include both BUY and SELL transactions
            month_start = today.replace(day=1)
            print(f"Calculating month profit from {month_start} to {today}")
            month_transactions = Transaction.objects.filter(
                date_time__date__gte=month_start,
                date_time__date__lte=today
            )
            # Use Decimal for more accurate calculations
            from decimal import Decimal
            month_profit_thb = Decimal('0.00')
            for tx in month_transactions:
                if tx.profit is not None:
                    month_profit_thb += tx.profit
            print(f"Month profit calculated: {month_profit_thb}")
            
            # Get daily summary for last 30 days
            thirty_days_ago = today - timedelta(days=30)
            daily_data = []
            
            for i in range(30):
                day = today - timedelta(days=i)
                day_transactions = Transaction.objects.filter(date_time__date=day)
                
                thb_volume = day_transactions.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0
                mmk_volume = day_transactions.aggregate(Sum('mmk_amount'))['mmk_amount__sum'] or 0
                # Include profits from all transactions, not just SELL
                profit = day_transactions.aggregate(Sum('profit'))['profit__sum'] or 0
                count = day_transactions.count()
                
                if count > 0:
                    daily_data.append({
                        'date': day.strftime('%Y-%m-%d'),
                        'thb_volume': float(thb_volume),
                        'mmk_volume': float(mmk_volume),
                        'profit': float(profit),
                        'transaction_count': count
                    })

            # Get remaining transactions by calling calculate_profits
            result = calculate_profits(request)
            remaining_transactions = None
            if hasattr(result, 'data') and 'remaining_transactions' in result.data:
                remaining_transactions = result.data['remaining_transactions']

            response_data = {
                'total_transactions': total_transactions,
                'total_amount': float(total_amount),
                'today_transactions': today_count,
                'today_amount': float(today_amount),
                'total_profit_thb': float(total_profit_thb),
                'today_profit_thb': float(today_profit_thb),
                'month_profit_thb': float(month_profit_thb),
                'daily_summary': daily_data
            }
            
            # Add remaining transactions if available
            if remaining_transactions:
                response_data['remaining_transactions'] = remaining_transactions
            
            return Response(response_data)
        except Exception as e:
            print(f"Error in dashboard: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard(request):
    try:
        # First, calculate all profits to ensure they're up to date
        # This is important to ensure dashboard shows the same profit values as the Calculate Profit function
        try:
            calculate_profits(request)
        except Exception as calc_error:
            print(f"Error calculating profits for dashboard: {calc_error}")
            # Continue even if profit calculation fails
            
        # Get total transactions and amount
        total_transactions = Transaction.objects.count()
        total_amount = Transaction.objects.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0

        # Get today's date range
        today = timezone.now().date()
        today_start = timezone.datetime.combine(today, timezone.datetime.min.time())

        # Get today's transactions
        today_transactions = Transaction.objects.filter(date_time__date=today)
        today_count = today_transactions.count()
        today_amount = today_transactions.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0
        
        # Calculate total profit (all time) - include both BUY and SELL transactions
        # Since our profit calculation algorithm attributes profits to both types
        total_profit = Transaction.objects.aggregate(Sum('profit'))
        total_profit_thb = total_profit['profit__sum'] if total_profit['profit__sum'] is not None else 0
        
        # Calculate today's profit - include both BUY and SELL transactions
        today_profit = Transaction.objects.filter(
            date_time__date=today
        ).aggregate(Sum('profit'))
        today_profit_thb = today_profit['profit__sum'] if today_profit['profit__sum'] is not None else 0
        
        # Calculate this month's profit more reliably - include both BUY and SELL transactions
        month_start = today.replace(day=1)
        print(f"Calculating month profit from {month_start} to {today}")
        month_transactions = Transaction.objects.filter(
            date_time__date__gte=month_start,
            date_time__date__lte=today
        )
        # Use Decimal for more accurate calculations
        from decimal import Decimal
        month_profit_thb = Decimal('0.00')
        for tx in month_transactions:
            if tx.profit is not None:
                month_profit_thb += tx.profit
        print(f"Month profit calculated: {month_profit_thb}")
        
        # Get daily summary for last 30 days
        thirty_days_ago = today - timedelta(days=30)
        daily_data = []
        
        for i in range(30):
            day = today - timedelta(days=i)
            day_transactions = Transaction.objects.filter(date_time__date=day)
            
            thb_volume = day_transactions.aggregate(Sum('thb_amount'))['thb_amount__sum'] or 0
            mmk_volume = day_transactions.aggregate(Sum('mmk_amount'))['mmk_amount__sum'] or 0
            # Include profits from all transactions, not just SELL
            profit = day_transactions.aggregate(Sum('profit'))['profit__sum'] or 0
            count = day_transactions.count()
            
            if count > 0:
                daily_data.append({
                    'date': day.strftime('%Y-%m-%d'),
                    'thb_volume': float(thb_volume),
                    'mmk_volume': float(mmk_volume),
                    'profit': float(profit),
                    'transaction_count': count
                })

        # Get remaining transactions data directly
        from copy import deepcopy
        result = calculate_profits(request)
        result_data = deepcopy(result.data) if hasattr(result, 'data') else None
        
        response_data = {
            'total_transactions': total_transactions,
            'total_amount': float(total_amount),
            'today_transactions': today_count,
            'today_amount': float(today_amount),
            'total_profit_thb': float(total_profit_thb),
            'today_profit_thb': float(today_profit_thb),
            'month_profit_thb': float(month_profit_thb),
            'daily_summary': daily_data
        }
        
        # Add remaining transactions if available
        if result_data and 'remaining_transactions' in result_data:
            response_data['remaining_transactions'] = result_data['remaining_transactions']
            
        return Response(response_data)
    except Exception as e:
        print(f"Error in dashboard: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 