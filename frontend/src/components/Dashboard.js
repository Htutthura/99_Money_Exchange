import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Button,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  TableFooter,
  useTheme
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import DownloadIcon from '@mui/icons-material/Download';
import BarChartIcon from '@mui/icons-material/BarChart';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PaidIcon from '@mui/icons-material/Paid';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SyncIcon from '@mui/icons-material/Sync';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { styled } from '@mui/material/styles';
import { format } from 'date-fns';

// Use the correct API URL for transactions
const API_URL = 'https://99moneyexchange.pythonanywhere.com/api/transactions';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
}));

const StatCard = ({ title, value, subtitle, icon }) => (
  <StyledPaper>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
    <Typography variant="h6" color="textSecondary" gutterBottom>
      {title}
    </Typography>
      {icon && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          bgcolor: 'primary.light', 
          color: 'primary.contrastText',
          p: 1,
          borderRadius: '50%'
        }}>
          {icon}
        </Box>
      )}
    </Box>
    <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
      {value}
    </Typography>
    {subtitle && (
      <Typography variant="body2" color="textSecondary">
        {subtitle}
      </Typography>
    )}
  </StyledPaper>
);

const Dashboard = ({ autoRecalculate = false }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasRecalculated, setHasRecalculated] = useState(false);
  const [needsRecalculation, setNeedsRecalculation] = useState(false);
  const [lastCalculationTime, setLastCalculationTime] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [digitsVisible, setDigitsVisible] = useState(false);

  const fetchDashboardData = async (forceRecalculate = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Convert selected date to YYYY-MM-DD format for API
      const dateParam = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
      
      // Only trigger profit calculation when explicitly requested via forceRecalculate
      if (forceRecalculate) {
        try {
          const profitResponse = await fetch(`${API_URL}/calculate_profits/?timestamp=${new Date().getTime()}`, {
            headers: defaultHeaders,
          });
          
          if (!profitResponse.ok) {
            console.warn("Profit calculation failed, proceeding with dashboard data anyway");
          } else {
            setHasRecalculated(true);
            
            // Store calculation time in localStorage
            const calcTime = Date.now();
            localStorage.setItem('lastProfitCalculationTime', calcTime.toString());
            setLastCalculationTime(new Date(calcTime));
            setNeedsRecalculation(false);
          }
        } catch (profitError) {
          console.error('Error in profit calculation:', profitError);
          // Continue anyway - we'll still fetch dashboard data
        }
      }
      
      // Now fetch dashboard data - include date parameter if selected
      let url = `${API_URL}/dashboard/?timestamp=${new Date().getTime()}&force_calculate=${forceRecalculate}`;
      if (dateParam) {
        url += `&date=${dateParam}`;
      }
      
      const response = await fetch(url, {
        headers: defaultHeaders,
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      
      // Store dashboard data in localStorage
      localStorage.setItem('dashboardData', JSON.stringify(data));
      
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(`Failed to fetch dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Add date change handler
  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  // Modify the useEffect to respond to date changes
  useEffect(() => {
    // First try to load from cache for immediate display
    const hasCachedData = loadCachedDashboardData();
    
    if (!hasCachedData) {
      // If no cached data, fetch fresh data but don't recalculate
      fetchDashboardData(false);
    }
    
    // Check if recalculation is needed
    checkIfRecalculationNeeded();
    
    // Add event listener for profit calculations
    window.addEventListener('profit-calculated', refreshDashboard);
    
    // Cleanup
    return () => {
      window.removeEventListener('profit-calculated', refreshDashboard);
    };
  }, []); // Keep this empty to run only on mount

  // Add effect to fetch data when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchDashboardData(false);
    }
  }, [selectedDate]);

  // Add this function to refresh dashboard WITH profit recalculation
  const refreshWithRecalculation = () => {
    console.log("Refreshing dashboard with full profit recalculation...");
    fetchDashboardData(true); // Pass true to force recalculation
  };

  const refreshDashboard = () => {
    console.log("Refreshing dashboard data...");
    // Just reload dashboard data without profit recalculation
    fetchDashboardData(false);
  };

  const formatNumberWithCommas = (num) => {
    if (num === undefined || num === null) return '-';
    
    // If digits are hidden, return asterisks
    if (!digitsVisible) {
      return '***.**';
    }
    
    // For THB values, ensure exactly 2 decimal places
    if (typeof num === 'number') {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    // For string values, use the regex pattern
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

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
    
    return `${formatNumberWithCommas(num)}${unit ? ' ' + unit : ''}`;
  };

  const handleExportData = async (period) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/export/?period=${period}`, {
        method: 'GET',
        headers: defaultHeaders,
      });
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `99money_${period}_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting data:', error);
      setError(`Failed to export data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDailySummary = async (period) => {
    try {
      setLoading(true);
      
      // Build URL with period and selected date parameters
      let url = `${API_URL}/export_daily_summary/?period=${period}`;
      
      // Add the selected date parameter
      if (selectedDate) {
        const dateString = format(selectedDate, 'yyyy-MM-dd');
        url += `&date=${dateString}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: defaultHeaders,
      });
      
      if (!response.ok) {
        throw new Error('Failed to export daily summary');
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link and trigger download
      const url_obj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url_obj;
      
      // Set filename based on period
      let filename = period === 'month' 
        ? `daily_summary_${format(selectedDate, 'yyyy-MM')}.csv`
        : `daily_summary_all_to_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url_obj);
      document.body.removeChild(a);
      
      console.log(`Successfully exported ${period} daily summary`);
    } catch (error) {
      console.error('Error exporting daily summary:', error);
      setError(`Failed to export daily summary: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupOldTransactions = async () => {
    if (!window.confirm('Are you sure you want to delete transactions older than 2 months? This cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/cleanup_old_transactions/`, {
        method: 'POST',
        headers: defaultHeaders,
      });
      
      if (!response.ok) {
        throw new Error('Failed to cleanup old transactions');
      }
      
      const data = await response.json();
      alert(`Successfully deleted ${data.deleted_count} transactions older than 2 months.`);
      
      // Refresh dashboard data
      fetchDashboardData();
    } catch (error) {
      console.error('Error cleaning up old transactions:', error);
      setError(`Failed to cleanup old transactions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Check if recalculation is needed by comparing transaction timestamps 
  const checkIfRecalculationNeeded = async () => {
    try {
      // Get last transaction timestamp
      const response = await fetch(`${API_URL}/last_transaction_time/?timestamp=${new Date().getTime()}`, {
        headers: defaultHeaders,
      });
      
      if (!response.ok) {
        console.warn("Failed to check last transaction time");
        return;
      }
      
      const data = await response.json();
      
      // Get the stored calculation time from localStorage
      const storedCalcTime = localStorage.getItem('lastProfitCalculationTime');
      if (storedCalcTime) {
        setLastCalculationTime(new Date(parseInt(storedCalcTime)));
        
        // If there are newer transactions, set the needsRecalculation flag
        if (data.last_transaction_time && new Date(data.last_transaction_time) > new Date(parseInt(storedCalcTime))) {
          console.log("New transactions detected since last calculation");
          setNeedsRecalculation(true);
        }
      } else {
        // If no previous calculation time, we need to calculate
        setNeedsRecalculation(true);
      }
    } catch (error) {
      console.error("Error checking for recalculation:", error);
    }
  };
  
  // Load cached dashboard data from localStorage
  const loadCachedDashboardData = () => {
    const cachedData = localStorage.getItem('dashboardData');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        setDashboardData(parsedData);
        console.log("Loaded dashboard data from cache");
        
        // Get the stored calculation time
        const storedCalcTime = localStorage.getItem('lastProfitCalculationTime');
        if (storedCalcTime) {
          setLastCalculationTime(new Date(parseInt(storedCalcTime)));
        }
        
        return true;
      } catch (e) {
        console.error("Error parsing cached dashboard data:", e);
      }
    }
    return false;
  };

  const recalculateProfits = async () => {
    try {
      setIsRecalculating(true);
      
      const response = await fetch(`${API_URL}/calculate_profits/?timestamp=${Date.now()}`);
      if (!response.ok) {
        throw new Error('Failed to calculate profits');
      }
      
      const data = await response.json();
      setDashboardData(data);
      
      // Update the last calculation time
      setLastCalculationTime(Date.now());
      localStorage.setItem('lastProfitCalculation', Date.now().toString());
      
    } catch (error) {
      console.error('Error recalculating profits:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  if (loading && !dashboardData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ padding: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={refreshDashboard}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 220px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Simplified Date Picker */}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { 
                    mr: 2, 
                    bgcolor: 'white', 
                    width: '160px',
                    '& .MuiOutlinedInput-root': {
                      borderColor: 'rgba(11, 28, 28, 0.5)',
                      '&:hover': {
                        borderColor: '#0B1C1C',
                      }
                    }
                  }
                },
                day: {
                  sx: {
                    "&.Mui-selected": {
                      backgroundColor: "#0B1C1C !important",
                      color: "white"
                    }
                  }
                }
              }}
            />
          </LocalizationProvider>
          
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
            variant="outlined" 
            startIcon={<SyncIcon />} 
            onClick={refreshWithRecalculation}
            sx={{ mr: 1, bgcolor: 'white' }}
          >
            Recalculate
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<DownloadIcon />} 
            onClick={() => handleExportDailySummary('all')}
            sx={{ mr: 1, bgcolor: 'white' }}
          >
            Export All
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<DownloadIcon />}
            onClick={() => handleExportDailySummary('month')}
            sx={{ bgcolor: 'white' }}
          >
            Export Month
          </Button>
        </Box>
      </Box>

      {/* Notification about data freshness */}
      {lastCalculationTime && (
        <Box sx={{ mb: 3, p: 2, bgcolor: needsRecalculation ? 'warning.light' : 'success.light', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {needsRecalculation 
                ? <strong>There are new transactions that need to be included in the profit calculation. Click "Recalculate" to update.</strong>
                : "Dashboard data is up-to-date."
              }
            </span>
            <span>
              Last calculated: {lastCalculationTime.toLocaleString()}
            </span>
          </Typography>
        </Box>
      )}

      {/* Date information */}
      {dashboardData && selectedDate && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6">
            Showing data for: {format(selectedDate, 'MMMM d, yyyy')}
          </Typography>
        </Box>
      )}

      {dashboardData && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="Total Profit" 
                value={formatSensitiveNumber(dashboardData.total_profit_thb, 'THB')}
                icon={<MonetizationOnIcon />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="Today's Profit" 
                value={formatSensitiveNumber(dashboardData.today_profit_thb, 'THB')}
                icon={<PaidIcon />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="This Month's Profit" 
                value={formatSensitiveNumber(dashboardData.month_profit_thb, 'THB')}
                icon={<TrendingUpIcon />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="Total Transactions" 
                value={dashboardData.total_transactions}
                subtitle={`${dashboardData.today_transactions} today`}
                icon={<BarChartIcon />}
              />
            </Grid>
          </Grid>

          {dashboardData.daily_summary && dashboardData.daily_summary.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Recent Activity
          </Typography>
              <TableContainer component={Paper} sx={{ borderRadius: '12px', overflow: 'hidden' }}>
              <Table>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#0B1C1C' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Transactions</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>THB Volume</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>MMK Volume</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Profit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                    {dashboardData.daily_summary.slice(0, 7).map((day, index) => (
                      <TableRow key={index}>
                      <TableCell>{new Date(day.date).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>{day.transaction_count}</TableCell>
                      <TableCell>{formatSensitiveNumber(day.thb_volume, 'THB')}</TableCell>
                      <TableCell>{formatSensitiveNumber(day.mmk_volume, 'MMK')}</TableCell>
                      <TableCell>{formatSensitiveNumber(day.profit, 'THB')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            </Box>
          )}

                    {dashboardData && dashboardData.remaining_transactions && (
            <Box mt={4}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Remaining Transactions</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                These transactions are either partially matched with previous transactions or haven't been matched at all. Once a transaction is fully matched, it will be removed from this list.
          </Typography>
          
              {dashboardData.remaining_transactions.buy.length > 0 && (
            <>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>Buy Transactions With Remaining Amounts</Typography>
              <TableContainer component={Paper} sx={{ mb: 3, borderRadius: '12px', overflow: 'hidden' }}>
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
                        {dashboardData.remaining_transactions.buy.map((transaction, index) => (
                      <TableRow key={`buy-${index}`}>
                        <TableCell>{transaction.customer}</TableCell>
                        <TableCell>{new Date(transaction.date_time).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>{formatSensitiveNumber(parseFloat(transaction.thb_amount), 'THB')}</TableCell>
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
                          dashboardData.remaining_transactions.buy.reduce((sum, tx) => sum + parseFloat(tx.thb_amount), 0)
                        )} THB
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        {formatNumberWithCommas(
                          dashboardData.remaining_transactions.buy.reduce((sum, tx) => sum + parseFloat(tx.mmk_amount), 0)
                        )} MMK
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        Min: {dashboardData.remaining_transactions.buy.length > 0 
                          ? Math.min(...dashboardData.remaining_transactions.buy.map(tx => parseFloat(tx.rate))).toFixed(4) 
                          : 'N/A'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        Max: {dashboardData.remaining_transactions.buy.length > 0 
                          ? Math.max(...dashboardData.remaining_transactions.buy.map(tx => parseFloat(tx.hundred_k_rate))).toFixed(2) 
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </>
          )}
          
              {dashboardData.remaining_transactions.sell.length > 0 && (
            <>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>Sell Transactions With Remaining Amounts</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: '12px', overflow: 'hidden' }}>
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
                        {dashboardData.remaining_transactions.sell.map((transaction, index) => (
                      <TableRow key={`sell-${index}`}>
                        <TableCell>{transaction.customer}</TableCell>
                        <TableCell>{new Date(transaction.date_time).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>{formatNumberWithCommas(parseFloat(transaction.thb_amount))} THB</TableCell>
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
                          dashboardData.remaining_transactions.sell.reduce((sum, tx) => sum + parseFloat(tx.thb_amount), 0)
                        )} THB
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        {formatNumberWithCommas(
                          dashboardData.remaining_transactions.sell.reduce((sum, tx) => sum + parseFloat(tx.mmk_amount), 0)
                        )} MMK
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        Max: {dashboardData.remaining_transactions.sell.length > 0 
                          ? Math.max(...dashboardData.remaining_transactions.sell.map(tx => parseFloat(tx.rate))).toFixed(4) 
                          : 'N/A'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        Min: {dashboardData.remaining_transactions.sell.length > 0 
                          ? Math.min(...dashboardData.remaining_transactions.sell.map(tx => parseFloat(tx.hundred_k_rate))).toFixed(2) 
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
        </>
      )}


    </Box>
  );
};

export default Dashboard; 
