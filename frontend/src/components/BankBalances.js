import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Box, Paper, Typography, Button, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, TextField, Tab, Tabs, Dialog, 
  DialogTitle, DialogContent, DialogActions, IconButton, Grid, 
  Checkbox, FormControlLabel, Select, MenuItem, InputLabel, 
  FormControl, Alert, CircularProgress, InputAdornment
} from '@mui/material';
import axios from 'axios';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import SyncIcon from '@mui/icons-material/Sync';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { 
  formatDateForDisplay,
  formatDateForAPI,
  getTodayFormatted,
  parseDateFromAPI
} from '../utils/dateUtils';

// TabPanel component for Material UI Tabs
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const BankBalances = () => {
  // State variables
  const [bankAccounts, setBankAccounts] = useState([]);
  const [thbAccounts, setThbAccounts] = useState([]);
  const [mmkAccounts, setMmkAccounts] = useState([]);
  const [dailyBalances, setDailyBalances] = useState([]);
  const [selectedDate, setSelectedDate] = useState(formatDateForAPI(new Date()));
  const [balanceSummary, setBalanceSummary] = useState(null);
  const [exchangeRate, setExchangeRate] = useState('0.8');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Tab state
  const [accountTabValue, setAccountTabValue] = useState(0);
  const [balanceTabValue, setBalanceTabValue] = useState(0);
  
  // Modal states
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    currency: 'THB',
    description: '',
    is_active: true
  });
  
  // Balance form data
  const [balanceFormData, setBalanceFormData] = useState({
    bankAccounts: [],
    date: formatDateForAPI(new Date()),
    exchangeRate: '0.8'
  });

  // Add a ref to track if we're switching tabs to prevent rate refresh
  const isTabSwitch = useRef(false);
  
  // Digits visibility state and functions
  const [digitsVisible, setDigitsVisible] = useState(false);
  
  // Toggle function for digits visibility
  const toggleDigitsVisibility = () => {
    setDigitsVisible(!digitsVisible);
  };

  // Format numbers with conditional hiding for sensitive data
  const formatSensitiveNumber = (num, unit = '') => {
    if (num === undefined || num === null) return '-';
    
    if (!digitsVisible) {
      return `****${unit ? ' ' + unit : ''}`;
    }
    
    const formattedNum = typeof num === 'number' 
      ? num.toLocaleString('en-US', { minimumFractionDigits: 2 })
      : num.toString();
    
    return `${formattedNum}${unit ? ' ' + unit : ''}`;
  };
  
  // Helper functions to save and load rates from local storage
  const saveRateToLocalStorage = (date, rate) => {
    try {
      const savedRates = JSON.parse(localStorage.getItem('exchangeRates') || '{}');
      savedRates[date] = rate;
      localStorage.setItem('exchangeRates', JSON.stringify(savedRates));
      console.log(`Saved rate ${rate} for date ${date} to local storage`);
    } catch (e) {
      console.error('Error saving rate to local storage:', e);
    }
  };
  
  const loadRateFromLocalStorage = (date) => {
    try {
      const savedRates = JSON.parse(localStorage.getItem('exchangeRates') || '{}');
      const savedRate = savedRates[date];
      console.log(`Loaded rate ${savedRate} for date ${date} from local storage`);
      return savedRate;
    } catch (e) {
      console.error('Error loading rate from local storage:', e);
      return null;
    }
  };

  // Fetch data
  useEffect(() => {
    fetchBankAccounts();
  }, []);
  
  // When date changes, fetch the exchange rate for that date
  useEffect(() => {
    if (selectedDate && !isTabSwitch.current) {
      console.log(`Date changed to ${selectedDate}, checking for saved rate...`);
      
      // Try to load from local storage first
      const localRate = loadRateFromLocalStorage(selectedDate);
      if (localRate && !isNaN(parseFloat(localRate)) && parseFloat(localRate) > 0) {
        console.log(`Using locally stored rate: ${localRate}`);
        setExchangeRate(localRate);
        // Still fetch balance summary with the local rate
        fetchBalanceSummary();
      } else {
        // If no local rate, fetch from server
        console.log('No locally stored rate, fetching from server...');
        fetchExchangeRate();
      }
    }
    // Reset the tab switch flag
    isTabSwitch.current = false;
  }, [selectedDate]);
  
  // Remove or modify this useEffect to prevent automatic rate refresh
  // when the rate changes, only refresh the summary
  useEffect(() => {
    if (selectedDate && exchangeRate) {
      // Check if rate is valid before fetching
      const parsedRate = parseFloat(exchangeRate);
      if (!isNaN(parsedRate) && parsedRate > 0) {
        console.log(`Rate changed to ${exchangeRate}, refreshing balance summary...`);
        fetchBalanceSummary();
      }
    }
  }, [selectedDate, exchangeRate]);
  
  // Split accounts by currency when account list changes
  useEffect(() => {
    if (Array.isArray(bankAccounts)) {
      setThbAccounts(bankAccounts.filter(account => account.currency === 'THB'));
      setMmkAccounts(bankAccounts.filter(account => account.currency === 'MMK'));
    } else {
      setThbAccounts([]);
      setMmkAccounts([]);
    }
  }, [bankAccounts]);

  // API calls
  const fetchBankAccounts = async () => {
    setLoading(true);
    try {
      console.log('Fetching bank accounts...');
      
      // Fetch all pages of bank accounts
      let allAccounts = [];
              let url = 'https://99moneyexchange.pythonanywhere.com/api/transactions/bank-accounts/';
      let page = 1;
      
      while (url) {
        console.log(`Fetching page ${page}...`);
        const response = await axios.get(url);
        
        if (Array.isArray(response.data)) {
          // Direct array response (not paginated)
          allAccounts = response.data;
          break;
        } else if (response.data && Array.isArray(response.data.results)) {
          // Paginated response with 'results' field
          allAccounts = allAccounts.concat(response.data.results);
          url = response.data.next; // Get next page URL
          page++;
        } else {
          // Fallback to empty array
          break;
        }
      }
      
      console.log(`Loaded ${allAccounts.length} bank accounts across ${page} page(s)`);
      setBankAccounts(allAccounts);
      setError(null);
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
      setError(`Failed to load bank accounts: ${err.message}. Please try again.`);
      // Set empty array on error to prevent filter issues
      setBankAccounts([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchExchangeRate = async () => {
    try {
      // Check local storage first, only fetch from API if not found
      const localRate = loadRateFromLocalStorage(selectedDate);
      if (localRate && !isNaN(parseFloat(localRate)) && parseFloat(localRate) > 0) {
        console.log(`Using locally stored rate for ${selectedDate}: ${localRate}`);
        setExchangeRate(localRate);
        return;
      }
      
      console.log(`Fetching exchange rate for date: ${selectedDate}`);
      const response = await axios.get(`https://99moneyexchange.pythonanywhere.com/api/transactions/exchange-rates/current/?date=${selectedDate}`);
      console.log('Exchange rate response:', response.data);
      
      if (response.data && response.data.rate) {
        const returnedRate = response.data.rate.toString();
        console.log(`Setting exchange rate from API: ${returnedRate}`);
        setExchangeRate(returnedRate);
        
        // Also save this to local storage for future use
        saveRateToLocalStorage(selectedDate, returnedRate);
      } else {
        console.log('No rate returned from API, using default 0.8');
        setExchangeRate('0.8'); // Ensure correct default
      }
      
      // If there's a note, it means we're using a rate from a different date
      if (response.data && response.data.note) {
        console.log('Exchange rate note:', response.data.note);
      }
    } catch (err) {
      console.error('Error fetching exchange rate:', err);
      // Try to load from local storage as backup
      const localRate = loadRateFromLocalStorage(selectedDate);
      if (localRate) {
        setExchangeRate(localRate);
      }
    }
  };
  
  // Add a more robust recalculation function
  const recalculateTotals = (force = false) => {
    if (!balanceSummary) return;
    
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) return;
    
    // Check if recalculation is needed - either forced or the rate is different
    if (force || Math.abs(balanceSummary.rate - rate) > 0.0001) {
      console.log(`Recalculating totals with rate ${rate} (old rate: ${balanceSummary.rate})`);
      
      const mmkTotal = balanceSummary.mmk_total || 0;
      const thbTotal = balanceSummary.thb_total || 0;
      
      // Calculate MMK in THB using the current rate
      const mmkInThb = mmkTotal / rate;
      const grandTotal = thbTotal + mmkInThb;
      
      console.log(`New calculations: MMK in THB = ${mmkInThb.toFixed(2)}, Grand Total = ${grandTotal.toFixed(2)}`);
      
      // Update the balance summary with new calculated values
      setBalanceSummary({
        ...balanceSummary,
        rate: rate,
        mmk_in_thb: mmkInThb,
        grand_total_thb: grandTotal
      });
    }
  };

  // Add this new useEffect to detect tab visibility changes
  useEffect(() => {
    // Function to handle when the page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, recalculating with current rate');
        recalculateTotals(true);
      }
    };

    // Add listener for visibility changes (when switching tabs)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [balanceSummary, exchangeRate]);

  // Add another effect to force recalculation when the component re-renders with existing data
  useEffect(() => {
    if (balanceSummary && exchangeRate) {
      console.log('Component updated, checking if recalculation is needed');
      recalculateTotals(false);
    }
  }, [balanceSummary, exchangeRate]);

  // Update tab handlers to trigger recalculation
  const handleAccountTabChange = (event, newValue) => {
    isTabSwitch.current = true;
    setAccountTabValue(newValue);
    
    // When returning to account tab 0 (which has balance summary), recalculate
    if (newValue === 0 && balanceSummary) {
      setTimeout(() => recalculateTotals(true), 0);
    }
  };

  const handleBalanceTabChange = (event, newValue) => {
    isTabSwitch.current = true;
    setBalanceTabValue(newValue);
  };
  
  // Save exchange rate function
  const handleSaveExchangeRate = async () => {
    if (!selectedDate || !exchangeRate) {
      setError('Date and exchange rate are required');
      return;
    }
    
    // Validate the exchange rate
    let rate;
    try {
      rate = parseFloat(exchangeRate);
      if (isNaN(rate) || rate <= 0) {
        setError('Please enter a valid exchange rate greater than zero');
        return;
      }
    } catch (err) {
      setError('Please enter a valid numeric exchange rate');
      return;
    }
    
    setLoading(true);
    try {
      // Save the rate using the update_or_create endpoint
      const response = await axios.post('https://99moneyexchange.pythonanywhere.com/api/transactions/exchange-rates/update_or_create/', {
        date: selectedDate,
        rate: rate
      });
      
      console.log('Exchange rate saved:', response.data);
      
      // Save rate to local storage for this date
      saveRateToLocalStorage(selectedDate, rate.toString());
      
      // Force recalculation with the saved rate
      recalculateTotals(true);
      
      setError(null);
      // Show brief success message
      setError('Exchange rate saved successfully!');
      setTimeout(() => setError(null), 2000);
    } catch (err) {
      console.error('Error saving exchange rate:', err);
      if (err.response && err.response.data) {
        setError(`Failed to save exchange rate: ${JSON.stringify(err.response.data)}`);
      } else {
        setError('Failed to save exchange rate. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Update fetchBalanceSummary to be more robust
  const fetchBalanceSummary = async () => {
    setLoading(true);
    try {
      // Get the current rate, ensure it's valid
      let rateToUse = exchangeRate;
      if (!rateToUse || isNaN(parseFloat(rateToUse)) || parseFloat(rateToUse) <= 0) {
        rateToUse = loadRateFromLocalStorage(selectedDate) || '0.8';
      }
      
      const rateValue = parseFloat(rateToUse);
      console.log(`Fetching balance summary with rate: ${rateValue}`);
      
      const formattedDate = formatDateForAPI(selectedDate);
      const url = `https://99moneyexchange.pythonanywhere.com/api/transactions/balances/summary/?date=${formattedDate}&rate=${rateValue}`;
      console.log(`Fetching balance summary from: ${url}`);
      const response = await axios.get(url);
      
      if (response.data) {
        // IMPORTANT: Force the rate in the response to match our current rate
        response.data.rate = rateValue;
        
        // IMPORTANT: Recalculate MMK in THB and grand total with our rate
        if (response.data.mmk_total) {
          const mmkTotal = response.data.mmk_total;
          const thbTotal = response.data.thb_total || 0;
          
          // Calculate with our rate
          response.data.mmk_in_thb = mmkTotal / rateValue;
          response.data.grand_total_thb = thbTotal + response.data.mmk_in_thb;
          
          console.log(`Calculated values with rate ${rateValue}:`);
          console.log(`- MMK in THB: ${response.data.mmk_in_thb.toFixed(2)}`);
          console.log(`- Grand Total: ${response.data.grand_total_thb.toFixed(2)}`);
        }
        
        setBalanceSummary(response.data);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching balance summary:', err);
      console.error('Error response:', err.response?.data);
      console.error('Status code:', err.response?.status);
      
      if (err.response && err.response.data && err.response.data.error === 'No balance data found') {
        setError('No balance data found for the selected date. Please add balances first.');
        setBalanceSummary(null);
      } else {
        setError(`Failed to load balance summary: ${err.response?.status} ${err.response?.statusText || err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle date change 
  const handleDateChange = (event) => {
    const newDate = event.target.value;
    setSelectedDate(newDate);
    // This will trigger the useEffect that fetches the exchange rate
  };
  
  // Handle form submissions
  const handleAccountSubmit = async () => {
    setLoading(true);
    
    try {
      if (editingAccount) {
        // Update existing account
        await axios.put(`https://99moneyexchange.pythonanywhere.com/api/transactions/bank-accounts/${editingAccount.id}/`, accountFormData);
      } else {
        // Create new account
        await axios.post('https://99moneyexchange.pythonanywhere.com/api/transactions/bank-accounts/', accountFormData);
      }
      
      // Refresh accounts list
      fetchBankAccounts();
      setShowAccountModal(false);
      setError(null);
    } catch (err) {
      console.error('Error saving bank account:', err);
      setError('Failed to save bank account. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleBalanceSubmit = async () => {
    if (!balanceFormData.date) {
      setError('Please select a date for the balances');
      return;
    }
    
    // Validate exchange rate
    const exchangeRateValue = balanceFormData.exchangeRate;
    let rate;
    try {
      rate = parseFloat(exchangeRateValue);
      if (isNaN(rate) || rate <= 0) {
        setError('Please enter a valid exchange rate greater than zero');
        return;
      }
    } catch (err) {
      setError('Please enter a valid numeric exchange rate');
      return;
    }
    
    // Collect balance data from the form inputs
    const balances = [];
    bankAccounts.forEach(account => {
      const balanceInput = document.getElementById(`balance-${account.id}`);
      if (balanceInput && balanceInput.value) {
        balances.push({
          bank_account: account.id,
          balance: parseFloat(balanceInput.value),
          notes: document.getElementById(`notes-${account.id}`)?.value || ''
        });
      }
    });
    
    console.log('Collected balance data:', balances);
    
    if (balances.length === 0) {
      setError('Please enter at least one balance value');
      return;
    }
    
    const requestData = {
      date: balanceFormData.date,
      balances: balances
    };
    
    console.log('Submitting balance data:', requestData);
    console.log('Exchange rate value:', rate, 'Original value:', exchangeRateValue);
    
    setLoading(true);
    try {
      // Use the update_or_create endpoint to handle the exchange rate
      await axios.post('https://99moneyexchange.pythonanywhere.com/api/transactions/exchange-rates/update_or_create/', {
        date: balanceFormData.date,
        rate: rate
      });
      
      // Then save the balances
      const response = await axios.post('https://99moneyexchange.pythonanywhere.com/api/transactions/daily-balances/batch_update/', requestData);
      console.log('Balance submission response:', response.data);
      
      // Refresh summary with new data
      setSelectedDate(balanceFormData.date);
      setExchangeRate(String(rate)); // Ensure the rate is stored as a string
      setShowBalanceModal(false);
      fetchBalanceSummary();
      setError(null);
    } catch (err) {
      console.error('Error saving balances:', err);
      if (err.response && err.response.data) {
        // Display more detailed error message if available
        setError(`Failed to save balances: ${JSON.stringify(err.response.data)}`);
      } else {
        setError('Failed to save balances. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle account operations
  const handleAddAccount = () => {
    setEditingAccount(null);
    setAccountFormData({
      name: '',
      currency: 'THB',
      description: '',
      is_active: true
    });
    setShowAccountModal(true);
  };
  
  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setAccountFormData({
      name: account.name,
      currency: account.currency,
      description: account.description || '',
      is_active: account.is_active
    });
    setShowAccountModal(true);
  };
  
  // Balance operations
  const handleAddBalances = () => {
    // Make sure the exchange rate is a valid number (defaults to 0.8 if invalid)
    const validExchangeRate = (!exchangeRate || isNaN(parseFloat(exchangeRate)) || parseFloat(exchangeRate) <= 0) 
      ? '0.8' 
      : String(exchangeRate);
    
    // Reset form data with current date
    setBalanceFormData({
      bankAccounts: [],
      date: formatDateForAPI(selectedDate),
      exchangeRate: validExchangeRate
    });
    
    // Pre-populate with existing balances if available
    if (balanceSummary) {
      const prePopulatedBankAccounts = [];
      
      // Add THB accounts
      if (balanceSummary.thb_accounts) {
        balanceSummary.thb_accounts.forEach(account => {
          prePopulatedBankAccounts.push({
            id: account.id,
            balance: account.balance,
            notes: account.notes || ''
          });
        });
      }
      
      // Add MMK accounts
      if (balanceSummary.mmk_accounts) {
        balanceSummary.mmk_accounts.forEach(account => {
          prePopulatedBankAccounts.push({
            id: account.id,
            balance: account.balance,
            notes: account.notes || ''
          });
        });
      }
      
      // Update form data with pre-populated values
      setBalanceFormData(prev => ({
        ...prev,
        bankAccounts: prePopulatedBankAccounts,
        date: formatDateForAPI(selectedDate),
        exchangeRate: balanceSummary.rate ? String(balanceSummary.rate) : validExchangeRate
      }));
    }
    
    setShowBalanceModal(true);
  };
  
  // Export data
  const handleExportBalances = () => {
    try {
      setLoading(true);
      
      // Create the export URL
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/api/transactions/balances/export/?date=${selectedDate}&rate=${exchangeRate}`;
      
      console.log('Exporting balances from URL:', url);
      
      // Use fetch API to get the file directly
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.blob();
        })
        .then(blob => {
          // Create a blob URL for the file
          const blobUrl = window.URL.createObjectURL(blob);
          
          // Create a temporary link element to download the file
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = blobUrl;
          a.download = `bank_balances_${selectedDate}.csv`;
          
          // Append, click and remove the link
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          window.URL.revokeObjectURL(blobUrl);
          document.body.removeChild(a);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error downloading file:', error);
          setError(`Download failed: ${error.message}`);
          setLoading(false);
        });
      
    } catch (error) {
      console.error('Error exporting balances:', error);
      setError('Failed to export balances. Please try again.');
      setLoading(false);
    }
  };
  
  // Modify the exchange rate change handler to be more aggressive with recalculation
  const handleExchangeRateChange = (event) => {
    const newRateStr = event.target.value;
    setExchangeRate(newRateStr);
    
    // Trigger immediate recalculation if we have a valid rate and existing data
    const newRate = parseFloat(newRateStr);
    if (!isNaN(newRate) && newRate > 0 && balanceSummary) {
      // Force recalculation with the new rate
      setTimeout(() => {
        const updatedSummary = {
          ...balanceSummary,
          rate: newRate
        };
        
        // Recalculate MMK in THB and grand total
        if (updatedSummary.mmk_total) {
          updatedSummary.mmk_in_thb = updatedSummary.mmk_total / newRate;
          updatedSummary.grand_total_thb = (updatedSummary.thb_total || 0) + updatedSummary.mmk_in_thb;
        }
        
        // Update the state with recalculated values
        setBalanceSummary(updatedSummary);
        
        console.log(`Immediate recalculation with rate ${newRate}:`);
        console.log(`- MMK in THB: ${updatedSummary.mmk_in_thb?.toFixed(2)}`);
        console.log(`- Grand Total: ${updatedSummary.grand_total_thb?.toFixed(2)}`);
      }, 0);
    }
  };
  
  // Render sections
  const renderAccountsTable = (accounts) => {
    return (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">No accounts found</TableCell>
              </TableRow>
            ) : (
              accounts.map(account => (
                <TableRow key={account.id}>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>{account.currency}</TableCell>
                  <TableCell>{account.description}</TableCell>
                  <TableCell align="center">
                    <IconButton 
                      color="primary" 
                      size="small" 
                      onClick={() => handleEditAccount(account)}
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };
  
  const renderBalanceSummary = () => {
    if (!balanceSummary) return null;
    
    // Safety check for missing account arrays
    const thbAccounts = balanceSummary.thb_accounts || [];
    const mmkAccounts = balanceSummary.mmk_accounts || [];
    
    return (
      <Paper elevation={2} sx={{ mb: 4, p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Balance Summary - {formatDateForDisplay(selectedDate)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              label="Rate (MMK/THB)"
              type="number"
              value={exchangeRate}
              onChange={handleExchangeRateChange}
              size="small"
              sx={{ width: '150px', mr: 1 }}
              InputProps={{
                inputProps: { 
                  min: 0.0001, 
                  step: 0.0001 
                },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton 
                      size="small" 
                      color="primary" 
                      onClick={fetchBalanceSummary}
                    >
                      <SyncIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleSaveExchangeRate}
              startIcon={<SaveIcon />}
              disabled={loading}
            >
              Save Rate
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={2}>
          {/* THB Accounts */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>THB Accounts</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell align="right">Balance (THB)</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {thbAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">No THB accounts found</TableCell>
                    </TableRow>
                  ) : (
                    thbAccounts.map(account => (
                      <TableRow key={account.id}>
                        <TableCell>{account.name}</TableCell>
                        <TableCell align="right">
                          {formatSensitiveNumber(account.balance, 'THB')}
                        </TableCell>
                        <TableCell>{account.notes}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow sx={{ bgcolor: 'primary.light' }}>
                    <TableCell><strong>Total THB</strong></TableCell>
                    <TableCell align="right">
                      <strong>
                        {formatSensitiveNumber(balanceSummary.thb_total, 'THB')}
                      </strong>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          {/* MMK Accounts */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>MMK Accounts</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell align="right">Balance (MMK)</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mmkAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">No MMK accounts found</TableCell>
                    </TableRow>
                  ) : (
                    mmkAccounts.map(account => (
                      <TableRow key={account.id}>
                        <TableCell>{account.name}</TableCell>
                        <TableCell align="right">
                          {formatSensitiveNumber(account.balance, 'MMK')}
                        </TableCell>
                        <TableCell>{account.notes}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow sx={{ bgcolor: 'primary.light' }}>
                    <TableCell><strong>Total MMK</strong></TableCell>
                    <TableCell align="right">
                      <strong>
                        {formatSensitiveNumber(balanceSummary.mmk_total, 'MMK')}
                      </strong>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
        
        {/* Summary Box */}
        <Paper elevation={1} sx={{ mt: 3, p: 2, bgcolor: 'background.default' }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell><strong>Total THB:</strong></TableCell>
                <TableCell align="right">
                  {formatSensitiveNumber(balanceSummary.thb_total, 'THB')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>Total MMK:</strong></TableCell>
                <TableCell align="right">
                  {formatSensitiveNumber(balanceSummary.mmk_total, 'MMK')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>Exchange Rate:</strong></TableCell>
                <TableCell align="right">{digitsVisible ? exchangeRate : '****'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>MMK in THB:</strong></TableCell>
                <TableCell align="right">
                  {formatSensitiveNumber(balanceSummary.mmk_in_thb, 'THB')}
                </TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: 'success.light' }}>
                <TableCell><strong>Grand Total (THB):</strong></TableCell>
                <TableCell align="right">
                  <strong>
                    {formatSensitiveNumber(balanceSummary.grand_total_thb, 'THB')}
                  </strong>
                </TableCell>
              </TableRow>
              {/* Difference Between Consecutive Days */}
              {balanceSummary.difference !== undefined && (
                <TableRow sx={{ 
                  bgcolor: balanceSummary.difference > 0 ? 'rgba(76, 175, 80, 0.1)' : 
                           balanceSummary.difference < 0 ? 'rgba(244, 67, 54, 0.1)' : 'inherit',
                  borderTop: '1px dashed #ccc'
                }}>
                  <TableCell><strong>Difference Between Consecutive Days:</strong></TableCell>
                  <TableCell align="right">
                    <Typography 
                      sx={{ 
                        fontWeight: 'bold',
                        color: balanceSummary.difference > 0 ? 'success.main' : 
                               balanceSummary.difference < 0 ? 'error.main' : 'inherit'
                      }}
                    >
                      {balanceSummary.difference > 0 ? '+' : ''}
                      {formatSensitiveNumber(balanceSummary.difference, '')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Paper>
    );
  };
  
  // Modals
  const renderAccountModal = () => {
    return (
      <Dialog 
        open={showAccountModal} 
        onClose={() => setShowAccountModal(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              label="Account Name"
              fullWidth
              margin="normal"
              value={accountFormData.name}
              onChange={(e) => setAccountFormData({...accountFormData, name: e.target.value})}
              required
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Currency</InputLabel>
              <Select
                value={accountFormData.currency}
                label="Currency"
                onChange={(e) => setAccountFormData({...accountFormData, currency: e.target.value})}
              >
                <MenuItem value="THB">THB - Thai Baht</MenuItem>
                <MenuItem value="MMK">MMK - Myanmar Kyat</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Description"
              fullWidth
              margin="normal"
              multiline
              rows={2}
              value={accountFormData.description}
              onChange={(e) => setAccountFormData({...accountFormData, description: e.target.value})}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={accountFormData.is_active}
                  onChange={(e) => setAccountFormData({...accountFormData, is_active: e.target.checked})}
                />
              }
              label="Active"
              sx={{ mt: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAccountModal(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAccountSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  const renderBalanceModal = () => {
    return (
      <Dialog 
        open={showBalanceModal} 
        onClose={() => setShowBalanceModal(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {`${formatDateForDisplay(selectedDate)} Bank Balances`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={6} md={4} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={balanceFormData.date}
                  onChange={(e) => setBalanceFormData(prev => ({ ...prev, date: e.target.value }))}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  helperText=" "
                />
              </Grid>
              <Grid item xs={6} md={4} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Exchange Rate"
                  type="number"
                  value={balanceFormData.exchangeRate}
                  onChange={(e) => setBalanceFormData(prev => ({ ...prev, exchangeRate: e.target.value }))}
                  InputProps={{
                    inputProps: { 
                      min: 0.0001, 
                      step: 0.0001 
                    }
                  }}
                  helperText="MMK per THB (must be greater than zero)"
                  error={balanceFormData.exchangeRate && (isNaN(parseFloat(balanceFormData.exchangeRate)) || parseFloat(balanceFormData.exchangeRate) <= 0)}
                />
              </Grid>
            </Grid>
          </Box>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
            <Tabs 
              value={balanceTabValue} 
              onChange={handleBalanceTabChange}
              aria-label="balance tabs"
            >
              <Tab label="THB Accounts" />
              <Tab label="MMK Accounts" />
            </Tabs>
          </Box>
          
          <TabPanel value={balanceTabValue} index={0}>
            {thbAccounts.length === 0 ? (
              <Typography>No THB accounts found. Please add some first.</Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell>Balance</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {thbAccounts.map(account => (
                      <TableRow key={account.id}>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>
                          <TextField
                            id={`balance-${account.id}`}
                            type="number"
                            inputProps={{ 
                              step: "0.01",
                              min: "0"
                            }}
                            size="small"
                            fullWidth
                            placeholder="Enter balance"
                            defaultValue={balanceFormData.bankAccounts.find(a => a.id === account.id)?.balance || ''}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            id={`notes-${account.id}`}
                            size="small"
                            fullWidth
                            placeholder="Optional notes"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
          
          <TabPanel value={balanceTabValue} index={1}>
            {mmkAccounts.length === 0 ? (
              <Typography>No MMK accounts found. Please add some first.</Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell>Balance</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mmkAccounts.map(account => (
                      <TableRow key={account.id}>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>
                          <TextField
                            id={`balance-${account.id}`}
                            type="number"
                            inputProps={{ 
                              step: "0.01",
                              min: "0"
                            }}
                            size="small"
                            fullWidth
                            placeholder="Enter balance"
                            defaultValue={balanceFormData.bankAccounts.find(a => a.id === account.id)?.balance || ''}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            id={`notes-${account.id}`}
                            size="small"
                            fullWidth
                            placeholder="Optional notes"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBalanceModal(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleBalanceSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            Save Balances
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  return (
    <Container maxWidth="lg">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Paper elevation={3} sx={{ mb: 4 }}>
        <Box sx={{ 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid #eaeaea'
        }}>
          <Typography variant="h5">Bank Accounts and Balances</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              type="date"
              size="small"
              value={selectedDate}
              onChange={handleDateChange}
              sx={{ mr: 1 }}
              InputLabelProps={{
                shrink: true,
              }}
            />
            <Button 
              variant="outlined" 
              startIcon={digitsVisible ? <VisibilityOffIcon /> : <VisibilityIcon />} 
              onClick={toggleDigitsVisibility}
              sx={{ mr: 1, bgcolor: 'white' }}
              title={digitsVisible ? "Hide sensitive numbers" : "Show sensitive numbers"}
            >
              {digitsVisible ? 'Hide' : 'Show'}
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={fetchBalanceSummary}
              sx={{ mr: 1 }}
            >
              View
            </Button>
            <Button 
              variant="contained" 
              color="success" 
              startIcon={<AddIcon />}
              onClick={handleAddBalances}
              sx={{ mr: 1 }}
            >
              Add/Edit Balances
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<DownloadIcon />}
              onClick={handleExportBalances}
            >
              Export
            </Button>
          </Box>
        </Box>
        
        <Box sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Render balance summary */}
              {renderBalanceSummary()}
              
              {/* Accounts management */}
              <Paper elevation={2} sx={{ p: 2 }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mb: 2
                }}>
                  <Typography variant="h6">Manage Bank Accounts</Typography>
                  <Button 
                    variant="contained" 
                    color="success" 
                    size="small" 
                    startIcon={<AddIcon />}
                    onClick={handleAddAccount}
                  >
                    Add Account
                  </Button>
                </Box>
                
                {bankAccounts.length === 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    You haven't created any bank accounts yet. Click the "Add Account" button to get started.
                  </Alert>
                )}
                
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs 
                    value={accountTabValue} 
                    onChange={handleAccountTabChange} 
                    aria-label="account tabs"
                  >
                    <Tab label="THB Accounts" />
                    <Tab label="MMK Accounts" />
                  </Tabs>
                </Box>
                
                <TabPanel value={accountTabValue} index={0}>
                  {renderAccountsTable(thbAccounts)}
                </TabPanel>
                
                <TabPanel value={accountTabValue} index={1}>
                  {renderAccountsTable(mmkAccounts)}
                </TabPanel>
              </Paper>
            </>
          )}
        </Box>
      </Paper>
      
      {/* Modals */}
      {renderAccountModal()}
      {renderBalanceModal()}
    </Container>
  );
};

export default BankBalances; 