from django.shortcuts import render, get_object_or_404
from django.db.models import Sum, Avg, Count, F, Q, Value, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from decimal import Decimal

from .models import Currency, ExchangeRate, Transaction, GoogleSheetConfig, ExchangeLeftover
from .serializers import (
    UserSerializer, CurrencySerializer, ExchangeRateSerializer,
    TransactionSerializer, GoogleSheetConfigSerializer,
    ExchangeLeftoverSerializer
)
from . import google_sheets_util

# Custom permission for admin-only access
class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_staff

class CurrencyViewSet(viewsets.ModelViewSet):
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer
    permission_classes = [IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']
    ordering = ['code']

class ExchangeRateViewSet(viewsets.ModelViewSet):
    queryset = ExchangeRate.objects.all()
    serializer_class = ExchangeRateSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['source_currency', 'target_currency', 'date']
    search_fields = ['source_currency__code', 'target_currency__code']
    ordering_fields = ['date', 'time', 'rate']
    ordering = ['-date', '-time']
    
    def perform_create(self, serializer):
        serializer.save(added_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get the latest exchange rates for all currency pairs"""
        # Get all unique currency pairs
        currency_pairs = ExchangeRate.objects.values('source_currency', 'target_currency').distinct()
        
        latest_rates = []
        # For each currency pair, get the latest exchange rate
        for pair in currency_pairs:
            rate = ExchangeRate.objects.filter(
                source_currency=pair['source_currency'],
                target_currency=pair['target_currency']
            ).order_by('-date', '-time').first()
            
            if rate:
                latest_rates.append(rate)
        
        serializer = self.get_serializer(latest_rates, many=True)
        return Response(serializer.data)

class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]  # Require authentication
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['transaction_type', 'source_currency', 'target_currency']
    search_fields = ['reference_number', 'customer_name', 'customer_id', 'notes']
    ordering_fields = ['date_time', 'source_amount', 'target_amount', 'profit']
    ordering = ['-date_time']
    
    def perform_create(self, serializer):
        # Save transaction with authenticated user context
        serializer.save()
    
    @action(detail=False, methods=['get'])
    def profits(self, request):
        try:
            # Get filter parameters
            start_date = request.query_params.get('start_date', None)
            end_date = request.query_params.get('end_date', None)
            
            # Filter transactions based on date range
            transactions = Transaction.objects.all()
            if start_date:
                transactions = transactions.filter(date_time__date__gte=start_date)
            if end_date:
                transactions = transactions.filter(date_time__date__lte=end_date)
                
            # Overall statistics
            total_profit = transactions.aggregate(Sum('profit'))['profit__sum'] or 0
            total_transactions = transactions.count()
            avg_profit_per_transaction = total_profit / total_transactions if total_transactions > 0 else 0
            
            response_data = {
                'total_profit': total_profit,
                'total_transactions': total_transactions,
                'avg_profit_per_transaction': avg_profit_per_transaction,
            }
            
            return Response(response_data)
        except Exception as e:
            return Response(
                {'status': 'error', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def calculate(self, request):
        try:
            # Your existing profit calculation logic here
            response_data = {
                'status': 'success',
                'message': 'Profits calculated successfully'
            }
            return Response(response_data)
        except Exception as e:
            return Response(
                {'status': 'error', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class GoogleSheetConfigViewSet(viewsets.ModelViewSet):
    queryset = GoogleSheetConfig.objects.all()
    serializer_class = GoogleSheetConfigSerializer
    permission_classes = [IsAdminUser]
    
    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        try:
            config = self.get_object()
            data_type = request.data.get('data_type', 'all')
            
            service = google_sheets_util.get_google_sheets_service(config.credentials_json)
            results = {}
            
            if data_type in ('all', 'currencies'):
                currency_results = google_sheets_util.import_currencies_from_sheet(
                    service, config.sheet_id
                )
                results['currencies'] = currency_results
            
            if data_type in ('all', 'exchange_rates'):
                rate_results = google_sheets_util.import_exchange_rates_from_sheet(
                    service, config.sheet_id, user=request.user
                )
                results['exchange_rates'] = rate_results
            
            if data_type in ('all', 'transactions'):
                transaction_results = google_sheets_util.import_transactions_from_sheet(
                    service, config.sheet_id, user=request.user
                )
                results['transactions'] = transaction_results
            
            config.last_synced = timezone.now()
            config.save()
            
            return Response({
                'status': 'Sync successful',
                'last_synced': config.last_synced,
                'results': results
            })
        except Exception as e:
            return Response(
                {'status': 'Sync failed', 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# Authentication views
class UserInfoView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class ExchangeLeftoverViewSet(viewsets.ModelViewSet):
    queryset = ExchangeLeftover.objects.all()
    serializer_class = ExchangeLeftoverSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['currency', 'date_created', 'is_processed']
    ordering_fields = ['date_created', 'amount']
    ordering = ['-date_created']
    
    @action(detail=False, methods=['get'])
    def unprocessed(self, request):
        """Return all unprocessed exchange leftovers"""
        unprocessed = ExchangeLeftover.objects.filter(is_processed=False)
        serializer = self.get_serializer(unprocessed, many=True)
        return Response(serializer.data)
        
    @action(detail=True, methods=['post'])
    def mark_processed(self, request, pk=None):
        """Mark a leftover as processed"""
        leftover = self.get_object()
        leftover.is_processed = True
        leftover.save()
        return Response({'status': 'leftover marked as processed'}, status=status.HTTP_200_OK)
