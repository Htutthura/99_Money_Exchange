import React, { useState } from 'react';
import { Container, Typography, CssBaseline, Box, AppBar, Toolbar, Tabs, Tab, CircularProgress, Snackbar, Alert, Button, Avatar, Menu, MenuItem, Divider } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LogoutOutlined, Settings } from '@mui/icons-material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import ChangePassword from './components/ChangePassword';
import TransactionTable from './components/TransactionTable';
import Dashboard from './components/Dashboard';
import OtherProfits from './components/OtherProfits';
import BankBalances from './components/BankBalances';
import DailyProfits from './components/DailyProfits';
import Expenses from './components/Expenses';

// Create a custom theme with 99 Money Exchange brand colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#00FF7F', // Bright green from the logo
      contrastText: '#000000',
    },
    secondary: {
      main: '#0c2340', // Dark blue as secondary color
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F7F8', // Updated body background color
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Arial", sans-serif',
    h3: {
      fontWeight: 700,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        },
      },
    },
  },
});

// User menu component
const UserMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleClose();
  };

  const handleChangePassword = () => {
    setChangePasswordOpen(true);
    handleClose();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
      <Button
        onClick={handleMenu}
        color="inherit"
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          textTransform: 'none',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <Avatar 
          sx={{ 
            width: 32, 
            height: 32, 
            bgcolor: '#00FF7F', 
            color: 'black',
            fontSize: '0.9rem',
            fontWeight: 'bold',
          }}
        >
          {user?.username?.charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {user?.username}
        </Typography>
      </Button>
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: 2,
            minWidth: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {user?.username}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.is_staff ? 'Administrator' : 'User'}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={handleChangePassword} sx={{ gap: 2 }}>
          <Settings fontSize="small" />
          Change Password
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ gap: 2, color: 'error.main' }}>
          <LogoutOutlined fontSize="small" />
          Logout
        </MenuItem>
      </Menu>
      
      {/* Change Password Dialog */}
      <ChangePassword 
        open={changePasswordOpen} 
        onClose={() => setChangePasswordOpen(false)} 
      />
    </Box>
  );
};

// Main application component
const MainApp = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // Function to render the current tab component
  const renderCurrentTab = () => {
    switch (currentTab) {
      case 0:
        return <TransactionTable />;
      case 1:
        return <OtherProfits />;
      case 2:
        return <BankBalances />;
      case 3:
        return <DailyProfits />;
      case 4:
        return <Dashboard key={`dashboard-${currentTab === 4}`} autoRecalculate={currentTab === 4} />;
      case 5:
        return <Expenses />;
      default:
        return <TransactionTable />;
    }
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <CircularProgress size={48} />
          <Typography variant="h6" color="text.secondary">
            Loading...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login />
      </ThemeProvider>
    );
  }

  // Show main app if authenticated
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar 
        position="fixed" 
        elevation={0} 
        sx={{ 
          bgcolor: '#0B1C1C',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: (theme) => theme.zIndex.drawer + 1
        }}
      >
        <Toolbar sx={{ py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              component="img"
              src="/99money_logo_new.jpg"
              alt="99 Money Exchange Logo"
              sx={{ 
                height: 100,
                mr: 3
              }}
            />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'white' }}>
              99 Money Exchange
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange} 
              indicatorColor="primary"
              sx={{ 
                '& .MuiTab-root': { 
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  color: 'white',
                  opacity: 0.7,
                  '&.Mui-selected': {
                    color: '#00FF7F',
                    opacity: 1
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#00FF7F'
                } 
              }}
            >
              <Tab label="Transactions" />
              <Tab label="Other Profits" />
              <Tab label="Balances" />
              <Tab label="Daily Profits" />
              <Tab label="Dashboard" />
              <Tab label="Expenses" />
            </Tabs>
            
            {/* User Menu */}
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ paddingTop: '130px' }}>
        <Box sx={{ mt: 2, mb: 6 }}>
          {loading ? (
            <CircularProgress />
          ) : (
            renderCurrentTab()
          )}
        </Box>
      </Container>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

// Root App component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App; 