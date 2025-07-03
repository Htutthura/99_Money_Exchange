import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Box,
  Grid,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Card,
  CardContent,
  TableFooter,
  Snackbar,
  TablePagination,
  TableSortLabel,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import './TransactionTable.css';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CalculateIcon from '@mui/icons-material/Calculate';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import TransactionForm from './TransactionForm';
import { format } from 'date-fns';
import axios from 'axios';
import { debounce } from 'lodash';
import { Delete as DeleteIconRefresh } from '@mui/icons-material';

const API_BASE_URL = 'https://99moneyexchange.pythonanywhere.com/api/transactions/';

// Add debug fetch options to include CORS mode and credentials
const fetchOptions = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  mode: 'cors',
  credentials: 'include', // Add credentials to include cookies
};

// Updated URL constants for specific endpoints
const TRANSACTIONS_LIST_URL = `${API_BASE_URL}list/`;
const TRANSACTIONS_CALC_URL = `${API_BASE_URL}calculate_profits/`;
const TRANSACTIONS_EXPORT_URL = `${API_BASE_URL}export/`;
const CURRENCIES_URL = `${API_BASE_URL}currencies/`;

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Create axios instance with base configuration
const api = axios.create({
      baseURL: 'https://99moneyexchange.pythonanywhere.com/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error:', error.response.status, error.response.data);
      
      // Handle specific HTTP status codes
      if (error.response.status === 404) {
        return Promise.reject({ message: 'Data not found.' });
      } else if (error.response.status === 500) {
        return Promise.reject({ message: 'Server error. Please try again later.' });
      } else if (error.response.status >= 400 && error.response.status < 500) {
        return Promise.reject({ message: error.response.data?.message || 'Request failed.' });
      } else {
        return Promise.reject({ message: 'An unexpected error occurred.' });
      }
    } else if (error.request) {
      // The request was made but no response was received
      // This could be a network issue, but don't show it during normal loading
      console.error('Network Error:', error.request);
      
      // Check if this is a cancelled request (normal during component unmounting)
      if (error.code === 'ERR_CANCELED' || error.message.includes('canceled')) {
        return Promise.reject({ message: null }); // Don't show error for cancelled requests
      }
      
      return Promise.reject({ message: 'Unable to connect to server. Please check your connection and try again.' });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request Error:', error.message);
      return Promise.reject({ message: 'An error occurred while processing your request.' });
    }
  }
);

