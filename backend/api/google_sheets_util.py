import json
from datetime import datetime
import logging
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from django.conf import settings
from decimal import Decimal
from django.utils import timezone

from .models import Currency, ExchangeRate, Transaction

logger = logging.getLogger(__name__)

def get_google_sheets_service(credentials_json):
    """
    Create and return a Google Sheets API service instance
    """
    try:
        credentials_dict = json.loads(credentials_json)
        credentials = Credentials.from_service_account_info(
            credentials_dict,
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        service = build('sheets', 'v4', credentials=credentials)
        return service
    except Exception as e:
        logger.error(f"Error creating Google Sheets service: {str(e)}")
        raise

def import_currencies_from_sheet(service, sheet_id, range_name='Currencies!A2:C'):
    """
    Import currencies from Google Sheet
    Expects columns: Code, Name, Symbol
    """
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=range_name
        ).execute()
        
        values = result.get('values', [])
        
        created_count = 0
        updated_count = 0
        
        for row in values:
            if len(row) >= 3:
                code = row[0].strip().upper()
                name = row[1].strip()
                symbol = row[2].strip()
                
                currency, created = Currency.objects.update_or_create(
                    code=code,
                    defaults={
                        'name': name,
                        'symbol': symbol
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    updated_count += 1
        
        return {
            'created': created_count,
            'updated': updated_count,
            'total': len(values)
        }
    
    except HttpError as e:
        logger.error(f"Error importing currencies: {str(e)}")
        raise

def sync_exchange_rates(config, user=None):
    """
    Sync exchange rates from Google Sheet based on config
    """
    try:
        service = get_google_sheets_service(config.credentials_json)
        
        result = service.spreadsheets().values().get(
            spreadsheetId=config.sheet_id,
            range=config.exchange_rates_range
        ).execute()
        
        values = result.get('values', [])
        
        created_count = 0
        updated_count = 0
        
        for row in values:
            if len(row) >= 5:  # Date, Source Currency, Target Currency, Buy Rate, Sell Rate
                try:
                    date_str = row[0].strip()
                    source_code = row[1].strip().upper()
                    target_code = row[2].strip().upper()
                    buy_rate = Decimal(row[3].strip())
                    sell_rate = Decimal(row[4].strip())
                    
                    # Parse date
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                    except ValueError:
                        try:
                            date_obj = datetime.strptime(date_str, '%d/%m/%Y').date()
                        except ValueError:
                            raise ValueError(f"Invalid date format: {date_str}")
                    
                    # Get currencies
                    try:
                        source_currency = Currency.objects.get(code=source_code)
                        target_currency = Currency.objects.get(code=target_code)
                    except Currency.DoesNotExist:
                        raise ValueError(f"Currency not found: {source_code} or {target_code}")
                    
                    # Try to get time if available
                    time_obj = None
                    if len(row) >= 6 and row[5].strip():
                        try:
                            time_str = row[5].strip()
                            time_obj = datetime.strptime(time_str, '%H:%M:%S').time()
                        except ValueError:
                            try:
                                time_obj = datetime.strptime(time_str, '%H:%M').time()
                            except ValueError:
                                time_obj = timezone.now().time()
                    else:
                        time_obj = timezone.now().time()
                    
                    # Create or update exchange rate
                    defaults = {
                        'buy_rate': buy_rate,
                        'sell_rate': sell_rate,
                    }
                    
                    if user:
                        defaults['added_by'] = user
                    
                    rate_obj, created = ExchangeRate.objects.update_or_create(
                        source_currency=source_currency,
                        target_currency=target_currency,
                        date=date_obj,
                        time=time_obj,
                        defaults=defaults
                    )
                    
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                
                except Exception as e:
                    logger.error(f"Error processing exchange rate row: {str(e)}")
        
        return {
            'created': created_count,
            'updated': updated_count,
            'total': len(values)
        }
    
    except Exception as e:
        logger.error(f"Error syncing exchange rates: {str(e)}")
        raise

def sync_transactions(config, user=None):
    """
    Sync transactions from Google Sheet based on config
    """
    try:
        service = get_google_sheets_service(config.credentials_json)
        
        result = service.spreadsheets().values().get(
            spreadsheetId=config.sheet_id,
            range=config.transactions_range
        ).execute()
        
        values = result.get('values', [])
        
        created_count = 0
        updated_count = 0
        
        for row in values:
            if len(row) >= 8:  # Date, Type, Source Currency, Target Currency, Source Amount, Target Amount, Rate, Ref#
                try:
                    date_str = row[0].strip()
                    transaction_type = row[1].strip().upper()
                    source_code = row[2].strip().upper()
                    target_code = row[3].strip().upper()
                    source_amount = Decimal(row[4].strip())
                    target_amount = Decimal(row[5].strip())
                    rate = Decimal(row[6].strip())
                    reference_number = row[7].strip() if row[7].strip() else None
                    
                    # Optional fields
                    customer_name = row[8].strip() if len(row) > 8 and row[8].strip() else None
                    customer_contact = row[9].strip() if len(row) > 9 and row[9].strip() else None
                    notes = row[10].strip() if len(row) > 10 and row[10].strip() else None
                    
                    # Get time if available (optional)
                    time_str = row[11].strip() if len(row) > 11 and row[11].strip() else None
                    
                    # Parse date
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                    except ValueError:
                        try:
                            date_obj = datetime.strptime(date_str, '%d/%m/%Y').date()
                        except ValueError:
                            raise ValueError(f"Invalid date format: {date_str}")
                    
                    # Parse time if available
                    if time_str:
                        try:
                            time_obj = datetime.strptime(time_str, '%H:%M:%S').time()
                        except ValueError:
                            try:
                                time_obj = datetime.strptime(time_str, '%H:%M').time()
                            except ValueError:
                                time_obj = timezone.now().time()
                    else:
                        time_obj = timezone.now().time()
                    
                    # Validate transaction type
                    if transaction_type not in ('BUY', 'SELL'):
                        raise ValueError(f"Invalid transaction type: {transaction_type}")
                    
                    # Get currencies
                    try:
                        source_currency = Currency.objects.get(code=source_code)
                        target_currency = Currency.objects.get(code=target_code)
                    except Currency.DoesNotExist:
                        raise ValueError(f"Currency not found: {source_code} or {target_code}")
                    
                    # Look for related transaction reference
                    related_ref = row[12].strip() if len(row) > 12 and row[12].strip() else None
                    related_transaction = None
                    
                    if related_ref:
                        try:
                            related_transaction = Transaction.objects.get(reference_number=related_ref)
                        except Transaction.DoesNotExist:
                            pass
                    
                    # Create or update transaction
                    defaults = {
                        'transaction_type': transaction_type,
                        'source_currency': source_currency,
                        'source_amount': source_amount,
                        'target_currency': target_currency,
                        'target_amount': target_amount,
                        'rate': rate,
                        'date': date_obj,
                        'time': time_obj,
                        'customer_name': customer_name,
                        'customer_contact': customer_contact,
                        'notes': notes,
                    }
                    
                    if related_transaction:
                        defaults['related_transaction'] = related_transaction
                    
                    if user:
                        defaults['added_by'] = user
                    
                    if reference_number:
                        transaction, created = Transaction.objects.update_or_create(
                            reference_number=reference_number,
                            defaults=defaults
                        )
                    else:
                        # If no reference number, create a new transaction
                        transaction = Transaction.objects.create(**defaults)
                        created = True
                    
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                
                except Exception as e:
                    logger.error(f"Error processing transaction row: {str(e)}")
        
        return {
            'created': created_count,
            'updated': updated_count,
            'total': len(values)
        }
    
    except Exception as e:
        logger.error(f"Error syncing transactions: {str(e)}")
        raise 