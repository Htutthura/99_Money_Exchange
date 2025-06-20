from rest_framework import serializers
from .utils import DateTimeService

class StandardDateField(serializers.Field):
    """
    Custom serializer field for date handling with standardized formats.
    - Input: Accepts ISO format or DD-MM-YYYY format
    - Output: Returns DD-MM-YYYY format for display
    """
    
    def to_representation(self, value):
        """Convert date to DD-MM-YYYY format for API responses"""
        return DateTimeService.format_for_display(value)
    
    def to_internal_value(self, data):
        """Parse date from various formats to datetime object"""
        # Try parsing as ISO format first
        dt = DateTimeService.from_iso_string(data)
        if dt:
            return dt
            
        # Try parsing as DD-MM-YYYY format
        dt = DateTimeService.parse_display_format(data)
        if dt:
            return dt
            
        raise serializers.ValidationError("Invalid date format. Use DD-MM-YYYY or ISO format.")

class StandardDateTimeField(serializers.Field):
    """
    Custom serializer field for datetime handling with standardized formats.
    - Input: Accepts ISO format
    - Output: Returns ISO format with timezone
    """
    
    def to_representation(self, value):
        """Convert datetime to ISO format with timezone for API responses"""
        return DateTimeService.to_iso_string(value)
    
    def to_internal_value(self, data):
        """Parse datetime from ISO format to datetime object"""
        dt = DateTimeService.from_iso_string(data)
        if dt:
            return dt
            
        raise serializers.ValidationError("Invalid datetime format. Use ISO format.")

class DisplayDateTimeField(serializers.Field):
    """
    Custom serializer field for datetime handling with display-friendly formats.
    - Input: Accepts ISO format
    - Output: Returns DD-MM-YYYY HH:MM format for display
    """
    
    def to_representation(self, value):
        """Convert datetime to DD-MM-YYYY HH:MM format for API responses"""
        return DateTimeService.format_date_time_for_display(value)
    
    def to_internal_value(self, data):
        """Parse datetime from ISO format to datetime object"""
        dt = DateTimeService.from_iso_string(data)
        if dt:
            return dt
            
        raise serializers.ValidationError("Invalid datetime format. Use ISO format.") 