import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';

const theme = createTheme({
  palette: {
    primary: { main: '#00FF7F', contrastText: '#000000' },
    secondary: { main: '#0c2340', contrastText: '#FFFFFF' },
    background: { default: '#F5F7F8', paper: '#ffffff' },
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Login />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;