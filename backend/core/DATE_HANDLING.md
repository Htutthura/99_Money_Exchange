# Date Handling in 99 Money Exchange App

## Overview

This document outlines our standardized approach to date and time handling throughout the 99 Money Exchange application. Following these standards ensures consistency between the frontend and backend, preventing timezone issues and format mismatches.

## Date Format Standards

### For Display (Human Readable)
- **Date only**: `DD-MM-YYYY` (e.g., "15-06-2025")
- **Date and time**: `DD-MM-YYYY HH:MM` (e.g., "15-06-2025 14:30")
- **Long format date**: `DD MMM, YYYY` (e.g., "15 Jun, 2025")

### For API Communication
- **Date only**: `YYYY-MM-DD` (ISO 8601 format, e.g., "2025-06-15")
- **Date and time**: ISO 8601 with timezone (e.g., "2025-06-15T14:30:00+07:00")

## Backend Implementation

### DateTimeService

We've implemented a `DateTimeService` utility class in `core/utils.py` that provides methods for:

- Converting between timezones
- Parsing dates from strings
- Formatting dates for display and API
- Handling timezone-aware datetime objects

Example usage:

```python
from core.utils import DateTimeService

# Parse a date string
date_obj = DateTimeService.from_iso_string("2025-06-15T14:30:00+07:00")

# Format for display
display_date = DateTimeService.format_for_display(date_obj)  # "15-06-2025"
display_datetime = DateTimeService.format_date_time_for_display(date_obj)  # "15-06-2025 14:30"

# Get current datetime in local timezone
now = DateTimeService.now()
```

### Custom Serializer Fields

We've created custom serializer fields in `core/serializers.py` to handle date and time conversion:

- `StandardDateField`: Handles date-only fields, displaying in DD-MM-YYYY format
- `StandardDateTimeField`: Handles datetime fields, maintaining ISO format with timezone
- `DisplayDateTimeField`: Handles datetime fields, displaying in DD-MM-YYYY HH:MM format

Example usage in serializers:

```python
from core.serializers import StandardDateField, DisplayDateTimeField

class MyModelSerializer(serializers.ModelSerializer):
    date_field = StandardDateField()
    created_at = DisplayDateTimeField(read_only=True)
    
    class Meta:
        model = MyModel
        fields = ['id', 'date_field', 'created_at']
```

## Frontend Implementation

The frontend uses the enhanced `dateUtils.js` utility module that provides functions for:

- Formatting dates for display
- Preparing dates for API requests
- Parsing dates from API responses
- Handling timezone conversions

Example usage:

```javascript
import { 
  formatDateForDisplay, 
  formatDateForAPI, 
  parseDateFromAPI 
} from '../utils/dateUtils';

// Format a date for display
const displayDate = formatDateForDisplay(new Date());  // "15-06-2025"

// Format a date for API request
const apiDate = formatDateForAPI(new Date());  // "2025-06-15"

// Parse a date from API response
const dateObject = parseDateFromAPI("2025-06-15T14:30:00+07:00");
```

## Best Practices

1. **Always use the utility functions** for date operations, never manual string manipulation
2. **Be timezone-aware** - remember that the server and client may be in different timezones
3. **Display dates in local format** (DD-MM-YYYY) for user interfaces
4. **Use ISO format** (YYYY-MM-DD) for API communications
5. **Include timezone information** for datetime values when possible
6. **Use the custom serializer fields** for all date-related model fields

## Troubleshooting

Common issues and solutions:

1. **Dates appear one day off**: Check for timezone handling issues
2. **Format mismatch errors**: Ensure you're using the utility functions
3. **Parsing failures**: Verify input strings match expected formats

## FAQ

**Q: Why use DD-MM-YYYY for display?**
A: This format is more common in most parts of the world and is the preferred format for our users.

**Q: Why use YYYY-MM-DD for API?**
A: This is the ISO 8601 standard for date representation and avoids ambiguity in machine-to-machine communication. 