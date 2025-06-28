from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from django.http import JsonResponse

# Direct endpoint for currencies
def simple_currencies(request):
    currencies = [
        {"id": 1, "code": "THB", "name": "Thai Baht"},
        {"id": 2, "code": "MMK", "name": "Myanmar Kyat"}
    ]
    return JsonResponse(currencies, safe=False)

# Create router for TransactionViewSet with base name 
router = DefaultRouter()
router.register(r'transactions', views.TransactionViewSet, basename='transaction')

# Create router for bank accounts and balances
bank_router = DefaultRouter()
bank_router.register(r'bank-accounts', views.BankAccountViewSet)
bank_router.register(r'daily-balances', views.DailyBalanceViewSet)
bank_router.register(r'exchange-rates', views.DailyExchangeRateViewSet)
bank_router.register(r'daily-profits', views.DailyProfitViewSet)

# Create router for expenses
expense_router = DefaultRouter()
expense_router.register(r'expenses', views.ExpenseViewSet, basename='expense')
expense_router.register(r'expense-types', views.ExpenseTypeViewSet, basename='expensetype')

urlpatterns = [
    # Currencies endpoint
    path('currencies/', views.currencies_list, name='currencies-simple'),
    
    # Add direct endpoints 
    path('calculate_profits/', views.calculate_profits, name='calculate-profits'),
    path('dashboard/', views.dashboard, name='dashboard'),
    
    # Add export endpoint
    path('export/', views.export_transactions, name='export-transactions'),
    
    # Add endpoint for exporting daily summary data
    path('export_daily_summary/', views.export_daily_summary, name='export-daily-summary'),
    
    # Add direct transaction creation endpoint with proper decimal handling
    path('create/', views.create_transaction, name='create-transaction'),
    
    # Add a direct list endpoint for transactions
    path('list/', views.list_transactions, name='list-transactions'),
    
    # Add endpoint to get the timestamp of the last transaction
    path('last_transaction_time/', views.last_transaction_time, name='last-transaction-time'),
    
    # Balance API endpoints
    path('balances/summary/', views.balance_summary, name='balance-summary'),
    path('balances/export/', views.export_balances, name='export-balances'),
    
    # Include bank account and balance router URLs
    path('', include(bank_router.urls)),
    
    # Include transaction router URLs for CRUD operations 
    path('', include(router.urls)),
    
    # Include expense router URLs
    path('', include(expense_router.urls)),
    
    # Add daily profits calculation endpoint
    path('daily-profits/calculate/', views.calculate_daily_profits, name='calculate-daily-profits'),
    
    # Add date range profits calculation endpoint
    path('daily-profits/calculate-range/', views.calculate_date_range_profits, name='calculate-date-range-profits'),
] 