from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from . import views
from . import authentication

router = DefaultRouter()
router.register(r'currencies', views.CurrencyViewSet)
router.register(r'exchange-rates', views.ExchangeRateViewSet)
router.register(r'transactions', views.TransactionViewSet)
router.register(r'google-sheet-configs', views.GoogleSheetConfigViewSet)
router.register(r'exchange-leftovers', views.ExchangeLeftoverViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('user-info/', views.UserInfoView.as_view(), name='user-info'),
    path('api-token-auth/', obtain_auth_token, name='api-token-auth'),
    path('api-auth/', include('rest_framework.urls')),
    
    # Authentication endpoints
    path('auth/login/', authentication.LoginView.as_view(), name='auth-login'),
    path('auth/logout/', authentication.LogoutView.as_view(), name='auth-logout'),
    path('auth/profile/', authentication.UserProfileView.as_view(), name='auth-profile'),
    path('auth/register/', authentication.create_user, name='auth-register'),
    
    # Password management endpoints
    path('auth/change-password/', authentication.ChangePasswordView.as_view(), name='auth-change-password'),
    path('auth/forgot-password/', authentication.ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('auth/reset-password/', authentication.ResetPasswordView.as_view(), name='auth-reset-password'),
] 