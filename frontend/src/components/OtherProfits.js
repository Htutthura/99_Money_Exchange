import React, { useState, useEffect } from 'react';
import {
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Alert,
  Snackbar,
  InputAdornment,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { styled } from '@mui/material/styles';
import axios from 'axios';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
}));

const OtherProfitForm = ({ onSubmit, initialValues = null, editMode = false }) => {
  const [formState, setFormState] = useState({
    customer: '',
    thb_amount: '',
    remarks: '',
  });

  // Initialize form when in edit mode
  useEffect(() => {
    if (initialValues) {
      setFormState({
        customer: initialValues.customer || '',
        thb_amount: initialValues.thb_amount?.toString() || '',
        remarks: initialValues.remarks || '',
      });
    }
  }, [initialValues]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formState.customer.trim()) {
      alert('Please enter a customer name');
      return;
    }
    
    if (!formState.thb_amount || parseFloat(formState.thb_amount) <= 0) {
      alert('Please enter a valid THB amount (must be greater than zero)');
      return;
    }
    
    if (!formState.remarks.trim()) {
      alert('Please enter remarks');
      return;
    }
    
    // Create form data for API request
    const thbAmount = parseFloat(formState.thb_amount);
    const formData = {
      transaction_type: 'OTHER',
      customer: formState.customer.trim(),
      thb_amount: thbAmount,
      // These fields are required by model but not relevant for OTHER type
      mmk_amount: 0,  
      rate: 0,
      hundred_k_rate: 0,
      // The profit amount is same as THB amount for OTHER transactions
      profit: thbAmount,
      remarks: formState.remarks.trim()
    };

    // Pass to parent component
    onSubmit(formData);
    
    // Reset form after submission (only if not in edit mode)
    if (!editMode) {
      setFormState({
        customer: '',
        thb_amount: '',
        remarks: '',
      });
    }
  };

  return (
    <StyledPaper>
      <form onSubmit={handleSubmit}>
        <Typography variant="h6" gutterBottom>
          {editMode ? 'Edit Other Profit' : 'Add Other Profit'}
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Customer"
              name="customer"
              value={formState.customer}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="THB Profit Amount"
              name="thb_amount"
              type="number"
              value={formState.thb_amount}
              onChange={handleChange}
              required
              helperText="Enter the profit amount in Thai Baht (THB)"
              InputProps={{
                startAdornment: <InputAdornment position="start">฿</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Remarks"
              name="remarks"
              value={formState.remarks}
              onChange={handleChange}
              required
              multiline
              rows={3}
              helperText="Enter details about this profit transaction"
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
              >
                {editMode ? 'Update Other Profit' : 'Add Other Profit'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </StyledPaper>
  );
};

// API URL constants
const API_BASE = 'https://99moneyexchange.pythonanywhere.com/api';
const API_URL = `${API_BASE}/transactions`;

const OtherProfits = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  // New edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Fetch only the "OTHER" transaction types
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Use the list endpoint with type=OTHER filter
      const response = await axios.get(`${API_URL}/list/`, {
        params: {
          type: 'OTHER',
          show_all: true,
          timestamp: new Date().getTime()
        }
      });
      
      console.log('OtherProfits - Response data:', response.data);
      
      // Ensure transactions is always an array
      if (Array.isArray(response.data)) {
        setTransactions(response.data);
      } else if (response.data.results && Array.isArray(response.data.results)) {
        setTransactions(response.data.results);
      } else {
        console.error('Expected an array but got:', response.data);
        setTransactions([]);
        setSnackbar({
          open: true,
          message: 'Error: Received invalid data format from server',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error fetching other profit transactions:', error);
      setTransactions([]);
      setSnackbar({
        open: true,
        message: 'Failed to load transactions: ' + (error.response?.data?.detail || error.message),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDeleteClick = (transaction) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleConfirmDelete = async () => {
    try {
              await axios.delete(`https://99moneyexchange.pythonanywhere.com/api/transactions/${selectedTransaction.id}/`);
      setSnackbar({
        open: true,
        message: 'Transaction deleted successfully',
        severity: 'success',
      });
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete transaction',
        severity: 'error',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedTransaction(null);
    }
  };

  // Handle edit button click
  const handleEditClick = (transaction) => {
    setEditMode(true);
    setEditingTransaction(transaction);
    // Scroll to the top of the page to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddTransaction = async (formData) => {
    try {
      setLoading(true);
      let response;
      
      if (editMode && editingTransaction) {
        // Update existing transaction
        response = await axios.put(`${API_URL}/${editingTransaction.id}/`, formData);
        setSnackbar({
          open: true,
          message: 'Other profit transaction updated successfully',
          severity: 'success',
        });
        setEditMode(false);
        setEditingTransaction(null);
      } else {
        // Create new transaction using the create endpoint
        response = await axios.post(`${API_URL}/create/`, formData);
        setSnackbar({
          open: true,
          message: 'Other profit transaction added successfully',
          severity: 'success',
        });
      }
      
      // Refresh the transactions list
      fetchTransactions();
      
      // Notify dashboard to update
      window.dispatchEvent(new Event('profit-calculated'));
      
    } catch (error) {
      console.error('Error adding/updating other profit transaction:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save transaction: ' + (error.response?.data?.detail || error.message),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <>
      <OtherProfitForm 
        onSubmit={handleAddTransaction} 
        initialValues={editingTransaction}
        editMode={editMode}
      />
      
      <StyledPaper>
        <Typography variant="h6" gutterBottom>
          Other Profit Transactions
        </Typography>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell align="right">THB Amount</TableCell>
                    <TableCell>Remarks</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No other profit transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    Array.isArray(transactions) && transactions
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDate(transaction.date_time)}</TableCell>
                          <TableCell>{transaction.customer}</TableCell>
                          <TableCell align="right">฿{Number(transaction.thb_amount).toFixed(2)}</TableCell>
                          <TableCell>{transaction.remarks}</TableCell>
                          <TableCell align="center">
                            <IconButton
                              color="primary"
                              onClick={() => handleEditClick(transaction)}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              color="error"
                              onClick={() => handleDeleteClick(transaction)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={transactions.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </StyledPaper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this other profit transaction? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default OtherProfits; 
