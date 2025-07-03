import React, { useState, useEffect } from 'react';
import {
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  MenuItem,
  InputAdornment,
  Box,
  Divider,
  FormControlLabel,
  Switch,
  Chip,
  Collapse,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AccessTime, CalendarToday } from '@mui/icons-material';
import { formatDateTimeForAPI, formatDateForDisplay, formatDateTimeForDisplay } from '../utils/dateUtils';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
}));

const TransactionForm = ({ onSubmit, initialValues = null, editMode = false, actionButtons = null }) => {
  const [formState, setFormState] = useState({
    transaction_type: 'BUY',
    customer_name: '',
    source_currency: 'MMK',
    target_currency: 'THB',
    source_amount: '',
    target_amount: '',
    rate: '',
    hundred_k_rate: '',
    customer_contact: '',
    notes: '',
    use_custom_datetime: false,
    transaction_date: new Date(),
    transaction_time: new Date(),
  });
  
  // Use effect to initialize form data when in edit mode
  useEffect(() => {
    if (initialValues) {
      // Parse existing date if available
      let transactionDate = new Date();
      let transactionTime = new Date();
      
      if (initialValues.created_at) {
        const existingDate = new Date(initialValues.created_at);
        transactionDate = existingDate;
        transactionTime = existingDate;
      }
      
      setFormState({
        transaction_type: initialValues.transaction_type || 'BUY',
        customer_name: initialValues.customer_name || '',
        source_currency: initialValues.source_currency || 'MMK',
        target_currency: initialValues.target_currency || 'THB',
        source_amount: initialValues.source_amount?.toString() || '',
        target_amount: initialValues.target_amount?.toString() || '',
        rate: initialValues.rate?.toString() || '',
        hundred_k_rate: initialValues.hundred_k_rate?.toString() || '',
        customer_contact: initialValues.customer_contact || '',
        notes: initialValues.notes || '',
        use_custom_datetime: !!initialValues.created_at,
        transaction_date: transactionDate,
        transaction_time: transactionTime,
      });
    }
  }, [initialValues]);

  // Auto-calculate rates when MMK or THB amounts change
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Update the form with the changed field
    let updatedData = { ...formState, [name]: value };
    
    // If either source amount or target amount changes, calculate rate and 100K rate
    if ((name === 'source_amount' || name === 'target_amount') && 
        updatedData.source_amount && updatedData.target_amount) {
      
      const sourceAmount = parseFloat(updatedData.source_amount);
      const targetAmount = parseFloat(updatedData.target_amount);
      
      // Only calculate if both values are valid numbers greater than 0
      if (sourceAmount > 0 && targetAmount > 0) {
        // Calculate rate (source amount / target amount)
        const rate = sourceAmount / targetAmount;
        
        // Calculate 100K rate (100000 / rate)
        const hundredKRate = 100000 / rate;
        
        // Update the form data with calculated values
        updatedData = {
          ...updatedData,
          rate: rate.toFixed(4),
          hundred_k_rate: hundredKRate.toFixed(2)
        };
      }
    }
    
    setFormState(updatedData);
  };

  // Handle date/time changes
  const handleDateTimeChange = (field, value) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle custom datetime toggle
  const handleCustomDateTimeToggle = (e) => {
    const useCustom = e.target.checked;
    setFormState(prev => ({
      ...prev,
      use_custom_datetime: useCustom,
      // Reset to current date/time when toggling off
      transaction_date: useCustom ? prev.transaction_date : new Date(),
      transaction_time: useCustom ? prev.transaction_time : new Date(),
    }));
  };

  // Get combined datetime for submission
  const getCombinedDateTime = () => {
    if (!formState.use_custom_datetime) {
      return new Date(); // Use current date/time
    }
    
    // Combine date and time
    const date = new Date(formState.transaction_date);
    const time = new Date(formState.transaction_time);
    
    date.setHours(time.getHours());
    date.setMinutes(time.getMinutes());
    date.setSeconds(time.getSeconds());
    
    return date;
  };

  // Add form validation
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    // Validate customer name
    if (!formState.customer_name.trim()) {
      newErrors.customer_name = 'Customer name is required';
    }
    
    // Validate amounts
    const thbAmount = parseFloat(formState.target_amount);
    if (isNaN(thbAmount) || thbAmount <= 0) {
      newErrors.target_amount = 'THB amount must be a positive number';
    }
    
    const mmkAmount = parseFloat(formState.source_amount);
    if (isNaN(mmkAmount) || mmkAmount <= 0) {
      newErrors.source_amount = 'MMK amount must be a positive number';
    }
    
    // Validate rate
    const rate = parseFloat(formState.rate);
    if (isNaN(rate) || rate <= 0) {
      newErrors.rate = 'Rate must be a positive number';
    }
    
    // Validate custom datetime if enabled
    if (formState.use_custom_datetime) {
      const selectedDateTime = getCombinedDateTime();
      const now = new Date();
      
      if (selectedDateTime > now) {
        newErrors.transaction_date = 'Transaction date and time cannot be in the future';
      }
      
      // Check if date is too far in the past (more than 1 year)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (selectedDateTime < oneYearAgo) {
        newErrors.transaction_date = 'Transaction date cannot be more than 1 year in the past';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Fix the handleSubmit function to properly handle the event
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    // Always assign values consistently based on the form field labels:
    // - target_amount is always THB (as labeled in the form)
    // - source_amount is always MMK (as labeled in the form)
    const formData = {
      transaction_type: formState.transaction_type,
      customer: formState.customer_name,
      thb_amount: parseFloat(formState.target_amount),  // THB amount is always in target_amount field
      mmk_amount: parseFloat(formState.source_amount),  // MMK amount is always in source_amount field
      rate: parseFloat(formState.rate),
      hundred_k_rate: parseFloat(formState.hundred_k_rate),
      profit: 0,
    };

    // Set loading state
    setIsSubmitting(true);

    // Add custom datetime if specified
    if (formState.use_custom_datetime) {
      formData.created_at = formatDateTimeForAPI(getCombinedDateTime());
    }
    
    // For all transactions, call parent onSubmit and reset form on success
    Promise.resolve(onSubmit(formData)).then(() => {
      // Reset form after successful submission (only if not in edit mode)
      if (!editMode) {
        resetForm();
      }
      
      // Success feedback is now handled by parent component
    }).catch((error) => {
      console.error('Error submitting transaction:', error);
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  // Helper function to reset the form
  const resetForm = () => {
    setFormState({
      transaction_type: 'BUY',
      customer_name: '',
      source_currency: 'MMK',
      target_currency: 'THB',
      source_amount: '',
      target_amount: '',
      rate: '',
      hundred_k_rate: '',
      customer_contact: '',
      notes: '',
      use_custom_datetime: false,
      transaction_date: new Date(),
      transaction_time: new Date(),
    });
    setErrors({});
  };

  return (
    <StyledPaper>
      <form onSubmit={handleSubmit}>

        
        {/* Date and Time Section - Moved to top */}
        <Grid container spacing={3} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }}>
              <Chip 
                icon={<CalendarToday />} 
                label="Transaction Date & Time" 
                variant="outlined" 
                size="small"
                sx={{ px: 2 }}
              />
            </Divider>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formState.use_custom_datetime}
                      onChange={handleCustomDateTimeToggle}
                      color="primary"
                    />
                  }
                  label="Use Custom Date and Time"
                />
                {formState.use_custom_datetime && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const now = new Date();
                      setFormState(prev => ({
                        ...prev,
                        transaction_date: now,
                        transaction_time: now,
                      }));
                    }}
                    sx={{ ml: 1 }}
                  >
                    Reset to Now
                  </Button>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {formState.use_custom_datetime 
                  ? "Set a specific date and time for this transaction"
                  : "Transaction will be recorded with current date and time"
                }
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              p: 2,
              bgcolor: formState.use_custom_datetime ? 'primary.50' : 'grey.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: formState.use_custom_datetime ? 'primary.200' : 'grey.300',
              transition: 'all 0.2s ease-in-out'
            }}>
              <AccessTime 
                color={formState.use_custom_datetime ? "primary" : "action"} 
                fontSize="small" 
              />
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {formState.use_custom_datetime ? "Selected Time:" : "Current Time:"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formState.use_custom_datetime 
                    ? formatDateTimeForDisplay(getCombinedDateTime())
                    : formatDateTimeForDisplay(new Date())
                  }
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Date and Time Pickers - Only show when custom datetime is enabled */}
          <Collapse in={formState.use_custom_datetime} timeout={300}>
            <Grid container spacing={3} sx={{ mt: 0 }}>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Transaction Date"
                    value={formState.transaction_date}
                    onChange={(newValue) => handleDateTimeChange('transaction_date', newValue)}
                    maxDate={new Date()}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!errors.transaction_date,
                        helperText: errors.transaction_date || "Select the date for this transaction"
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <TimePicker
                    label="Transaction Time"
                    value={formState.transaction_time}
                    onChange={(newValue) => handleDateTimeChange('transaction_time', newValue)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: "Select the time for this transaction"
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
            </Grid>
          </Collapse>
        </Grid>

        {/* Transaction Details Section */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }}>
              <Chip 
                label="Transaction Details" 
                variant="outlined" 
                size="small"
                sx={{ px: 2 }}
              />
            </Divider>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Transaction Type"
              name="transaction_type"
              value={formState.transaction_type}
              onChange={handleChange}
            >
              <MenuItem value="BUY">Buy</MenuItem>
              <MenuItem value="SELL">Sell</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Customer Name"
              name="customer_name"
              value={formState.customer_name}
              onChange={handleChange}
              required
              error={!!errors.customer_name}
              helperText={errors.customer_name || ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="THB Amount"
              name="target_amount"
              type="number"
              value={formState.target_amount}
              onChange={handleChange}
              required
              error={!!errors.target_amount}
              helperText={errors.target_amount || "Amount in Thai Baht (THB)"}
              InputProps={{
                startAdornment: <InputAdornment position="start">฿</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="MMK Amount"
              name="source_amount"
              type="number"
              value={formState.source_amount}
              onChange={handleChange}
              required
              error={!!errors.source_amount}
              helperText={errors.source_amount || "Amount in Myanmar Kyat (MMK)"}
              InputProps={{
                startAdornment: <InputAdornment position="start">MMK</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Rate"
              name="rate"
              type="number"
              value={formState.rate}
              onChange={handleChange}
              required
              error={!!errors.rate}
              helperText={errors.rate || "Exchange rate (MMK per 1 THB)"}
              InputProps={{
                readOnly: formState.mmk_amount && formState.thb_amount,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="100K Rate"
              name="hundred_k_rate"
              type="number"
              value={formState.hundred_k_rate}
              onChange={handleChange}
              required
              helperText="THB for 100,000 MMK"
              InputProps={{
                readOnly: formState.mmk_amount && formState.thb_amount,
              }}
            />
          </Grid>

          {/* Transaction Preview */}
          {formState.use_custom_datetime && formState.customer_name && formState.target_amount && formState.source_amount && (
            <Grid item xs={12}>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'info.50', 
                borderRadius: 2, 
                border: '1px solid', 
                borderColor: 'info.200',
                mt: 1
              }}>
                <Typography variant="subtitle2" color="info.main" gutterBottom>
                  Transaction Preview:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>{formState.customer_name}</strong> will {formState.transaction_type.toLowerCase()} <strong>{formState.target_amount} THB</strong> for <strong>{formState.source_amount} MMK</strong> on <strong>{formatDateTimeForDisplay(getCombinedDateTime())}</strong>
                </Typography>
              </Box>
            </Grid>
          )}

          {/* Action buttons row */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            {editMode ? (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'center'
              }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating...' : 'Update Transaction'}
                </Button>
              </Box>
            ) : (
              <Box sx={{ width: '100%' }}>
                {actionButtons}
              </Box>
            )}
          </Grid>
        </Grid>
      </form>
    </StyledPaper>
  );
};

export default TransactionForm; 