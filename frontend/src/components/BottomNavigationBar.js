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
        elevation={8}
        sx={{
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0B1C1C 0%, #1a2f2f 100%)',
        }}
      >
        <BottomNavigation
          value={currentTab}
          onChange={handleChange}
          showLabels
          sx={{
            height: 70,
            backgroundColor: 'transparent',
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '8px 4px',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.75rem',
              fontWeight: 500,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&.Mui-selected': {
                color: '#00FF7F',
                transform: 'translateY(-2px)',
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  opacity: 1,
                },
                '& .MuiSvgIcon-root': {
                  fontSize: '28px',
                  filter: 'drop-shadow(0 2px 4px rgba(0, 255, 127, 0.3))',
                },
              },
              '&:hover': {
                color: 'rgba(0, 255, 127, 0.8)',
                transform: 'translateY(-1px)',
              },
              '& .MuiSvgIcon-root': {
                fontSize: '24px',
                marginBottom: '2px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.7rem',
                fontWeight: 500,
                opacity: 0.8,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&.Mui-selected': {
                  opacity: 1,
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
              sx={{
                // Minimum touch target of 48px
                minHeight: '48px',
                // Add subtle animation on active state
                '&.Mui-selected': {
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '4px',
                    height: '3px',
                    backgroundColor: '#00FF7F',
                    borderRadius: '0 0 2px 2px',
                  },
                },
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default BottomNavigationBar; 