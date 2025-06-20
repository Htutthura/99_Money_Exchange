from django.utils import timezone
from datetime import datetime
from django.utils.dateparse import parse_datetime, parse_date

class DateTimeService:
    """
    Utility service for handling date and time consistently across the application.
    Standardizes timezone handling and date format conversion.
    """
    
    @staticmethod
    def to_local_timezone(dt):
        """Convert UTC datetime to local timezone"""
        if dt is None:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return timezone.localtime(dt)
    
    @staticmethod
    def to_utc(dt):
        """Convert local datetime to UTC"""
        if dt is None:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return timezone.localtime(dt, timezone=timezone.utc)
    
    @staticmethod
    def from_iso_string(date_str):
        """Parse ISO string to datetime with proper timezone handling"""
        if not date_str:
            return None
            
        try:
            # Handle timezone-aware ISO strings
            dt = parse_datetime(date_str)
            if dt:
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt)
                return dt
                
            # Try date-only format
            date_obj = parse_date(date_str)
            if date_obj:
                dt = datetime.combine(date_obj, datetime.min.time())
                return timezone.make_aware(dt)
                
            return None
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def to_iso_string(dt):
        """Format datetime to ISO-8601 with timezone"""
        if dt is None:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return dt.isoformat()
    
    @staticmethod
    def format_for_display(dt):
        """Format datetime to DD-MM-YYYY format for display"""
        if dt is None:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        local_dt = timezone.localtime(dt)
        return local_dt.strftime('%d-%m-%Y')
    
    @staticmethod
    def format_date_time_for_display(dt):
        """Format datetime to DD-MM-YYYY HH:MM format for display"""
        if dt is None:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        local_dt = timezone.localtime(dt)
        return local_dt.strftime('%d-%m-%Y %H:%M')
    
    @staticmethod
    def parse_display_format(date_str):
        """Parse date from DD-MM-YYYY format"""
        if not date_str:
            return None
            
        try:
            day, month, year = date_str.split('-')
            date_obj = datetime(int(year), int(month), int(day))
            return timezone.make_aware(date_obj)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def today():
        """Get today's date in the local timezone"""
        return timezone.localtime().date()
    
    @staticmethod
    def now():
        """Get current datetime in the local timezone"""
        return timezone.localtime() 