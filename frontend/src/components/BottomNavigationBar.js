import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper, Box } from '@mui/material';
import { 
  Receipt, 
  Money, 
  AccountBalanceWallet, 
  TrendingUp, 
  Dashboard as DashboardIcon, 
  PieChart 
} from '@mui/icons-material';

const BottomNavigationBar = ({ currentTab, onTabChange }) => {
  const navigationItems = [
    { 
      label: 'Transactions', 
      icon: <Receipt />,
      value: 0 
    },
    { 
      label: 'Other Profits', 
      icon: <Money />,
      value: 1 
    },
    { 
      label: 'Balances', 
      icon: <AccountBalanceWallet />,
      value: 2 
    },
    { 
      label: 'Daily Profits', 
      icon: <TrendingUp />,
      value: 3 
    },
    { 
      label: 'Dashboard', 
      icon: <DashboardIcon />,
      value: 4 
    },
    { 
      label: 'Expenses', 
      icon: <PieChart />,
      value: 5 
    },
  ];

  const handleChange = (event, newValue) => {
    onTabChange(event, newValue);
  };

  return (
    <Box
      sx={{
        display: { xs: 'block', md: 'none' }, // Only show on mobile
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        // Add safe area padding for newer phones
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <Paper 
        elevation={0}
        sx={{
          borderRadius: 0,
          backgroundColor: '#1a1a1a', // Dark background to match photo
          borderTop: '1px solid #333',
        }}
      >
        <BottomNavigation
          value={currentTab}
          onChange={handleChange}
          showLabels
          sx={{
            height: 80, // Slightly taller to match photo
            backgroundColor: '#1a1a1a', // Match dark background
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '6px 4px 8px 4px',
              color: '#888', // Inactive tab color
              fontSize: '0.75rem',
              fontWeight: 400,
              transition: 'color 0.2s ease',
              
              // Active state - highlighted in green like the photo
              '&.Mui-selected': {
                color: '#00FF7F', // Bright green for active tab
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  marginTop: '2px',
                },
                '& .MuiSvgIcon-root': {
                  fontSize: '26px',
                },
              },
              
              // Icon styling
              '& .MuiSvgIcon-root': {
                fontSize: '24px',
                marginBottom: '4px',
                transition: 'font-size 0.2s ease',
              },
              
              // Label styling
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.7rem',
                fontWeight: 400,
                lineHeight: 1.2,
                marginTop: '2px',
                transition: 'all 0.2s ease',
                '&.Mui-selected': {
                  fontSize: '0.75rem',
                  fontWeight: 500,
                },
              },
            },
          }}
        >
          {navigationItems.map((item) => (
            <BottomNavigationAction
              key={item.value}
              label={item.label}
              value={item.value}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default BottomNavigationBar; 