const TransactionTable = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [waitingForCalculation, setWaitingForCalculation] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    transaction_type: 'BUY',
    customer_name: '',
    source_currency: 'MMK', // Default source for BUY is MMK
    target_currency: 'THB', // Default target for BUY is THB
    source_amount: '',
    target_amount: '',
    rate: '',
    hundred_k_rate: '',
    customer_contact: '',
    notes: '',
  });
  
  // For edit functionality
  const [editMode, setEditMode] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // For delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  // Your own rate calculation logic
  const [baseRates, setBaseRates] = useState({
    baseRate: 0.80, // Your base rate for reference
    threshold1: 1000000, // MMK threshold for first tier
    threshold2: 5000000, // MMK threshold for second tier
    tier1Adjustment: 0.01, // Rate adjustment for tier 1
    tier2Adjustment: 0.02, // Rate adjustment for tier 2
    tier3Adjustment: 0.03, // Rate adjustment for tier 3
  });

  // State for profit calculation
  const [profitData, setProfitData] = useState(null);
  const [calculatingProfit, setCalculatingProfit] = useState(false);
  const [profitDialogOpen, setProfitDialogOpen] = useState(false);
  
  // New state to track if profits have been properly calculated
  const [profitsCalculated, setProfitsCalculated] = useState(false);

  // Enhanced filter state
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showAll, setShowAll] = useState(true);
  const [transactionType, setTransactionType] = useState(''); // New filter for transaction type
  const [filterSearchTerm, setFilterSearchTerm] = useState(''); // Separate search for filters

  // Add missing state variables
  const [successMessage, setSuccessMessage] = useState(null);
  const [todaysTransactionCount, setTodaysTransactionCount] = useState(0);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [orderBy, setOrderBy] = useState('date_time');
  const [order, setOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Confirmation dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchValue) => {
      setSearchTerm(searchValue);
      setPage(0); // Reset to first page when searching
    }, 500),
    []
  );

  // Handle filter search change
  const handleFilterSearchChange = (event) => {
    const value = event.target.value;
    setFilterSearchTerm(value);
    debouncedSearch(value);
  };

  const fetchTransactions = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError(null);
      
      // Small delay to prevent showing errors too quickly during normal loading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Build params object with all filters
      const params = {
        page: page + 1,
        page_size: rowsPerPage,
        ordering: order === 'desc' ? `-${orderBy}` : orderBy,
        search: searchTerm,
        show_all: showAll.toString()
      };

      // Add date filters if they are set and showAll is false
      if (!showAll && (startDate || endDate)) {
        if (startDate) {
          params.start_date = startDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }
        if (endDate) {
          params.end_date = endDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }
      }

      // Add transaction type filter
      if (transactionType) {
        params.type = transactionType;
      }
      
      // Debug logging
      console.log('Fetching transactions with params:', params);
      
      const response = await api.get('/transactions/list/', {
        params,
        signal
      });
      
      // Handle both paginated and non-paginated responses
      if (response.data) {
        if (Array.isArray(response.data)) {
          // If the response is a direct array
          setTransactions(response.data);
          setTotalCount(response.data.length);
        } else if (response.data.results && Array.isArray(response.data.results)) {
          // If the response is paginated
          setTransactions(response.data.results);
          setTotalCount(response.data.count || response.data.results.length);
        } else {
          throw new Error('Unexpected response format from server');
        }
      } else {
        throw new Error('Empty response from server');
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Request cancelled:', err.message);
        return; // Don't set error for cancelled requests
      } else {
        // Only show error if it's not a null message (from cancelled requests)
        if (err.message && err.message !== null) {
          const errorMessage = err.message || 'Failed to load transactions. Please try again later.';
          setError(errorMessage);
          console.error('Error fetching transactions:', err);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, orderBy, order, searchTerm, startDate, endDate, showAll, transactionType]);

  // Fetch today's transaction count separately for the activity card
  const fetchTodaysTransactionCount = useCallback(async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      const response = await api.get('/transactions/list/', {
        params: {
          start_date: todayStr,
          end_date: todayStr,
          page_size: 1, // We only need the count, not the actual data
          show_all: 'false'
        }
      });
      
      // Handle both paginated and non-paginated responses
      if (response.data) {
        if (Array.isArray(response.data)) {
          setTodaysTransactionCount(response.data.length);
        } else if (response.data.count !== undefined) {
          setTodaysTransactionCount(response.data.count);
        } else if (response.data.results && Array.isArray(response.data.results)) {
          setTodaysTransactionCount(response.data.results.length);
        }
      }
    } catch (err) {
      console.error('Error fetching today\'s transaction count:', err);
      // Don't show error for this background fetch
    }
  }, []);

  // Clear all filters function
  const clearAllFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setShowAll(true);
    setTransactionType('');
    setFilterSearchTerm('');
    setSearchTerm('');
    setPage(0);
  };

  // Quick filter presets
  const applyQuickFilter = (filterType) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    setShowAll(false);
    setPage(0);

    switch (filterType) {
      case 'today':
        setStartDate(today);
        setEndDate(today);
        break;
      case 'yesterday':
        setStartDate(yesterday);
        setEndDate(yesterday);
        break;
      case 'week':
        setStartDate(weekAgo);
        setEndDate(today);
        break;
      case 'month':
        setStartDate(monthAgo);
        setEndDate(today);
        break;
      default:
        break;
    }
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (!showAll && (startDate || endDate)) count++;
    if (transactionType) count++;
    if (searchTerm) count++;
    return count;
  };

  // Effect for fetching data with cleanup
  useEffect(() => {
    const controller = new AbortController();
    fetchTransactions(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [fetchTransactions, refreshKey]);

  // Fetch today's transaction count when component loads or transactions change
  useEffect(() => {
    fetchTodaysTransactionCount();
  }, [fetchTodaysTransactionCount, refreshKey]);

  // Handle sorting
  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    fetchCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Ensure profit calculation runs when component mounts
  useEffect(() => {
    // Direct call to calculate profits to ensure data is available
    calculateProfitsBackground();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch for transaction type changes to swap source/target currencies
  useEffect(() => {
    if (newTransaction.transaction_type === 'BUY') {
      // For BUY: Customer gives MMK, gets THB
      setNewTransaction(prev => ({
        ...prev,
        source_currency: 'MMK',
        target_currency: 'THB',
      }));
    } else {
      // For SELL: Customer gives THB, gets MMK
      setNewTransaction(prev => ({
        ...prev,
        source_currency: 'THB',
        target_currency: 'MMK',
      }));
    }
  }, [newTransaction.transaction_type]);

  // Calculate rate and 100K rate whenever source or target amount changes
  useEffect(() => {
    if (newTransaction.source_amount && newTransaction.target_amount) {
      const sourceAmount = parseFloat(newTransaction.source_amount);
      const targetAmount = parseFloat(newTransaction.target_amount);
      
      if (sourceAmount > 0 && targetAmount > 0) {
        // Calculate rate based on MMK/THB
        let rate;
        if (newTransaction.transaction_type === 'BUY') {
          // For BUY: Customer gives MMK, gets THB
          // Rate = MMK/THB
          rate = sourceAmount / targetAmount;
        } else {
          // For SELL: Customer gives THB, gets MMK
          // Rate = MMK/THB
          rate = targetAmount / sourceAmount;
        }
        
        // Calculate 100K rate
        const hundredKRate = 100000 / rate;
        
        // Update the rates
        setNewTransaction(prev => ({
          ...prev,
          rate: rate.toFixed(4),
          hundred_k_rate: hundredKRate.toFixed(2)
        }));
      }
    }
  }, [newTransaction.source_amount, newTransaction.target_amount, newTransaction.transaction_type]);

  const fetchCurrencies = async (retryCount = 0) => {
    try {
      const response = await fetch(CURRENCIES_URL);
      
      if (!response.ok) {
        if (retryCount < 3) {
          setTimeout(() => fetchCurrencies(retryCount + 1), 1000);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setCurrencies(data);
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      
      if (retryCount < 3) {
        setTimeout(() => fetchCurrencies(retryCount + 1), 2000);
        return;
      }
      
      console.error('Failed to fetch currencies after retries:', err);
      setError('Failed to load currencies. Please refresh the page.');
    }
  };

  // Calculate rate based on amount using your custom rate logic
  const calculateRate = (amount, transactionType) => {
    if (!amount) return '';
    
    const amountNum = parseFloat(amount);
    let rate = baseRates.baseRate;
    
    // Apply tiered adjustments based on amount
    if (amountNum > baseRates.threshold2) {
      rate += baseRates.tier3Adjustment;
    } else if (amountNum > baseRates.threshold1) {
      rate += baseRates.tier2Adjustment;
    } else {
      rate += baseRates.tier1Adjustment;
    }
    
    // Adjust rate based on transaction type
    if (transactionType === 'SELL') {
      // For SELL, we typically offer a slightly worse rate
      rate -= 0.02; // Example adjustment
    }
    
    return rate.toFixed(4);
  };

  // Calculate 100K Rate from rate
  const calculate100KRate = (rate) => {
    if (!rate) return '-';
    return (100000 / parseFloat(rate)).toFixed(2);
  };

  // Calculate fields based on inputs
  const calculateValues = (field, value, currentValues) => {
    const values = { ...currentValues, [field]: value };

    // Handle transaction type change
    if (field === 'transaction_type') {
      return values; // Currency swap handled by useEffect
    }
    
    const isBuy = values.transaction_type === 'BUY';
    
    // When both source and target amounts are entered, calculate rate
    if ((field === 'source_amount' || field === 'target_amount') && 
        values.source_amount && values.target_amount) {
      const sourceAmount = parseFloat(values.source_amount);
      const targetAmount = parseFloat(values.target_amount);
      
      if (sourceAmount > 0 && targetAmount > 0) {
        let rate;
        
        if (isBuy) {
          // For BUY: MMK → THB, rate = MMK/THB
          rate = sourceAmount / targetAmount;
        } else {
          // For SELL: THB → MMK, rate = MMK/THB
          rate = targetAmount / sourceAmount;
        }
        
        values.rate = rate.toFixed(4);
        values.hundred_k_rate = (100000 / rate).toFixed(2);
      }
    }
    
    return values;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const updatedTransaction = calculateValues(name, value, newTransaction);
    setNewTransaction(updatedTransaction);
  };

  // Calculate profit based on transaction type and rates
  const calculateTransactionProfit = (transactionType, rate, mmkAmount, thbAmount) => {
    // Only SELL transactions show profit in the transaction table initially
    // For BUY transactions, profit will be calculated when matched with SELL transactions
    if (transactionType === 'BUY') {
      return 0;
    }
    
    // For SELL transactions, we'll show an estimated profit
    // This will be updated with the accurate value when "Calculate Profit" is called
    // The estimate is based on an average rate difference
    const rateDifference = 0.02; // Estimated 2% rate difference
    return Number((thbAmount * rateDifference).toFixed(2));
  };

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if this is just a refresh call (from custom datetime transactions)
      if (formData._isRefreshOnly) {
        // Just refresh the transaction list
        setRefreshKey(prev => prev + 1);
        // Calculate profits after refresh
        await calculateProfitsBackground();
        return;
      }
      
      // Validate inputs
      if (!formData.customer || !formData.thb_amount || !formData.mmk_amount) {
        throw new Error('Please fill in all required fields');
      }

      // Get values directly from formData
      const thbAmount = parseFloat(formData.thb_amount);
      const mmkAmount = parseFloat(formData.mmk_amount);
      const rate = parseFloat(formData.rate);
      const hundredKRate = parseFloat(formData.hundred_k_rate);
      
      // Calculate profit
      const profit = calculateTransactionProfit(formData.transaction_type, rate, mmkAmount, thbAmount);

      // Format data according to the API's expected structure
      const transactionData = {
        transaction_type: formData.transaction_type,
        customer: formData.customer,
        thb_amount: Number(thbAmount.toFixed(2)),
        mmk_amount: Number(mmkAmount.toFixed(2)),
        rate: Number(rate.toFixed(4)),
        hundred_k_rate: Number(hundredKRate.toFixed(2)),
        profit: Number(profit),
      };

      // Add custom datetime if provided
      if (formData.created_at) {
        transactionData.created_at = formData.created_at;
      }

      // Add remarks/notes if provided
      if (formData.notes) {
        transactionData.remarks = formData.notes;
      }

      // Add customer contact if provided
      if (formData.customer_contact) {
        transactionData.customer_contact = formData.customer_contact;
      }
      
      let data;
      let successMessage;

      if (editMode && editingTransaction) {
        // Update existing transaction
        console.log('Updating transaction with ID:', editingTransaction.id);
        console.log('Transaction data:', transactionData);
        
        try {
          const updateResponse = await api.patch(`/transactions/transactions/${editingTransaction.id}/`, transactionData);
          data = updateResponse.data;
          successMessage = 'Transaction updated successfully';
          console.log('Update successful:', data);
        } catch (apiError) {
          console.error('API Error during update:', apiError);
          throw new Error(apiError.response?.data?.detail || apiError.message || 'Failed to update transaction');
        }
      } else {
        // Create new transaction
        const response = await fetch(`${API_BASE_URL}create/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to create transaction');
        }

        data = await response.json();
        successMessage = 'Transaction created successfully';
      }
      
      // Exit edit mode if we were editing
      if (editMode) {
        setEditMode(false);
        setEditingTransaction(null);
      }
      
      // Refresh the transaction list
      setRefreshKey(prev => prev + 1);
      
      // Refresh today's transaction count
      fetchTodaysTransactionCount();
      
      // Show success message
      setSuccessMessage(successMessage);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Calculate profits after successful transaction
      await calculateProfitsBackground();
      
    } catch (err) {
      console.error(`Error ${editMode ? 'updating' : 'creating'} transaction:`, err);
      setError(err.message || `Failed to ${editMode ? 'update' : 'create'} transaction`);
    } finally {
      setLoading(false);
    }
  };

  // Handle edit button click
  const handleEdit = (transaction) => {
    // Prepare form values for the TransactionForm component
    const initialValues = {
      transaction_type: transaction.transaction_type,
      customer_name: transaction.customer,
      // Set source/target amounts appropriately
      target_amount: transaction.thb_amount,  // THB always goes in target_amount
      source_amount: transaction.mmk_amount,  // MMK always goes in source_amount
      source_currency: 'MMK',
      target_currency: 'THB',
      rate: transaction.rate,
      hundred_k_rate: transaction.hundred_k_rate,
    };
    
    // Set edit mode
    setEditMode(true);
    setEditingTransaction(transaction);
    
    // Scroll to the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle delete button click
  const handleDelete = async (id) => {
    try {
      setDeleteLoading(true);
      await api.delete(`/transactions/transactions/${id}/`);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      const errorMessage = err.message || 'Failed to delete transaction. Please try again.';
      setError(errorMessage);
      console.error('Error deleting transaction:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle delete dialog close
  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  // Format number with commas
  const formatNumberWithCommas = (num) => {
    if (num === undefined || num === null) return '-';
    
    // For THB values, ensure exactly 2 decimal places
    if (typeof num === 'number') {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    // For string values, use the regex pattern
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Function to calculate profit in the background without showing dialog
  const calculateProfitsBackground = async () => {
    try {
      setCalculatingProfit(true);
      
      // Add full URL for debugging
      const url = `${TRANSACTIONS_CALC_URL}?timestamp=${new Date().getTime()}`;
      
      const response = await fetch(url, {
        ...fetchOptions,
        method: 'GET',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error calculating profit:', errorText);
        throw new Error(`Failed to calculate profit: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle remaining_transactions property (renamed from unmatched_transactions)
      if (data.remaining_transactions) {
        // Make sure both buy and sell arrays exist
        if (!data.remaining_transactions.buy) data.remaining_transactions.buy = [];
        if (!data.remaining_transactions.sell) data.remaining_transactions.sell = [];
      }
      
      setProfitData(data);
      setProfitsCalculated(true);
      setError(null);
      
      // Fetch transactions again to get updated profit values
      setRefreshKey(prev => prev + 1);
      
      // Don't show profit calculation dialog automatically
      // setProfitDialogOpen(true); <- This line is removed
      
      // Notify dashboard to update by dispatching the 'profit-calculated' event
      window.dispatchEvent(new Event('profit-calculated'));
    } catch (error) {
      console.error('Error calculating profit:', error);
      setError('Failed to calculate profit. Please try again later.');
    } finally {
      setCalculatingProfit(false);
    }
  };

  // Function to calculate profit between transactions (with dialog display)
  const calculateProfit = async () => {
    try {
      setCalculatingProfit(true);
      setError(null);
      
      // Add full URL for debugging
      const url = `${TRANSACTIONS_CALC_URL}?timestamp=${new Date().getTime()}`;
      
      const response = await fetch(url, {
        ...fetchOptions,
        method: 'GET',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error calculating profit:', errorText);
        throw new Error(`Failed to calculate profit: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle remaining_transactions property (renamed from unmatched_transactions)
      if (data.remaining_transactions) {
        // Make sure both buy and sell arrays exist
        if (!data.remaining_transactions.buy) data.remaining_transactions.buy = [];
        if (!data.remaining_transactions.sell) data.remaining_transactions.sell = [];
      }
      
      setProfitData(data);
      setProfitsCalculated(true);
      setError(null);
      
      // Fetch transactions again to get updated profit values
      setRefreshKey(prev => prev + 1);
      
      // Show profit calculation dialog
      setProfitDialogOpen(true);
      
      // Notify dashboard to update by dispatching the 'profit-calculated' event
      window.dispatchEvent(new Event('profit-calculated'));
    } catch (error) {
      console.error('Error calculating profit:', error);
      setError('Failed to calculate profit. Please try again later.');
    } finally {
      setCalculatingProfit(false);
    }
  };

  const handleProfitDialogClose = () => {
    setProfitDialogOpen(false);
  };

  // Function to export transactions as CSV
  const handleExportTransactions = () => {
    const url = `${API_BASE_URL}export/?timestamp=${new Date().getTime()}`;
    window.open(url, '_blank');
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Handle delete confirmation
  const handleDeleteClick = (transaction) => {
    setSelectedTransaction(transaction);
    setDeleteConfirmOpen(true);
  };

  const handleEditClick = (transaction) => {
    setSelectedTransaction(transaction);
    setEditConfirmOpen(true);
  };

  const handleEditConfirm = () => {
    if (!selectedTransaction) return;
    
    // Prepare form values for the TransactionForm component
    const initialValues = {
      transaction_type: selectedTransaction.transaction_type,
      customer_name: selectedTransaction.customer,
      // Map the transaction data to the form structure
      target_amount: selectedTransaction.thb_amount,  // THB always goes in target_amount
      source_amount: selectedTransaction.mmk_amount,  // MMK always goes in source_amount
      source_currency: 'MMK',
      target_currency: 'THB',
      rate: selectedTransaction.rate,
      hundred_k_rate: selectedTransaction.hundred_k_rate,
      customer_contact: selectedTransaction.customer_contact || '',
      notes: selectedTransaction.remarks || '',
      created_at: selectedTransaction.date_time // Include the original date
    };
    
    // Set edit mode
    setEditMode(true);
    setEditingTransaction(selectedTransaction);
    
    // Close the confirmation dialog
    setEditConfirmOpen(false);
    setSelectedTransaction(null);
    
    // Scroll to the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditCancel = () => {
    setEditConfirmOpen(false);
    setSelectedTransaction(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setSelectedTransaction(null);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTransaction) return;
    
    try {
      setDeleteLoading(true);
      await api.delete(`/transactions/transactions/${selectedTransaction.id}/`);
      setRefreshKey(prev => prev + 1);
      fetchTodaysTransactionCount(); // Refresh today's count
      setDeleteConfirmOpen(false);
      setSelectedTransaction(null);
    } catch (err) {
      const errorMessage = err.message || 'Failed to delete transaction. Please try again.';
      setError(errorMessage);
      console.error('Error deleting transaction:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading && !transactions.length) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="200px" gap={2}>
        <CircularProgress size={40} />
        <Typography variant="h6" color="text.secondary">
          Loading Transactions...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please wait while we fetch your data
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    );
  }

  return (
    <Box sx={{ 
      minHeight: 'calc(100vh - 220px)',
      p: { xs: 1, sm: 2 }, // Responsive padding
      bgcolor: 'background.default'
    }}>
      {/* Enhanced Header */}
      <Box sx={{ 
        mb: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 700,
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: { xs: '1.5rem', sm: '2rem' }
          }}
        >
          💰 {editMode ? 'Edit Transaction' : 'Transaction Management'}
        </Typography>
        
        {/* Quick Stats Card */}
        {!editMode && (
          <Card sx={{ 
            minWidth: { xs: '100%', sm: 'auto' },
            background: 'linear-gradient(135deg, #00FF7F 0%, #00CC66 100%)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(0, 255, 127, 0.3)'
          }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Today's Activity
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {todaysTransactionCount} Transactions
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Status Alerts */}
      {waitingForCalculation && (
        <Alert 
          severity="info" 
          sx={{ 
            mb: 3,
            borderRadius: 2,
            '& .MuiAlert-icon': { fontSize: '1.5rem' }
          }}
        >
          <Typography variant="body1">
            🔄 Please wait for the calculation to complete...
          </Typography>
        </Alert>
      )}
      
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: 2,
            '& .MuiAlert-icon': { fontSize: '1.5rem' }
          }}
        >
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: 3,
            borderRadius: 2,
            '& .MuiAlert-icon': { fontSize: '1.5rem' }
          }}
        >
          {successMessage}
        </Alert>
      )}
      
      {/* Enhanced Transaction Form Card */}
      <Card sx={{ 
        mb: 4,
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden'
      }}>
        <CardContent sx={{ p: 3 }}>
          {editMode ? (
            <>
              <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                  ✏️ Editing Transaction: {editingTransaction?.customer}
                </Typography>
                <Typography variant="body2" sx={{ color: 'primary.contrastText', opacity: 0.9 }}>
                  Make your changes below and click "Update Transaction" to save.
                </Typography>
              </Box>
              <TransactionForm 
                onSubmit={handleSubmit} 
                initialValues={editingTransaction ? {
                  transaction_type: editingTransaction.transaction_type,
                  customer_name: editingTransaction.customer,
                  target_amount: editingTransaction.thb_amount,
                  source_amount: editingTransaction.mmk_amount,
                  rate: editingTransaction.rate,
                  hundred_k_rate: editingTransaction.hundred_k_rate,
                  customer_contact: editingTransaction.customer_contact || '',
                  notes: editingTransaction.remarks || '',
                  created_at: editingTransaction.date_time
                } : null} 
                editMode={true}
                actionButtons={
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    flexWrap: 'wrap',
                    justifyContent: { xs: 'stretch', sm: 'flex-start' }
                  }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      sx={{ 
                        flex: { xs: 1, sm: 'none' },
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        py: 1.5,
                        background: 'linear-gradient(135deg, #00FF7F 0%, #00CC66 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #00CC66 0%, #00AA55 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(0, 255, 127, 0.4)'
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {loading ? (
                        <>
                          <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />
                          Updating...
                        </>
                      ) : (
                        'Update Transaction'
                      )}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setEditMode(false);
                        setEditingTransaction(null);
                      }}
                      disabled={loading}
                      sx={{ 
                        flex: { xs: 1, sm: 'none' },
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        py: 1.5,
                        borderColor: 'error.main',
                        color: 'error.main',
                        '&:hover': {
                          borderColor: 'error.dark',
                          backgroundColor: 'error.main',
                          color: 'white',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(244, 67, 54, 0.2)'
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Cancel Edit
                    </Button>
                  </Box>
                }
              />
            </>
          ) : (
            <TransactionForm 
              onSubmit={handleSubmit}
              actionButtons={
                <Box sx={{ width: '100%' }}>
                  {/* Row 1: Add Transaction Button - Full Width */}
                  <Card 
                    sx={{ 
                      mb: 2,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #00FF7F 0%, #00CC66 100%)',
                      boxShadow: '0 8px 25px rgba(0, 255, 127, 0.3)',
                      border: 'none',
                      height: { xs: '80px', sm: 'auto' },
                      display: { xs: 'flex', sm: 'block' },
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #00CC66 0%, #00AA55 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 35px rgba(0, 255, 127, 0.4)',
                      },
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                  >
                    <CardContent sx={{ p: { xs: 0, sm: 3 }, textAlign: 'center', '&:last-child': { pb: { xs: 0, sm: 3 } } }}>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={loading}
                        sx={{ 
                          width: '100%',
                          height: { xs: '100%', sm: 'auto' },
                          backgroundColor: 'transparent',
                          color: '#000',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          py: { xs: 0, sm: 2 },
                          boxShadow: 'none',
                          textTransform: 'none',
                          '&:hover': {
                            backgroundColor: 'transparent',
                            boxShadow: 'none',
                          },
                          '&:disabled': {
                            backgroundColor: 'transparent',
                            color: 'rgba(0, 0, 0, 0.5)',
                          }
                        }}
                      >
                        {loading ? (
                          <>
                            <CircularProgress size={20} sx={{ mr: 1, color: 'inherit' }} />
                            Creating...
                          </>
                        ) : (
                          'Add Transaction'
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Row 2: Calculate Profits and Export Data - Two Cards */}
                  <Grid container spacing={2}>
                    {/* Calculate Profits Card */}
                    <Grid item xs={6}>
                      <Card 
                        sx={{ 
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                          boxShadow: '0 6px 20px rgba(76, 175, 80, 0.3)',
                          border: 'none',
                          height: { xs: '53px', sm: 'auto' },
                          display: { xs: 'flex', sm: 'block' },
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #45a049 0%, #3d8b40 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 25px rgba(76, 175, 80, 0.4)',
                          },
                          transition: 'all 0.3s ease'
                        }}
                        onClick={calculateProfit}
                      >
                        <CardContent sx={{ p: { xs: 0, sm: 3 }, textAlign: 'center', '&:last-child': { pb: { xs: 0, sm: 3 } } }}>
                          <Box sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, alignItems: 'center', gap: 1 }}>
                            <CalculateIcon sx={{ fontSize: { xs: 22, sm: 32 }, color: 'white' }} />
                            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                              {calculatingProfit ? (
                                <>
                                  <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />
                                  Calculating...
                                </>
                              ) : (
                                'Calculate Profits'
                              )}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', display: { xs: 'none', sm: 'block' } }}>
                              Calculate transaction profits
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Export Data Card */}
                    <Grid item xs={6}>
                      <Card 
                        sx={{ 
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                          boxShadow: '0 6px 20px rgba(33, 150, 243, 0.3)',
                          border: 'none',
                          height: { xs: '53px', sm: 'auto' },
                          display: { xs: 'flex', sm: 'block' },
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 25px rgba(33, 150, 243, 0.4)',
                          },
                          transition: 'all 0.3s ease'
                        }}
                        onClick={handleExportTransactions}
                      >
                        <CardContent sx={{ p: { xs: 0, sm: 3 }, textAlign: 'center', '&:last-child': { pb: { xs: 0, sm: 3 } } }}>
                          <Box sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, alignItems: 'center', gap: 1 }}>
                            <DownloadIcon sx={{ fontSize: { xs: 22, sm: 32 }, color: 'white' }} />
                            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                              Export Data
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', display: { xs: 'none', sm: 'block' } }}>
                              Download transactions CSV
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Enhanced Filters Card */}
      <Card sx={{ 
        mb: 4,
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 3 
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600,
              color: 'text.primary',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <FilterListIcon /> Filter & Search Transactions
              {getActiveFilterCount() > 0 && (
                <Chip 
                  label={`${getActiveFilterCount()} active`} 
                  size="small" 
                  color="primary" 
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={clearAllFilters}
              disabled={getActiveFilterCount() === 0}
              sx={{ 
                borderRadius: 2,
                textTransform: 'none'
              }}
            >
              Clear All
            </Button>
          </Box>

          {/* Search Bar */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search by customer name, contact, or notes..."
              value={filterSearchTerm}
              onChange={handleFilterSearchChange}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                sx: { borderRadius: 2 }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
          </Box>

          {/* Quick Filter Buttons */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Quick Filters
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant={showAll ? "contained" : "outlined"}
                size="small"
                onClick={() => setShowAll(true)}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                📊 All Transactions
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => applyQuickFilter('today')}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                📅 Today
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => applyQuickFilter('yesterday')}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                📆 Yesterday
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => applyQuickFilter('week')}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                📊 Last 7 Days
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => applyQuickFilter('month')}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                📈 Last 30 Days
              </Button>
            </Stack>
          </Box>

          <Divider sx={{ my: 3 }} />
          
          {/* Advanced Filters */}
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Transaction Type</InputLabel>
                <Select
                  value={transactionType}
                  onChange={(e) => {
                    setTransactionType(e.target.value);
                    setPage(0);
                  }}
                  label="Transaction Type"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="BUY">🔵 BUY (Customer MMK → THB)</MenuItem>
                  <MenuItem value="SELL">🔴 SELL (Customer THB → MMK)</MenuItem>
                  <MenuItem value="OTHER">⚪ OTHER</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(newDate) => {
                    setStartDate(newDate);
                    if (newDate) setShowAll(false);
                  }}
                  disabled={showAll}
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newDate) => {
                    setEndDate(newDate);
                    if (newDate) setShowAll(false);
                  }}
                  disabled={showAll}
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}>
                <Typography variant="body2" color="text.secondary">
                  {showAll 
                    ? `Showing all ${totalCount} transactions`
                    : `Showing ${totalCount} filtered transactions`}
                </Typography>
                {!showAll && (startDate || endDate) && (
                  <Typography variant="caption" color="text.secondary">
                    📅 {startDate ? startDate.toLocaleDateString() : 'Any date'} 
                    {' → '}
                    {endDate ? endDate.toLocaleDateString() : 'Any date'}
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Enhanced Transaction Table */}
      <Paper sx={{ 
        mt: 4,
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden' // Ensures the container clips its children
      }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', overflowX: 'auto' }}>
          <Table stickyHeader aria-label="transactions table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2,
                  whiteSpace: 'nowrap'
                }}>
                  📅 Date & Time
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2,
                  display: { xs: 'none', sm: 'table-cell' }
                }}>
                  🔄 Type
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2
                }}>
                  👤 Customer
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2,
                  textAlign: 'right'
                }}>
                  💰 THB
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2,
                  textAlign: 'right',
                  display: { xs: 'none', md: 'table-cell' }
                }}>
                  💵 MMK
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2,
                  textAlign: 'right',
                  display: { xs: 'none', lg: 'table-cell' }
                }}>
                  📊 Rate
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2,
                  textAlign: 'right',
                  display: { xs: 'none', lg: 'table-cell' }
                }}>
                  💯 100K Rate
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2,
                  textAlign: 'right'
                }}>
                  💎 Profit
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: '#0B1C1C', 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  py: 2,
                  textAlign: 'center',
                  width: '120px'
                }}>
                  ⚙️ Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: 2
                    }}>
                      <CircularProgress size={40} sx={{ color: 'primary.main' }} />
                      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Loading Transactions...
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Please wait while we fetch your data
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {!loading && transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      gap: 2
                    }}>
                      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                        📭 No transactions found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Start by adding your first transaction above
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {!loading && transactions.map((transaction, index) => (
                <TableRow 
                  key={transaction.id}
                  sx={{ 
                    '&:hover': { 
                      bgcolor: 'rgba(240, 242, 247, 0.3)',
                      transform: 'scale(1.001)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                    },
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                >
                  <TableCell sx={{ 
                    py: 2,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}>
                    {new Date(transaction.date_time).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell sx={{ 
                    py: 2,
                    display: { xs: 'none', sm: 'table-cell' }
                  }}>
                    <Box sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      px: 2,
                      py: 0.5,
                      borderRadius: 2,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      bgcolor: transaction.transaction_type === 'BUY' ? '#e0f2fe' : '#f3e5f5',
                      color: transaction.transaction_type === 'BUY' ? '#0277bd' : '#7b1fa2'
                    }}>
                      {transaction.transaction_type === 'BUY' ? '📈 BUY' : '📉 SELL'}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ 
                    py: 2,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    maxWidth: { xs: '100px', sm: '150px' },
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {transaction.customer}
                  </TableCell>
                  <TableCell sx={{ 
                    py: 2,
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'text.primary'
                  }}>
                    ฿{formatNumberWithCommas(transaction.thb_amount)}
                  </TableCell>
                  <TableCell sx={{ 
                    py: 2,
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'text.secondary',
                    display: { xs: 'none', md: 'table-cell' }
                  }}>
                    {formatNumberWithCommas(transaction.mmk_amount)} K
                  </TableCell>
                  <TableCell sx={{ 
                    py: 2,
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: { xs: 'none', lg: 'table-cell' }
                  }}>
                    {transaction.rate}
                  </TableCell>
                  <TableCell sx={{ 
                    py: 2,
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: { xs: 'none', lg: 'table-cell' }
                  }}>
                    {transaction.hundred_k_rate}
                  </TableCell>
                  <TableCell sx={{ 
                    py: 2,
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: '#000000' // Bold black color
                  }}>
                    ฿{formatNumberWithCommas(transaction.profit)}
                  </TableCell>
                  <TableCell sx={{ py: 2, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditClick(transaction)}
                        sx={{ 
                          color: 'primary.main',
                          '&:hover': { 
                            bgcolor: 'primary.light',
                            color: 'white',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteClick(transaction)}
                        disabled={deleteLoading}
                        sx={{ 
                          color: 'error.main',
                          '&:hover': { 
                            bgcolor: 'error.light',
                            color: 'white',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination Controls */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mt: 2, 
          mb: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 2
        }}>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            sx={{
              '& .MuiTablePagination-toolbar': {
                paddingLeft: 2,
                paddingRight: 2,
              },
              '& .MuiTablePagination-selectLabel': {
                fontWeight: 600,
                color: 'text.primary'
              },
              '& .MuiTablePagination-displayedRows': {
                fontWeight: 600,
                color: 'text.primary'
              }
            }}
          />
        </Box>
      </Paper>

      {/* Add Remaining Transactions display outside of dialog */}
      {profitData && profitData.remaining_transactions && (
        <Box mt={4} mb={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: '12px' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Remaining Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              These transactions are either partially matched or unmatched. They represent the ongoing inventory of buy/sell orders.
            </Typography>
          
            {profitData.remaining_transactions.buy.length > 0 && (
              <>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
                  Buy Transactions With Remaining Amounts ({profitData.remaining_transactions.buy.length})
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 3, borderRadius: '8px', overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#0B1C1C' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>THB Amount</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>MMK Amount</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rate</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>100K Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {profitData.remaining_transactions.buy.map((transaction, index) => (
                        <TableRow key={transaction.id || `buy-${index}`}>
                          <TableCell>{transaction.customer}</TableCell>
                          <TableCell>{new Date(transaction.date_time).toLocaleDateString('en-GB')}</TableCell>
                          <TableCell>{formatNumberWithCommas(transaction.thb_amount)} THB</TableCell>
                          <TableCell>{formatNumberWithCommas(transaction.mmk_amount)} MMK</TableCell>
                          <TableCell>{transaction.rate}</TableCell>
                          <TableCell>{transaction.hundred_k_rate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                        <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Totals & Stats:</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          {formatNumberWithCommas(
                            profitData.remaining_transactions.buy.reduce((sum, tx) => sum + parseFloat(tx.thb_amount), 0)
                          )} THB
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          {formatNumberWithCommas(
                            profitData.remaining_transactions.buy.reduce((sum, tx) => sum + parseFloat(tx.mmk_amount), 0)
                          )} MMK
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          Min: {profitData.remaining_transactions.buy.length > 0 
                            ? Math.min(...profitData.remaining_transactions.buy.map(tx => parseFloat(tx.rate))).toFixed(4) 
                            : 'N/A'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          Max: {profitData.remaining_transactions.buy.length > 0 
                            ? Math.max(...profitData.remaining_transactions.buy.map(tx => parseFloat(tx.hundred_k_rate))).toFixed(2) 
                            : 'N/A'}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </>
            )}
          
            {profitData.remaining_transactions.sell.length > 0 && (
              <>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
                  Sell Transactions With Remaining Amounts ({profitData.remaining_transactions.sell.length})
                </Typography>
                <TableContainer component={Paper} sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#0B1C1C' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>THB Amount</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>MMK Amount</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rate</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>100K Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {profitData.remaining_transactions.sell.map((transaction, index) => (
                        <TableRow key={`sell-${index}`}>
                          <TableCell>{transaction.customer}</TableCell>
                          <TableCell>{new Date(transaction.date_time).toLocaleDateString('en-GB')}</TableCell>
                          <TableCell>{formatNumberWithCommas(transaction.thb_amount)} THB</TableCell>
                          <TableCell>{formatNumberWithCommas(transaction.mmk_amount)} MMK</TableCell>
                          <TableCell>{transaction.rate}</TableCell>
                          <TableCell>{transaction.hundred_k_rate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                        <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Totals & Stats:</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          {formatNumberWithCommas(
                            profitData.remaining_transactions.sell.reduce((sum, tx) => sum + parseFloat(tx.thb_amount), 0)
                          )} THB
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          {formatNumberWithCommas(
                            profitData.remaining_transactions.sell.reduce((sum, tx) => sum + parseFloat(tx.mmk_amount), 0)
                          )} MMK
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          Max: {profitData.remaining_transactions.sell.length > 0 
                            ? Math.max(...profitData.remaining_transactions.sell.map(tx => parseFloat(tx.rate))).toFixed(4) 
                            : 'N/A'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          Min: {profitData.remaining_transactions.sell.length > 0 
                            ? Math.min(...profitData.remaining_transactions.sell.map(tx => parseFloat(tx.hundred_k_rate))).toFixed(2) 
                            : 'N/A'}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        </Box>
      )}

      {/* Profit Calculation Dialog */}
      <Dialog open={profitDialogOpen} onClose={handleProfitDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>Profit Calculation Results</DialogTitle>
        <DialogContent>
          {profitData && (
            <Box>
              <Card sx={{ mb: 3, bgcolor: 'primary.light' }}>
                <CardContent>
                  <Typography variant="h5" align="center" gutterBottom>
                Total Profit: {formatNumberWithCommas(profitData.total_profit)} THB
              </Typography>
                  <Typography variant="body2" align="center">
                    Based on {profitData.transaction_count} transactions
                    </Typography>
                  </CardContent>
                </Card>
              
              {profitData.profit_details && profitData.profit_details.length > 0 && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>
                    Profit Details
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Buy Customer</TableCell>
                          <TableCell>Sell Customer</TableCell>
                          <TableCell>Matched Amount (MMK)</TableCell>
                          <TableCell>Buy Rate</TableCell>
                          <TableCell>Sell Rate</TableCell>
                          <TableCell>Profit (THB)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {profitData.profit_details.map((detail, index) => (
                          <TableRow key={index}>
                            <TableCell>{detail.buy_customer}</TableCell>
                            <TableCell>{detail.sell_customer}</TableCell>
                            <TableCell>{formatNumberWithCommas(detail.mmk_amount)}</TableCell>
                            <TableCell>{detail.buy_rate}</TableCell>
                            <TableCell>{detail.sell_rate}</TableCell>
                            <TableCell>{formatNumberWithCommas(detail.profit)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
              
              {profitData.remaining_transactions && 
                (profitData.remaining_transactions.buy.length > 0 || profitData.remaining_transactions.sell.length > 0) && (
                <Box mt={4}>
                  <Typography variant="h6" gutterBottom>
                    Remaining Transactions
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    These transactions are either partially matched with previous transactions or haven't been matched at all. Once a transaction is fully matched, it will be removed from this list.
                  </Typography>
                  
                  {profitData.remaining_transactions.buy.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
                        Buy Transactions With Remaining Amounts ({profitData.remaining_transactions.buy.length})
                      </Typography>
                      <TableContainer component={Paper} sx={{ mb: 3, borderRadius: '8px', overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#0B1C1C' }}>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>THB Amount</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>MMK Amount</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rate</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>100K Rate</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {profitData.remaining_transactions.buy.map((transaction, index) => (
                              <TableRow key={`buy-${index}`}>
                                <TableCell>{transaction.customer}</TableCell>
                                <TableCell>{new Date(transaction.date_time).toLocaleDateString('en-GB')}</TableCell>
                                <TableCell>{formatNumberWithCommas(transaction.thb_amount)} THB</TableCell>
                                <TableCell>{formatNumberWithCommas(transaction.mmk_amount)} MMK</TableCell>
                                <TableCell>{transaction.rate}</TableCell>
                                <TableCell>{transaction.hundred_k_rate}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Totals & Stats:</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                {formatNumberWithCommas(
                                  profitData.remaining_transactions.buy.reduce((sum, tx) => sum + parseFloat(tx.thb_amount), 0)
                                )} THB
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                {formatNumberWithCommas(
                                  profitData.remaining_transactions.buy.reduce((sum, tx) => sum + parseFloat(tx.mmk_amount), 0)
                                )} MMK
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                Min: {profitData.remaining_transactions.buy.length > 0 
                                  ? Math.min(...profitData.remaining_transactions.buy.map(tx => parseFloat(tx.rate))).toFixed(4) 
                                  : 'N/A'}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                Max: {profitData.remaining_transactions.buy.length > 0 
                                  ? Math.max(...profitData.remaining_transactions.buy.map(tx => parseFloat(tx.hundred_k_rate))).toFixed(2) 
                                  : 'N/A'}
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                  
                  {profitData.remaining_transactions.sell.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
                        Sell Transactions With Remaining Amounts ({profitData.remaining_transactions.sell.length})
                      </Typography>
                      <TableContainer component={Paper} sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#0B1C1C' }}>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>THB Amount</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>MMK Amount</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rate</TableCell>
                              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>100K Rate</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {profitData.remaining_transactions.sell.map((transaction, index) => (
                              <TableRow key={`sell-${index}`}>
                                <TableCell>{transaction.customer}</TableCell>
                                <TableCell>{new Date(transaction.date_time).toLocaleDateString('en-GB')}</TableCell>
                                <TableCell>{formatNumberWithCommas(transaction.thb_amount)} THB</TableCell>
                                <TableCell>{formatNumberWithCommas(transaction.mmk_amount)} MMK</TableCell>
                                <TableCell>{transaction.rate}</TableCell>
                                <TableCell>{transaction.hundred_k_rate}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Totals & Stats:</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                {formatNumberWithCommas(
                                  profitData.remaining_transactions.sell.reduce((sum, tx) => sum + parseFloat(tx.thb_amount), 0)
                                )} THB
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                {formatNumberWithCommas(
                                  profitData.remaining_transactions.sell.reduce((sum, tx) => sum + parseFloat(tx.mmk_amount), 0)
                                )} MMK
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                Max: {profitData.remaining_transactions.sell.length > 0 
                                  ? Math.max(...profitData.remaining_transactions.sell.map(tx => parseFloat(tx.rate))).toFixed(4) 
                                  : 'N/A'}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                Min: {profitData.remaining_transactions.sell.length > 0 
                                  ? Math.min(...profitData.remaining_transactions.sell.map(tx => parseFloat(tx.hundred_k_rate))).toFixed(2) 
                                  : 'N/A'}
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleProfitDialogClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete Transaction
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this transaction?
          </DialogContentText>
          {selectedTransaction && (
            <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
              <Typography variant="body2">
                <strong>Date:</strong> {new Date(selectedTransaction.date_time).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {selectedTransaction.transaction_type}
              </Typography>
              <Typography variant="body2">
                <strong>Amount:</strong> {selectedTransaction.source_amount} {selectedTransaction.source_currency}
              </Typography>
              <Typography variant="body2">
                <strong>Profit:</strong> {selectedTransaction.profit}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="error" mt={2}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Confirmation Dialog */}
      <Dialog
        open={editConfirmOpen}
        onClose={handleEditCancel}
        aria-labelledby="edit-dialog-title"
        aria-describedby="edit-dialog-description"
      >
        <DialogTitle id="edit-dialog-title">
          Edit Transaction
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="edit-dialog-description">
            Do you want to edit this transaction?
          </DialogContentText>
          {selectedTransaction && (
            <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
              <Typography variant="body2">
                <strong>Date:</strong> {new Date(selectedTransaction.date_time).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {selectedTransaction.transaction_type}
              </Typography>
              <Typography variant="body2">
                <strong>Amount:</strong> {selectedTransaction.source_amount} {selectedTransaction.source_currency}
              </Typography>
              <Typography variant="body2">
                <strong>Profit:</strong> {selectedTransaction.profit}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleEditConfirm} 
            color="primary" 
            variant="contained"
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TransactionTable; 