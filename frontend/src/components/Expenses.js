import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  MenuItem,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  Alert,
  FormHelperText,
  IconButton,
  Tooltip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { subDays, startOfWeek, startOfMonth } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CategoryIcon from '@mui/icons-material/Category';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import InfoIcon from '@mui/icons-material/Info';
import axios from 'axios';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const quickRanges = [
  { label: 'Today', getRange: () => [new Date(), new Date()] },
  { label: 'Yesterday', getRange: () => [subDays(new Date(), 1), subDays(new Date(), 1)] },
  { label: 'This Week', getRange: () => [startOfWeek(new Date(), { weekStartsOn: 1 }), new Date()] },
  { label: 'This Month', getRange: () => [startOfMonth(new Date()), new Date()] },
];

const API_URL = 'https://99moneyexchange.pythonanywhere.com/api/transactions/expenses/';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [formData, setFormData] = useState({
    type: '',
    amount: '',
    description: '',
    remarks: '',
    date: new Date(),
  });
  const [dateMode, setDateMode] = useState('single'); // 'single' or 'range'
  const [singleDate, setSingleDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [openTypeDialog, setOpenTypeDialog] = useState(false);
  const [newType, setNewType] = useState('');
  const [formTouched, setFormTouched] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [editFormData, setEditFormData] = useState({
    type: '',
    amount: '',
    description: '',
    remarks: '',
    date: new Date(),
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (value === 'add_new') {
      setOpenTypeDialog(true);
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      date: date
    }));
  };

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      let params = {};
      if (dateMode === 'single') {
        params.date = singleDate.toISOString().slice(0, 10);
      } else {
        params.start_date = startDate.toISOString().slice(0, 10);
        params.end_date = endDate.toISOString().slice(0, 10);
      }
      const response = await axios.get(API_URL, { params });
      // Handle both paginated and direct array responses
      const data = response.data;
      if (Array.isArray(data)) {
        setExpenses(data);
      } else if (data && Array.isArray(data.results)) {
        setExpenses(data.results);
      } else {
        console.warn('Unexpected expenses response format:', data);
        setExpenses([]);
      }
    } catch (err) {
      setError('Failed to load expenses.');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line
  }, [dateMode, singleDate, startDate, endDate]);

  useEffect(() => {
    const fetchExpenseTypes = async () => {
      try {
        const response = await axios.get('https://99moneyexchange.pythonanywhere.com/api/transactions/expense-types/');
        // Handle both paginated and direct array responses
        const data = response.data;
        if (Array.isArray(data)) {
          setExpenseTypes(data);
        } else if (data && Array.isArray(data.results)) {
          setExpenseTypes(data.results);
        } else {
          console.warn('Unexpected expense types response format:', data);
          setExpenseTypes([]);
        }
      } catch (err) {
        console.error('Failed to fetch expense types:', err);
        setExpenseTypes([]);
      }
    };
    fetchExpenseTypes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormTouched(true);
    setLoading(true);
    setError(null);
    
    // Validate form data before submission
    if (!formData.type) {
      setError('Please select an expense type');
      setLoading(false);
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }
    if (!formData.description) {
      setError('Please enter a description');
      setLoading(false);
      return;
    }

    try {
      console.log('Submitting expense with data:', formData);
      
      const payload = {
        expense_type: parseInt(formData.type), // Ensure expense_type is sent as an integer
        amount: parseFloat(formData.amount),
        description: formData.description,
        remarks: formData.remarks || '',
        date: formData.date.toISOString().slice(0, 10),
      };
      
      console.log('Sending payload to API:', payload);
      const response = await axios.post(API_URL, payload);
      console.log('Server response:', response.data);
      
      setFormData({
        type: '',
        amount: '',
        description: '',
        remarks: '',
        date: new Date(),
      });
      setFormTouched(false);
      
      // Refresh the expenses list
      await fetchExpenses();
      
    } catch (err) {
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      let errorMessage = 'Failed to add expense. ';
      if (err.response?.data?.error) {
        errorMessage += err.response.data.error;
      } else if (err.response?.data?.details) {
        errorMessage += Object.entries(err.response.data.details)
          .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
          .join('; ');
      } else {
        errorMessage += 'Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddType = async () => {
    if (newType.trim()) {
      try {
        const response = await axios.post('https://99moneyexchange.pythonanywhere.com/api/transactions/expense-types/', {
          name: newType.trim(),
          description: '',
          is_active: true
        });
        setExpenseTypes(prev => [...prev, response.data]);
      setFormData(prev => ({
        ...prev,
          type: response.data.id
      }));
      setNewType('');
      setOpenTypeDialog(false);
      } catch (err) {
        setError('Failed to add expense type. Please try again.');
      }
    }
  };

  // Quick range handler
  const handleQuickRange = (getRange, label) => {
    const [start, end] = getRange();
    if (label === 'Today' || label === 'Yesterday') {
      setDateMode('single');
      setSingleDate(start);
    } else {
      setDateMode('range');
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
    if (!Array.isArray(expenses) || !expenses.length) return;
    const headers = ['Date', 'Type', 'Amount', 'Description', 'Remarks'];
    const rows = expenses.map(e => [
      new Date(e.date).toLocaleDateString(),
      e.expense_type_name,
      e.amount,
      e.description,
      e.remarks
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${dateMode === 'single' ? singleDate.toISOString().slice(0,10) : startDate.toISOString().slice(0,10) + '_' + endDate.toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getChartData = () => {
    if (!Array.isArray(expenses) || expenses.length === 0) return [];
    const grouped = expenses.reduce((acc, expense) => {
      const typeName = expense.expense_type_name || 'Uncategorized';
      if (!acc[typeName]) {
        acc[typeName] = 0;
      }
      acc[typeName] += parseFloat(expense.amount_thb || 0);
      return acc;
    }, {});

    return Object.keys(grouped).map((name, index) => ({
      name,
      value: grouped[name],
      fill: COLORS[index % COLORS.length],
    }));
  };

  // Edit handlers
  const handleEditClick = (expense) => {
    setSelectedExpense(expense);
    setEditFormData({
      type: expense.expense_type,
      amount: expense.amount,
      description: expense.description,
      remarks: expense.remarks,
      date: new Date(expense.date),
    });
    setEditDialogOpen(true);
  };
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };
  const handleEditDateChange = (date) => {
    setEditFormData((prev) => ({ ...prev, date: date }));
  };
  const handleEditSave = async () => {
    if (!selectedExpense) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        expense_type: parseInt(editFormData.type),
        amount: parseFloat(editFormData.amount),
        description: editFormData.description,
        remarks: editFormData.remarks || '',
        date: editFormData.date.toISOString().slice(0, 10),
      };
      await axios.patch(`${API_URL}${selectedExpense.id}/`, payload);
      setEditDialogOpen(false);
      setSelectedExpense(null);
      await fetchExpenses();
    } catch (err) {
      setError('Failed to update expense.');
    } finally {
      setLoading(false);
    }
  };
  // Delete handlers
  const handleDeleteClick = (expense) => {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (!selectedExpense) return;
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_URL}${selectedExpense.id}/`);
      setDeleteDialogOpen(false);
      setSelectedExpense(null);
      await fetchExpenses();
    } catch (err) {
      setError('Failed to delete expense.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats for each category
  const categoryStats = Array.isArray(expenses) ? expenses.reduce((acc, e) => {
    const name = e.expense_type_name || 'Unknown';
    if (!acc[name]) acc[name] = { count: 0, total: 0 };
    acc[name].count += 1;
    acc[name].total += Number(e.amount || 0);
    return acc;
  }, {}) : {};

  // Most Common Category
  const mostCommon = Object.entries(categoryStats).sort((a, b) => b[1].count - a[1].count)[0];
  const mostCommonCategory = mostCommon
    ? { name: mostCommon[0], count: mostCommon[1].count, total: mostCommon[1].total }
    : { name: '-', count: 0, total: 0 };

  // Top Spending Category
  const topSpending = Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total)[0];
  const topSpendingCategory = topSpending
    ? { name: topSpending[0], count: topSpending[1].count, total: topSpending[1].total }
    : { name: '-', count: 0, total: 0 };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, md: 5 }, bgcolor: '#f4f6fa', minHeight: '100vh' }}>
        <Typography variant="h4" gutterBottom sx={{ color: '#0B1C1C', mb: 3, fontWeight: 700 }}>
          EXPENSES
        </Typography>
        <Grid container spacing={4} alignItems="stretch">
          {/* Add Expense Form */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, boxShadow: 3, bgcolor: '#fff', height: '100%' }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, mb: 3 }}>
                New Expense
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              {loading && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Adding expense...
                </Alert>
              )}
              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={formTouched && !formData.type}>
                      <InputLabel>Expense Type</InputLabel>
                      <Select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        required
                        label="Expense Type"
                      >
                        {Array.isArray(expenseTypes) && expenseTypes.map((type) => (
                          <MenuItem key={type.id} value={type.id}>
                            {type.name}
                          </MenuItem>
                        ))}
                        {Array.isArray(expenseTypes) && expenseTypes.length > 0 && <Divider />}
                        <MenuItem value="add_new" sx={{ color: 'primary.main' }}>
                          + Add New Type
                        </MenuItem>
                      </Select>
                      {formTouched && !formData.type && (
                        <FormHelperText>Please select an expense type</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Amount (MMK)"
                      name="amount"
                      type="number"
                      value={formData.amount}
                      onChange={handleInputChange}
                      required
                      error={formTouched && (!formData.amount || formData.amount <= 0)}
                      helperText={formTouched && (!formData.amount || formData.amount <= 0) ? "Please enter a valid amount" : "Expense amount in MMK"}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      required
                      error={formTouched && !formData.description}
                      helperText={formTouched && !formData.description ? "Please enter a description" : "Short description of the expense"}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Remarks"
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleInputChange}
                      multiline
                      rows={2}
                      helperText="(Optional) Any additional notes"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        label="Date"
                        value={formData.date}
                        onChange={handleDateChange}
                        slotProps={{ textField: { fullWidth: true, helperText: 'Expense date' } }}
                      />
                    </LocalizationProvider>
                  </Grid>
                  <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      sx={{ fontWeight: 600, borderRadius: 2, py: 1.2, minWidth: 180 }}
                    >
                      Add Expense
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </Paper>
          </Grid>

          {/* Date Range Filter Section */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, boxShadow: 3, bgcolor: '#fff', height: '100%' }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
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
                      <Button key={q.label} variant="outlined" size="small" onClick={() => handleQuickRange(q.getRange, q.label)} sx={{ flex: 1, minWidth: 100, borderColor: '#00FF7F', color: '#00FF7F', fontWeight: 600, '&:hover': { bgcolor: '#e6fff3', borderColor: '#00FF7F' } }}>
                        {q.label}
                      </Button>
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={12} lg={12} sx={{ mt: 1, display: 'flex', gap: 2 }}>
                  <Button variant="outlined" color="secondary" onClick={handleResetFilter} sx={{ fontWeight: 600, borderRadius: 2 }}>
                    Reset Filter
                  </Button>
                  <Button variant="contained" color="success" onClick={handleExportCSV} startIcon={<FileDownloadIcon />} sx={{ fontWeight: 600, borderRadius: 2 }}>
                    Export CSV
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Pie Chart and Dashboard Row */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Paper elevation={3} sx={{ flex: 1, p: { xs: 3, md: 4 }, borderRadius: 3, boxShadow: 3, bgcolor: '#fff', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>
                  Expense Distribution
                </Typography>
                <Box sx={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {getChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
              <Paper elevation={3} sx={{ flex: 1, p: { xs: 3, md: 4 }, borderRadius: 3, boxShadow: 3, bgcolor: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>
                  Expense Dashboard
                </Typography>
                <Grid container spacing={2}>
                  {/* Total Expenses */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <AttachMoneyIcon sx={{ mr: 1 }} /> Total Expenses
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {Array.isArray(expenses) ? expenses.reduce((acc, curr) => acc + parseFloat(curr.amount_thb || 0), 0).toLocaleString('en-US', { style: 'currency', currency: 'THB' }) : '0.00'}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        For selected date range
                      </Typography>
                    </Paper>
                  </Grid>
                  {/* Number of Expenses */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#fff', boxShadow: 1, borderRadius: 2 }}>
                      <ListAltIcon color="primary" fontSize="large" />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Number of Expenses</Typography>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>{Array.isArray(expenses) ? expenses.length : 0}</Typography>
                      </Box>
                    </Paper>
                  </Grid>
                  {/* Average Expense (moved up) */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#fff', boxShadow: 1, borderRadius: 2 }}>
                      <BarChartIcon color="secondary" fontSize="large" />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Average Expense</Typography>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>
                          {Array.isArray(expenses) && expenses.length > 0 ? (expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0) / expenses.length).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                  {/* Highest Single Expense */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#fff', boxShadow: 1, borderRadius: 2 }}>
                      <TrendingUpIcon color="error" fontSize="large" />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Highest Expense</Typography>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>
                          {Array.isArray(expenses) && expenses.length > 0 ? Math.max(...expenses.map(e => Number(e.amount || 0))).toLocaleString() : '-'}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                  {/* Most Common Category (no icon) */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#fff', boxShadow: 1, borderRadius: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Most Common Category</Typography>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>{mostCommonCategory.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Count: {mostCommonCategory.count} | Total: {mostCommonCategory.total.toLocaleString()}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                  {/* Top Spending Category */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#fff', boxShadow: 1, borderRadius: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Top Spending Category</Typography>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>{topSpendingCategory.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Count: {topSpendingCategory.count} | Total: {topSpendingCategory.total.toLocaleString()}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          </Grid>

          {/* Expense Table */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, boxShadow: 3, bgcolor: '#fff', height: '100%' }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>
                Expense History
              </Typography>
              {loading ? (
                <Typography variant="body1" sx={{ textAlign: 'center', mt: 2 }}>Loading...</Typography>
              ) : error ? (
                <Typography variant="body1" sx={{ textAlign: 'center', color: 'error.main', mt: 2 }}>{error}</Typography>
              ) : (
                <TableContainer>
                  <Table sx={{ minWidth: 650 }}>
                    <TableHead sx={{ position: 'sticky', top: 0, bgcolor: '#f0f4f8', zIndex: 1 }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                        <TableCell align="right">Amount (MMK)</TableCell>
                        <TableCell align="right">Amount (THB)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.isArray(expenses) && expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                          <TableCell>{expense.expense_type_name}</TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell align="right">{parseFloat(expense.amount).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {expense.amount_thb ? parseFloat(expense.amount_thb).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
                              {expense.amount_thb_rate_info && (
                                <Tooltip title={expense.amount_thb_rate_info} arrow>
                                  <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'text.secondary' }} />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <IconButton onClick={() => handleEditClick(expense)} size="small" color="primary"><EditIcon /></IconButton>
                            <IconButton onClick={() => handleDeleteClick(expense)} size="small" color="error"><DeleteIcon /></IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
        {/* Add Expense Type Dialog */}
        <Dialog open={openTypeDialog} onClose={() => setOpenTypeDialog(false)}>
          <DialogTitle>Add New Expense Type</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Expense Type"
              type="text"
              fullWidth
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenTypeDialog(false)}>Cancel</Button>
            <Button onClick={handleAddType} variant="contained">Add</Button>
          </DialogActions>
        </Dialog>
        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Expense Type</InputLabel>
              <Select
                name="type"
                value={editFormData.type}
                onChange={handleEditInputChange}
                label="Expense Type"
              >
                {Array.isArray(expenseTypes) && expenseTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Amount"
              name="amount"
              type="number"
              value={editFormData.amount}
              onChange={handleEditInputChange}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={editFormData.description}
              onChange={handleEditInputChange}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Remarks"
              name="remarks"
              value={editFormData.remarks}
              onChange={handleEditInputChange}
              sx={{ mb: 2 }}
            />
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date"
                value={editFormData.date}
                onChange={handleEditDateChange}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} variant="contained" color="primary">Save</Button>
          </DialogActions>
        </Dialog>
        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Expense</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to delete this expense?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} variant="contained" color="error">Delete</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Expenses; 