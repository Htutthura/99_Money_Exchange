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
const EXPENSE_TYPES_URL = 'https://99moneyexchange.pythonanywhere.com/api/transactions/expense-types/';

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
  const [dateMode, setDateMode] = useState('single');
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
    id: '',
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, date }));
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
        const response = await axios.get(EXPENSE_TYPES_URL);
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
    if (!formData.type || !formData.amount || formData.amount <= 0 || !formData.description) {
      setError('Please fill all required fields.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        expense_type: parseInt(formData.type),
        amount: parseFloat(formData.amount),
        description: formData.description,
        remarks: formData.remarks || '',
        date: formData.date.toISOString().slice(0, 10),
      };
      await axios.post(API_URL, payload);
      setFormData({ type: '', amount: '', description: '', remarks: '', date: new Date() });
      setFormTouched(false);
      await fetchExpenses();
    } catch (err) {
      setError('Failed to add expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddType = async () => {
    if (newType.trim()) {
      try {
        const response = await axios.post(EXPENSE_TYPES_URL, { name: newType.trim() });
        setExpenseTypes(prev => [...prev, response.data]);
        setFormData(prev => ({ ...prev, type: response.data.id }));
        setNewType('');
        setOpenTypeDialog(false);
      } catch (err) {
        console.error('Failed to add expense type:', err);
      }
    }
  };

  const handleQuickRange = (getRange) => {
    const [start, end] = getRange();
    setStartDate(start);
    setEndDate(end);
    setDateMode('range');
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      alert("No data to export.");
      return;
    }
    const headers = ['ID', 'Date', 'Type', 'Description', 'Amount (THB)', 'Remarks'];
    const rows = expenses.map(e => [
      e.id,
      e.date,
      e.expense_type_name,
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount_thb,
      `"${(e.remarks || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "expenses.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getChartData = () => {
    const dataByType = expenses.reduce((acc, expense) => {
      const typeName = expense.expense_type_name || 'Uncategorized';
      if (!acc[typeName]) {
        acc[typeName] = 0;
      }
      acc[typeName] += parseFloat(expense.amount_thb || 0);
      return acc;
    }, {});
    return Object.entries(dataByType).map(([name, value]) => ({ name, value }));
  };

  const handleEditClick = (expense) => {
    setSelectedExpense(expense);
    setEditFormData({
      id: expense.id,
      type: expense.expense_type,
      amount: expense.amount_thb,
      description: expense.description,
      remarks: expense.remarks || '',
      date: new Date(expense.date),
    });
    setEditDialogOpen(true);
  };
  
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditDateChange = (date) => {
    setEditFormData(prev => ({ ...prev, date }));
  };

  const handleEditSave = async () => {
    if (!selectedExpense) return;
    try {
      const payload = {
        expense_type: parseInt(editFormData.type),
        amount: parseFloat(editFormData.amount),
        description: editFormData.description,
        remarks: editFormData.remarks,
        date: editFormData.date.toISOString().slice(0, 10),
      };
      await axios.put(`${API_URL}${selectedExpense.id}/`, payload);
      setEditDialogOpen(false);
      await fetchExpenses();
    } catch (error) {
      console.error('Failed to update expense:', error);
    }
  };

  const handleDeleteClick = (expense) => {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedExpense) return;
    try {
      await axios.delete(`${API_URL}${selectedExpense.id}/`);
      setDeleteDialogOpen(false);
      await fetchExpenses();
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Expenses Management</Typography>
        
        {/* Add Expense Form */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Add New Expense</Typography>
          <Grid container spacing={2} component="form" onSubmit={handleSubmit}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth error={formTouched && !formData.type}>
                <InputLabel>Type</InputLabel>
                <Select name="type" value={formData.type} label="Type" onChange={handleInputChange}>
                  {expenseTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
                  ))}
                  <MenuItem value="add_new"><em>+ Add New Type</em></MenuItem>
                </Select>
                {formTouched && !formData.type && <FormHelperText>Required</FormHelperText>}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                name="amount"
                label="Amount (THB)"
                type="number"
                fullWidth
                value={formData.amount}
                onChange={handleInputChange}
                error={formTouched && (!formData.amount || formData.amount <= 0)}
                helperText={formTouched && (!formData.amount || formData.amount <= 0) ? "Required" : ""}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                name="description"
                label="Description"
                fullWidth
                value={formData.description}
                onChange={handleInputChange}
                error={formTouched && !formData.description}
                helperText={formTouched && !formData.description ? "Required" : ""}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Date"
                value={formData.date}
                onChange={handleDateChange}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>
            <Grid item xs={12}>
               <TextField name="remarks" label="Remarks" fullWidth value={formData.remarks} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12}>
              <Button type="submit" variant="contained" disabled={loading}>Add Expense</Button>
            </Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Paper>

        {/* Filters and Charts */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Filter Expenses</Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <FormControlLabel control={<Switch checked={dateMode === 'range'} onChange={(e) => setDateMode(e.target.checked ? 'range' : 'single')} />} label="Date Range" />
                {dateMode === 'single' ? (
                  <DatePicker label="Select Date" value={singleDate} onChange={setSingleDate} renderInput={(params) => <TextField {...params} />} />
                ) : (
                  <>
                    <DatePicker label="Start Date" value={startDate} onChange={setStartDate} renderInput={(params) => <TextField {...params} />} />
                    <DatePicker label="End Date" value={endDate} onChange={setEndDate} renderInput={(params) => <TextField {...params} />} />
                  </>
                )}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {quickRanges.map(range => (
                  <Button key={range.label} onClick={() => handleQuickRange(range.getRange)} size="small">{range.label}</Button>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6">Expenses by Type</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={getChartData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} fill="#8884d8">
                    {getChartData().map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
        
        {/* Expenses Table */}
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Expense List</Typography>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCSV}>Export CSV</Button>
          </Box>
          {loading ? (
            <Typography>Loading...</Typography>
          ) : (
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (THB)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.date}</TableCell>
                      <TableCell>{expense.expense_type_name}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell align="right">
                        {parseFloat(expense.amount_thb).toLocaleString('en-US', { style: 'currency', currency: 'THB' })}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={expense.remarks || 'No remarks'}>
                          <IconButton size="small"><InfoIcon fontSize="inherit" /></IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={() => handleEditClick(expense)} size="small"><EditIcon fontSize="inherit"/></IconButton>
                        <IconButton onClick={() => handleDeleteClick(expense)} size="small"><DeleteIcon fontSize="inherit" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableHead>
                  <TableRow>
                    <TableCell colSpan={3} align="right"><Typography variant="h6">Total:</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="h6">
                        {expenses.reduce((total, expense) => total + parseFloat(expense.amount_thb || 0), 0).toLocaleString('en-US', { style: 'currency', currency: 'THB' })}
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableHead>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Add/Edit Dialogs */}
        <Dialog open={openTypeDialog} onClose={() => setOpenTypeDialog(false)}>
          <DialogTitle>Add New Expense Type</DialogTitle>
          <DialogContent><TextField autoFocus label="Type Name" fullWidth value={newType} onChange={(e) => setNewType(e.target.value)} /></DialogContent>
          <DialogActions><Button onClick={() => setOpenTypeDialog(false)}>Cancel</Button><Button onClick={handleAddType}>Add</Button></DialogActions>
        </Dialog>
        
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid item xs={12}><DatePicker label="Date" value={editFormData.date} onChange={handleEditDateChange} renderInput={(params) => <TextField {...params} fullWidth />} /></Grid>
              <Grid item xs={12}><FormControl fullWidth><InputLabel>Type</InputLabel><Select name="type" value={editFormData.type} label="Type" onChange={handleEditInputChange}>{expenseTypes.map(type => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}</Select></FormControl></Grid>
              <Grid item xs={12}><TextField name="amount" label="Amount (THB)" type="number" fullWidth value={editFormData.amount} onChange={handleEditInputChange} /></Grid>
              <Grid item xs={12}><TextField name="description" label="Description" fullWidth value={editFormData.description} onChange={handleEditInputChange} /></Grid>
              <Grid item xs={12}><TextField name="remarks" label="Remarks" fullWidth value={editFormData.remarks} onChange={handleEditInputChange} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={() => setEditDialogOpen(false)}>Cancel</Button><Button onClick={handleEditSave}>Save</Button></DialogActions>
        </Dialog>

        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogContent><Typography>Are you sure you want to delete this expense?</Typography></DialogContent>
          <DialogActions><Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button><Button onClick={handleDeleteConfirm} color="error">Delete</Button></DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Expenses;