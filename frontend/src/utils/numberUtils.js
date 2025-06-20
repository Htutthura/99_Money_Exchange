// Utility functions for safe number parsing and formatting

/**
 * Safely parse a float value, returning a default value if parsing fails
 * @param {string|number} value - The value to parse
 * @param {number} defaultValue - Default value to return if parsing fails (default: 0)
 * @returns {number} - Parsed number or default value
 */
export const safeParseFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Safely parse an integer value, returning a default value if parsing fails
 * @param {string|number} value - The value to parse
 * @param {number} defaultValue - Default value to return if parsing fails (default: 0)
 * @returns {number} - Parsed integer or default value
 */
export const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Format a number with commas for display
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted number string
 */
export const formatNumberWithCommas = (value, decimals = 2) => {
  const num = safeParseFloat(value, 0);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Validate if a value is a valid positive number
 * @param {string|number} value - The value to validate
 * @returns {boolean} - True if valid positive number
 */
export const isValidPositiveNumber = (value) => {
  const num = safeParseFloat(value);
  return num > 0;
};

/**
 * Validate if a value is a valid number (including zero and negative)
 * @param {string|number} value - The value to validate
 * @returns {boolean} - True if valid number
 */
export const isValidNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  
  const parsed = parseFloat(value);
  return !isNaN(parsed);
}; 