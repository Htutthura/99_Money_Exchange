import { format, parseISO, formatISO } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

// Define application timezone (should match backend)
const APP_TIMEZONE = 'Asia/Bangkok';

// Format date for display in DD-MM-YYYY format
export const formatDateForDisplay = (date) => {
  if (!date) return '';
  
  try {
    // Handle ISO string or Date object
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'dd-MM-yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

// Format date in a longer format (DD MMM, YYYY)
export const formatDateLong = (date) => {
  if (!date) return '';
  
  try {
    // Handle ISO string or Date object
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'dd MMM, yyyy');
  } catch (error) {
    console.error('Error formatting date long:', error);
    return '';
  }
};

// Format date and time for display (DD-MM-YYYY HH:mm)
export const formatDateTimeForDisplay = (date) => {
  if (!date) return '';
  
  try {
    // Handle ISO string or Date object
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'dd-MM-yyyy HH:mm');
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
};

// Alias for backward compatibility
export const formatDateTime = formatDateTimeForDisplay;

// Format date for API request - always in ISO format with timezone
export const formatDateForAPI = (date) => {
  if (!date) return '';
  
  try {
    // Ensure date is a proper Date object
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Format as YYYY-MM-DD (API standard format)
    return format(dateObj, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting date for API:', error);
    return '';
  }
};

// Format datetime for API request - ISO format with timezone
export const formatDateTimeForAPI = (date) => {
  if (!date) return '';
  
  try {
    // Ensure date is a proper Date object
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Convert to UTC ISO string with timezone
    return formatISO(dateObj);
  } catch (error) {
    console.error('Error formatting datetime for API:', error);
    return '';
  }
};

// Parse date from API (handles ISO strings and timezones)
export const parseDateFromAPI = (dateString) => {
  if (!dateString) return null;
  
  try {
    // Parse ISO string to local date object with correct timezone
    const utcDate = parseISO(dateString);
    return utcToZonedTime(utcDate, APP_TIMEZONE);
  } catch (error) {
    console.error('Error parsing date from API:', error);
    return null;
  }
};

// Convert date from local timezone to UTC for API
export const toUTC = (date) => {
  if (!date) return null;
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return zonedTimeToUtc(dateObj, APP_TIMEZONE);
  } catch (error) {
    console.error('Error converting to UTC:', error);
    return null;
  }
};

// Get today's date in YYYY-MM-DD format (for API)
export const getTodayFormatted = () => {
  return format(new Date(), 'yyyy-MM-dd');
};

// Parse date string from DD-MM-YYYY format (for user input)
export const parseDateFromDisplay = (dateString) => {
  if (!dateString) return null;
  
  try {
    // Extract day, month, year from DD-MM-YYYY format
    const [day, month, year] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  } catch (error) {
    console.error('Error parsing display date:', error);
    return null;
  }
}; 