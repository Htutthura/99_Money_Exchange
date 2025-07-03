import React from 'react';
import { Box, Typography } from '@mui/material';
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

  const handleTabClick = (value) => {
    onTabChange(null, value);
  };

  return (
    <Box
      sx={{
        display: { xs: 'flex', md: 'none' }, // Only show on mobile
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#1a1a1a', // Dark background
        paddingTop: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', // Safe area padding
        paddingLeft: '8px',
        paddingRight: '8px',
        justifyContent: 'space-between', // Even distribution across full width
        alignItems: 'flex-start', // Align to top for consistent positioning
        borderTop: '1px solid #333',
      }}
    >
      {navigationItems.map((item) => {
        const isActive = currentTab === item.value;
        
        return (
          <Box
            key={item.value}
            onClick={() => handleTabClick(item.value)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              flex: 1, // Equal width for all items
              maxWidth: '60px', // Consistent max width
              padding: '0 2px', // Minimal padding for balance
            }}
          >
            {/* Circular Icon Background */}
            <Box
              sx={{
                width: '48px', // Slightly smaller for better balance
                height: '48px',
                borderRadius: '50%',
                backgroundColor: isActive ? '#00FF7F' : '#333', // Green for active, dark for inactive
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '6px', // Consistent spacing to text
                transition: 'background-color 0.2s ease',
                '& .MuiSvgIcon-root': {
                  fontSize: '22px', // Consistent icon size
                  color: isActive ? '#000' : '#fff', // Black icon on green, white on dark
                },
              }}
            >
              {item.icon}
            </Box>
            
            {/* Label - Fixed height container for alignment */}
            <Box
              sx={{
                height: '28px', // Fixed height for text alignment
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.65rem', // Slightly smaller for better fit
                  fontWeight: 400,
                  color: isActive ? '#00FF7F' : '#888', // Green text for active, gray for inactive
                  textAlign: 'center',
                  lineHeight: 1.1,
                  wordBreak: 'break-word', // Allow text wrapping if needed
                  maxWidth: '56px', // Prevent text overflow
                }}
              >
                {item.label}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default BottomNavigationBar; 