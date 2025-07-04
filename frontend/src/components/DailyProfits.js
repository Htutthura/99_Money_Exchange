import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { subDays, startOfWeek, startOfMonth } from 'date-fns';
import axios from 'axios';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { formatDateTime, formatDateForAPI, formatDateLong } from '../utils/dateUtils';
import { safeParseFloat, formatNumberWithCommas, isValidNumber } from '../utils/numberUtils';

const API_BASE_URL = 'https://99moneyexchange.pythonanywhere.com/api/transactions/';

const quickRanges = [
  { label: 'Today', getRange: () => [new Date(), new Date()] },
  { label: 'Yesterday', getRange: () => [subDays(new Date(), 1), subDays(new Date(), 1)] },
  { label: 'This Week', getRange: () => [startOfWeek(new Date(), { weekStartsOn: 1 }), new Date()] },
  { label: 'This Month', getRange: () => [startOfMonth(new Date()), new Date()] },
];

const DailyProfits = () => {
  const [dateMode, setDateMode] = useState('single'); // 'single' or 'range'
  const [singleDate, setSingleDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [profits, setProfits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState(null);

  const calculateDailyProfits = async (date) => {
    try {
      const formattedDate = formatDateForAPI(date);
      console.log('Calculating profits for date:', formattedDate);
      
      // Calculate profits using the main calculate_profits endpoint
      const response = await fetch(`${API_BASE_URL}calculate_profits/?timestamp=${new Date().getTime()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to calculate profits');
      }
      
      // Get the calculated profits data
      const profitsData = await response.json();
      
      // Now we have a daily-profits/calculate endpoint, let's use it
      const dailyProfitResponse = await fetch(`${API_BASE_URL}daily-profits/calculate/?date=${formattedDate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      if (!dailyProfitResponse.ok) {
        if (dailyProfitResponse.status === 404) {
          console.warn('Daily profits endpoint not found, falling back to manual calculation');
          // Fall back to manual calculation
          const transactions = await fetchTransactionsForRange(formattedDate, formattedDate);
          const dailyProfitData = calculateProfitsFromTransactions(transactions);
          
          // Return a simplified object that matches the expected structure
          return {
            date: formattedDate,
            total_profit: dailyProfitData.totalProfit,
            buy_sell_profit: dailyProfitData.totalProfit - dailyProfitData.otherProfit,
            other_profit: dailyProfitData.otherProfit,
            transactionCount: dailyProfitData.transactionCount
          };
        }
        const errorData = await dailyProfitResponse.json();
        throw new Error(errorData.detail || 'Failed to calculate daily profits');
      }

      return await dailyProfitResponse.json();
    } catch (err) {
      console.error('Error calculating daily profits:', err);
      throw err;
    }
  };

  const fetchTransactionsForRange = async (start, end) => {
    // Fetch all transactions for the date range (inclusive) or single day
    try {
      const params = {
        start_date: start,
        end_date: end,
        timestamp: new Date().getTime(),
        page_size: 10000, // Request all transactions without pagination limit
        page: 1
      };
      const response = await axios.get(`${API_BASE_URL}list/`, {
        params,
        withCredentials: true,
      });
      return Array.isArray(response.data) ? response.data : (response.data.results || []);
    } catch (error) {
      console.error('Error fetching transactions for range:', error);
      return [];
    }
  };

  const calculateProfitsFromTransactions = (transactions) => {
    // Sort transactions chronologically
    const sorted = [...transactions].sort((a, b) => new Date(a.date_time) - new Date(b.date_time));
    const buys = sorted.filter(tx => tx.transaction_type === 'BUY');
    const sells = sorted.filter(tx => tx.transaction_type === 'SELL');
    const others = sorted.filter(tx => tx.transaction_type === 'OTHER');

    let buyQueue = buys.map(tx => ({ ...tx, mmk_remaining: tx.mmk_amount }));
    let sellQueue = sells.map(tx => ({ ...tx, mmk_remaining: tx.mmk_amount }));
    let matched = [];
    let totalProfit = 0;

    // Match BUY and SELL transactions
    while (buyQueue.length > 0 && sellQueue.length > 0) {
      let buy = buyQueue[0];
      let sell = sellQueue[0];
      
      // Validate rates to prevent division by zero
      const buyRate = safeParseFloat(buy.rate, 0);
      const sellRate = safeParseFloat(sell.rate, 0);
      
      if (buyRate <= 0 || sellRate <= 0) {
        console.warn('Invalid rate detected, skipping transaction match:', { buy: buy.rate, sell: sell.rate });
        buyQueue.shift();
        sellQueue.shift();
        continue;
      }
      
      const buyMmk = safeParseFloat(buy.mmk_remaining, 0);
      const sellMmk = safeParseFloat(sell.mmk_remaining, 0);
      const matchAmount = Math.min(buyMmk, sellMmk);
      
      if (matchAmount <= 0) {
        console.warn('Invalid match amount, skipping:', { buyMmk, sellMmk });
        buyQueue.shift();
        sellQueue.shift();
        continue;
      }
      
      // Calculate profit for this match
      const profit = (matchAmount / sellRate) - (matchAmount / buyRate);
      
      // Validate profit calculation
      if (!isFinite(profit)) {
        console.warn('Invalid profit calculation, skipping match:', { matchAmount, buyRate, sellRate });
        buyQueue.shift();
        sellQueue.shift();
        continue;
      }
      
      matched.push({
        buy_customer: buy.customer,
        sell_customer: sell.customer,
        buy_time: buy.date_time,
        sell_time: sell.date_time,
        matched_mmk: matchAmount,
        buy_rate: buyRate,
        sell_rate: sellRate,
        matched_thb: matchAmount / buyRate,
        profit: profit,
      });
      totalProfit += profit;
      buy.mmk_remaining -= matchAmount;
      sell.mmk_remaining -= matchAmount;
      if (buy.mmk_remaining <= 0.0001) buyQueue.shift();
      if (sell.mmk_remaining <= 0.0001) sellQueue.shift();
    }

    // Add profits from OTHER transactions
    const otherProfit = others.reduce((sum, tx) => sum + (parseFloat(tx.profit) || 0), 0);
    totalProfit += otherProfit;

    return {
      matched,
      totalProfit,
      otherProfit,
      buyCount: buys.length,
      sellCount: sells.length,
      transactionCount: sorted.length,
      thbVolume: sorted.reduce((sum, tx) => sum + (parseFloat(tx.thb_amount) || 0), 0),
      mmkVolume: sorted.reduce((sum, tx) => sum + (parseFloat(tx.mmk_amount) || 0), 0),
    };
  };

  const fetchBreakdownForRange = async (start, end) => {
    try {
      const params = {
        start_date: start,
        end_date: end,
        timestamp: new Date().getTime(),
        page_size: 10000, // Request all transactions without pagination limit
        page: 1
      };
      const response = await axios.get(`${API_BASE_URL}list/`, {
        params,
        withCredentials: true,
        validateStatus: (status) => status >= 200 && status < 500 // treat 404 as valid
      });
      if (response.status === 404) {
        // No data found, return empty array
        return [];
      }
      return Array.isArray(response.data) ? response.data : (response.data.results || []);
    } catch (error) {
      // Never setError here, just log and return empty array
      console.error('Error fetching breakdown for range:', error);
      return [];
    }
  };

  // Utility to get all dates in a range (inclusive)
  const getDatesInRange = (start, end) => {
    const dateArray = [];
    let currentDate = new Date(start);
    const endDate = new Date(end);
    while (currentDate <= endDate) {
      dateArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dateArray;
  };

  const fetchProfits = async () => {
    setLoading(true);
    setError(null);
    try {
      let start, end;
      if (dateMode === 'single') {
        start = formatDateForAPI(singleDate);
        end = start;
      } else {
        start = formatDateForAPI(startDate);
        end = formatDateForAPI(endDate);
      }

      let profitsArr = [];
      let summaryTotals = {
        totalProfit: 0,
        transactionCount: 0,
        thbVolume: 0,
        mmkVolume: 0,
        buyCount: 0,
        sellCount: 0,
      };
      let breakdownAll = [];

      if (dateMode === 'single') {
        // For single date, use the existing single-date calculation
        try {
          const dailyResult = await calculateDailyProfits(singleDate);
          profitsArr.push({
            date: start,
            total_profit: dailyResult.total_profit || 0,
            buy_sell_profit: dailyResult.buy_sell_profit || 0,
            other_profit: dailyResult.other_profit || 0,
            transactionCount: dailyResult.transactionCount || 0,
            thbVolume: 0, // We'll calculate these from transactions
            mmkVolume: 0,
            buyCount: 0,
            sellCount: 0,
          });
          
          summaryTotals.totalProfit += safeParseFloat(dailyResult.total_profit, 0);
          summaryTotals.transactionCount += safeParseFloat(dailyResult.transactionCount, 0);
          
          // Get transaction details for volume and breakdown calculations
          const transactions = await fetchTransactionsForRange(start, start);
          const calc = calculateProfitsFromTransactions(transactions);
          
          // Update the profit entry with volume and count data
          const lastEntry = profitsArr[profitsArr.length - 1];
          lastEntry.thbVolume = calc.thbVolume;
          lastEntry.mmkVolume = calc.mmkVolume;
          lastEntry.buyCount = calc.buyCount;
          lastEntry.sellCount = calc.sellCount;
          lastEntry.transactionCount = calc.transactionCount; // Use actual transaction count from fetched data
          
          summaryTotals.thbVolume += calc.thbVolume;
          summaryTotals.mmkVolume += calc.mmkVolume;
          summaryTotals.buyCount += calc.buyCount;
          summaryTotals.sellCount += calc.sellCount;
          summaryTotals.transactionCount = calc.transactionCount; // Use actual count

          if (calc.matched.length > 0) {
            breakdownAll = breakdownAll.concat(calc.matched.map(m => ({ ...m, date: start })));
          }
        } catch (error) {
          console.error(`Error calculating daily profits for ${start}:`, error);
          // Fall back to manual calculation for this date
          const transactions = await fetchTransactionsForRange(start, start);
          const calc = calculateProfitsFromTransactions(transactions);
          profitsArr.push({
            date: start,
            total_profit: calc.totalProfit,
            buy_sell_profit: calc.totalProfit - calc.otherProfit,
            other_profit: calc.otherProfit,
            transactionCount: calc.transactionCount,
            thbVolume: calc.thbVolume,
            mmkVolume: calc.mmkVolume,
            buyCount: calc.buyCount,
            sellCount: calc.sellCount,
          });
          
          summaryTotals.totalProfit += safeParseFloat(calc.totalProfit, 0);
          summaryTotals.transactionCount += safeParseFloat(calc.transactionCount, 0);
          summaryTotals.thbVolume += calc.thbVolume;
          summaryTotals.mmkVolume += calc.mmkVolume;
          summaryTotals.buyCount += calc.buyCount;
          summaryTotals.sellCount += calc.sellCount;
          
          if (calc.matched.length > 0) {
            breakdownAll = breakdownAll.concat(calc.matched.map(m => ({ ...m, date: start })));
          }
        }
      } else {
        // For date range, try the date range endpoint for better performance
        // If it doesn't exist (404), fall back to day-by-day calculation silently
        try {
          const response = await fetch(`${API_BASE_URL}daily-profits/calculate-range/?start_date=${start}&end_date=${end}&timestamp=${new Date().getTime()}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            credentials: 'include',
          });

          if (!response.ok) {
            if (response.status === 404) {
              // Endpoint not deployed yet, silently fall back to day-by-day calculation
              throw new Error('ENDPOINT_NOT_FOUND');
            }
            throw new Error(`Date range calculation failed: ${response.status}`);
          }

          const rangeResult = await response.json();
          
          // Validate and sanitize response data
          const totalProfit = safeParseFloat(rangeResult.total_profit, 0);
          const buySellProfit = safeParseFloat(rangeResult.buy_sell_profit, 0);
          const otherProfit = safeParseFloat(rangeResult.other_profit, 0);
          const transactionCount = safeParseFloat(rangeResult.transaction_count, 0);
          
          console.log('Range result validation:', {
            raw: rangeResult,
            parsed: { totalProfit, buySellProfit, otherProfit, transactionCount }
          });
          
          // Create a single entry for the date range
          profitsArr.push({
            date: `${start} to ${end}`,
            total_profit: totalProfit,
            buy_sell_profit: buySellProfit,
            other_profit: otherProfit,
            transactionCount: transactionCount,
            thbVolume: 0, // We'll calculate these from transactions
            mmkVolume: 0,
            buyCount: 0,
            sellCount: 0,
          });
          
          summaryTotals.totalProfit = safeParseFloat(rangeResult.total_profit, 0);
          summaryTotals.transactionCount = safeParseFloat(rangeResult.transaction_count, 0);
          
          // Get transaction details for volume and count calculations
          const transactions = await fetchTransactionsForRange(start, end);
          const calc = calculateProfitsFromTransactions(transactions);
          
          // Update the profit entry with volume and count data
          const lastEntry = profitsArr[profitsArr.length - 1];
          lastEntry.thbVolume = calc.thbVolume;
          lastEntry.mmkVolume = calc.mmkVolume;
          lastEntry.buyCount = calc.buyCount;
          lastEntry.sellCount = calc.sellCount;
          lastEntry.transactionCount = calc.transactionCount; // Use actual transaction count
          
          summaryTotals.thbVolume = calc.thbVolume;
          summaryTotals.mmkVolume = calc.mmkVolume;
          summaryTotals.buyCount = calc.buyCount;
          summaryTotals.sellCount = calc.sellCount;
          summaryTotals.transactionCount = calc.transactionCount; // Use actual count

          // Use profit details from the backend response
          if (rangeResult.profit_details && rangeResult.profit_details.length > 0) {
            breakdownAll = rangeResult.profit_details.map(detail => ({
              buy_customer: detail.buy_customer,
              sell_customer: detail.sell_customer,
              buy_time: detail.buy_date,
              sell_time: detail.sell_date,
              matched_mmk: detail.matched_mmk,
              buy_rate: detail.buy_rate,
              sell_rate: detail.sell_rate,
              matched_thb: detail.thb_buy,
              profit: detail.profit,
              date: `${start} to ${end}`
            }));
          }
        } catch (error) {
          // Only log non-404 errors to avoid console clutter
          if (error.message !== 'ENDPOINT_NOT_FOUND') {
            console.error(`Error calculating date range profits:`, error);
          }
          // Fall back to day-by-day calculation
          // Reset summary totals since we're starting fresh calculation
          summaryTotals = {
            totalProfit: 0,
            transactionCount: 0,
            thbVolume: 0,
            mmkVolume: 0,
            buyCount: 0,
            sellCount: 0,
          };
          
          const dates = getDatesInRange(start, end);
          for (let dateObj of dates) {
            const dateStr = formatDateForAPI(dateObj);
            
            try {
              const dailyResult = await calculateDailyProfits(dateObj);
              // Debug: console.log(`Daily result for ${dateStr}:`, dailyResult);
              
              const dayTotalProfit = safeParseFloat(dailyResult.total_profit, 0);
              const dayBuySellProfit = safeParseFloat(dailyResult.buy_sell_profit, 0);
              const dayOtherProfit = safeParseFloat(dailyResult.other_profit, 0);
              const dayTransactionCount = safeParseFloat(dailyResult.transactionCount, 0);
              
              profitsArr.push({
                date: dateStr,
                total_profit: dayTotalProfit,
                buy_sell_profit: dayBuySellProfit,
                other_profit: dayOtherProfit,
                transactionCount: dayTransactionCount,
                thbVolume: 0,
                mmkVolume: 0,
                buyCount: 0,
                sellCount: 0,
              });
              
              summaryTotals.totalProfit += dayTotalProfit;
              summaryTotals.transactionCount += dayTransactionCount;
              
              // Get transaction details for volume and breakdown calculations
              const transactions = await fetchTransactionsForRange(dateStr, dateStr);
              const calc = calculateProfitsFromTransactions(transactions);
              
              // Update the profit entry with volume and count data
              const lastEntry = profitsArr[profitsArr.length - 1];
              lastEntry.thbVolume = calc.thbVolume;
              lastEntry.mmkVolume = calc.mmkVolume;
              lastEntry.buyCount = calc.buyCount;
              lastEntry.sellCount = calc.sellCount;
              lastEntry.transactionCount = calc.transactionCount; // Use actual count
              
              summaryTotals.thbVolume += calc.thbVolume;
              summaryTotals.mmkVolume += calc.mmkVolume;
              summaryTotals.buyCount += calc.buyCount;
              summaryTotals.sellCount += calc.sellCount;
              
              if (calc.matched.length > 0) {
                breakdownAll = breakdownAll.concat(calc.matched.map(m => ({ ...m, date: dateStr })));
              }
            } catch (dailyError) {
              console.error(`Error calculating daily profits for ${dateStr}:`, dailyError);
              // Fall back to manual calculation for this date
              const transactions = await fetchTransactionsForRange(dateStr, dateStr);
              const calc = calculateProfitsFromTransactions(transactions);
              profitsArr.push({
                date: dateStr,
                total_profit: calc.totalProfit,
                buy_sell_profit: calc.totalProfit - calc.otherProfit,
                other_profit: calc.otherProfit,
                transactionCount: calc.transactionCount,
                thbVolume: calc.thbVolume,
                mmkVolume: calc.mmkVolume,
                buyCount: calc.buyCount,
                sellCount: calc.sellCount,
              });
              
              summaryTotals.totalProfit += safeParseFloat(calc.totalProfit, 0);
              summaryTotals.transactionCount += safeParseFloat(calc.transactionCount, 0);
              summaryTotals.thbVolume += calc.thbVolume;
              summaryTotals.mmkVolume += calc.mmkVolume;
              summaryTotals.buyCount += calc.buyCount;
              summaryTotals.sellCount += calc.sellCount;
              
              if (calc.matched.length > 0) {
                breakdownAll = breakdownAll.concat(calc.matched.map(m => ({ ...m, date: dateStr })));
              }
            }
          }
        }
      }

      // Debug logging for summary totals
      // console.log('Final summary totals:', summaryTotals);
      // console.log('Individual profits:', profitsArr.map(p => ({ date: p.date, profit: p.total_profit })));
      
      setProfits(profitsArr);
      setSummary(summaryTotals);
      setBreakdown(breakdownAll);
      setSelectedSummary(profitsArr.length > 0 ? profitsArr[0] : null);
    } catch (err) {
      console.error('[DailyProfits] Error in fetchProfits:', err);
      setError('Failed to fetch or calculate daily profits');
    } finally {
      setLoading(false);
    }
  };

  const calculateTodayProfit = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const data = await calculateDailyProfits(today);
      console.log('Today\'s profit:', data);
      setSelectedSummary(data);
    } catch (err) {
      console.error('Error calculating today\'s profit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchProfits(),
          calculateTodayProfit()
        ]);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateMode, singleDate, startDate, endDate]);

  const formatCurrency = (amount) => {
    // Handle invalid values first
    if (amount === null || amount === undefined) return '-';
    
    // Use safe parsing to handle string values and NaN
    const numValue = safeParseFloat(amount, 0);
    
    // Check if the result is still NaN after parsing
    if (isNaN(numValue) || !isFinite(numValue)) {
      console.warn('Invalid currency value detected:', amount);
      return 'THB 0.00'; // Return a safe default
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    const numValue = safeParseFloat(num, 0);
    if (isNaN(numValue) || !isFinite(numValue)) {
      console.warn('Invalid number value detected:', num);
      return '0';
    }
    return numValue.toLocaleString();
  };

  // Using the centralized formatDateTime function from dateUtils.js
  // with a wrapper for backward compatibility
  const formatDate = (dateString) => {
    return formatDateLong(dateString);
  };

  // Quick range handler
  const handleQuickRange = (getRange) => {
    const [start, end] = getRange();
    if (dateMode === 'single') {
      setSingleDate(start);
    } else {
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Reset filter function
  const handleResetFilter = () => {
    setDateMode('single');
    const today = new Date();
    setSingleDate(today);
    setStartDate(today);
    setEndDate(today);
  };

  // Export CSV function
  const handleExportCSV = () => {
    if (!profits.length) return;
    // Change column order: Buy/Sell Profit, Other Profit, Total Profit
    const headers = ['Date', 'Buy/Sell Profit', 'Other Profit', 'Total Profit'];
    const rows = profits.map(e => [
      e.date,
      e.buy_sell_profit,
      e.other_profit,
      e.total_profit
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily_profits_${dateMode === 'single' ? formatDateForAPI(singleDate) : formatDateForAPI(startDate) + '_' + formatDateForAPI(endDate)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: '#0B1C1C', mb: 2 }}>
          DAILY PROFITS
        </Typography>
        {/* Date Range Picker and Quick Buttons */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Select Date Range
          </Typography>
          <Grid container spacing={2} alignItems="center" justifyContent="flex-start">
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateMode}
                  label="Date Range"
                  onChange={e => setDateMode(e.target.value)}
                >
                  <MenuItem value="single">Single Day</MenuItem>
                  <MenuItem value="range">Date Range</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3} lg={2}>
              {dateMode === 'single' ? (
                <DatePicker
                  label="Date"
                  value={singleDate}
                  onChange={setSingleDate}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              ) : (
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              )}
            </Grid>
            {dateMode === 'range' && (
              <Grid item xs={12} sm={6} md={3} lg={2}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
            )}
            <Grid item xs={12} md={4} lg={6}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', width: '100%' }}>
                {quickRanges.map((q) => (
                  <Button key={q.label} variant="outlined" size="small" onClick={() => handleQuickRange(q.getRange)} sx={{ flex: 1, minWidth: 100 }}>
                    {q.label}
                  </Button>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={12} lg={12} sx={{ mt: 1, display: 'flex', gap: 2 }}>
              <Button variant="outlined" color="secondary" onClick={handleResetFilter}>
                Reset Filter
              </Button>
              <Button variant="contained" color="success" onClick={handleExportCSV} startIcon={<FileDownloadIcon />}>
                Export CSV
              </Button>
            </Grid>
          </Grid>
        </Paper>
        {/* Error Display */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {/* Summary Cards */}
        {summary && (
          <Grid container spacing={2} sx={{ mb: 3 }} justifyContent="flex-start">
            <Grid item xs={12} sm={6} md={3} lg={3}>
              <Card sx={{ bgcolor: '#e8f5e9', width: '100%', height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle2">Total Profit</Typography>
                  <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>{formatCurrency(summary.totalProfit)}</Typography>
                  <Typography variant="caption">From {summary.transactionCount} transactions</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3} lg={3}>
              <Card sx={{ bgcolor: '#fff', width: '100%', height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle2">Transaction Count</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{formatNumber(summary.transactionCount)}</Typography>
                  <Typography variant="caption">Buy: {summary.buyCount} | Sell: {summary.sellCount}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3} lg={3}>
              <Card sx={{ bgcolor: '#fff', width: '100%', height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle2">THB Volume</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{formatNumber(summary.thbVolume)} THB</Typography>
                  <Typography variant="caption">From {summary.transactionCount} transactions</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3} lg={3}>
              <Card sx={{ bgcolor: '#fff', width: '100%', height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle2">MMK Volume</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{formatNumber(summary.mmkVolume)} MMK</Typography>
                  <Typography variant="caption">From {summary.transactionCount} transactions</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        {/* Daily Summary Table */}
        <Paper sx={{ mb: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#0B1C1C' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Transactions</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Buy Count</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Sell Count</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>THB Volume</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>MMK Volume</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Profit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profits.map((row) => (
                  <TableRow
                    key={row.date}
                    selected={selectedSummary && row.date === selectedSummary.date}
                    onClick={() => setSelectedSummary(row)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>{formatNumber(row.transactionCount)}</TableCell>
                    <TableCell>{formatNumber(row.buyCount)}</TableCell>
                    <TableCell>{formatNumber(row.sellCount)}</TableCell>
                    <TableCell>{formatNumber(row.thbVolume)} THB</TableCell>
                    <TableCell>{formatNumber(row.mmkVolume)} MMK</TableCell>
                    <TableCell>{formatCurrency(row.total_profit)}</TableCell>
                  </TableRow>
                ))}
                {profits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">No profits found for the selected date range</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        {/* Profit Breakdown Table */}
        {selectedSummary && (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Profit Breakdown for {formatDate(selectedSummary.date)}
            </Typography>
            <Paper>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell>Buy Customer</TableCell>
                      <TableCell>Sell Customer</TableCell>
                      <TableCell>Buy Time</TableCell>
                      <TableCell>Sell Time</TableCell>
                      <TableCell align="right">Matched MMK</TableCell>
                      <TableCell align="right">Buy Rate</TableCell>
                      <TableCell align="right">Sell Rate</TableCell>
                      <TableCell align="right">Matched THB</TableCell>
                      <TableCell align="right">Profit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {breakdown.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">No matched transactions found for the selected date(s).</TableCell>
                      </TableRow>
                    ) : (
                      breakdown.map((tx, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{tx.buy_customer || '-'}</TableCell>
                          <TableCell>{tx.sell_customer || '-'}</TableCell>
                          <TableCell>{tx.buy_time ? new Date(tx.buy_time).toLocaleString('en-GB') : '-'}</TableCell>
                          <TableCell>{tx.sell_time ? new Date(tx.sell_time).toLocaleString('en-GB') : '-'}</TableCell>
                          <TableCell align="right">{formatNumber(tx.matched_mmk)}</TableCell>
                          <TableCell align="right">{tx.buy_rate}</TableCell>
                          <TableCell align="right">{tx.sell_rate}</TableCell>
                          <TableCell align="right">{formatNumber(tx.matched_thb)}</TableCell>
                          <TableCell align="right">{formatCurrency(tx.profit)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default DailyProfits; 