import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Avatar,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import ForgotPassword from './ForgotPassword';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(username, password);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
    
    setLoading(false);
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
        }}
      >
        {/* Logo and Brand */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box
            component="img"
            src="/99money_logo_new.jpg"
            alt="99 Money Exchange Logo"
            sx={{ 
              height: 120,
              mb: 2,
              borderRadius: 2,
            }}
          />
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              fontWeight: 'bold', 
              color: '#0B1C1C',
              mb: 1,
            }}
          >
            99 Money Exchange
          </Typography>
          <Typography 
            variant="subtitle1" 
            color="text.secondary"
          >
            Management System
          </Typography>
        </Box>

        {/* Login Form */}
        <Paper 
          elevation={8}
          sx={{ 
            p: 4, 
            width: '100%',
            borderRadius: 3,
            background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Avatar sx={{ m: 1, bgcolor: '#00FF7F', width: 56, height: 56 }}>
              <LockIcon sx={{ fontSize: 28 }} />
            </Avatar>
            <Typography component="h2" variant="h5" sx={{ fontWeight: 600 }}>
              Sign In
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Access your account to manage transactions
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ 
                mt: 3, 
                mb: 2, 
                py: 1.5,
                borderRadius: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                background: 'linear-gradient(45deg, #00FF7F 30%, #00E676 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #00E676 30%, #00C853 90%)',
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Forgot Password Link */}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="text"
                onClick={() => setForgotPasswordOpen(true)}
                sx={{
                  textTransform: 'none',
                  color: '#00FF7F',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 255, 127, 0.04)',
                  },
                }}
              >
                Forgot your password?
              </Button>
            </Box>

            {/* Default Credentials Info */}
            <Box 
              sx={{ 
                mt: 3, 
                p: 2, 
                bgcolor: '#f5f5f5', 
                borderRadius: 2,
                border: '1px solid #e0e0e0',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 1 }}>
                Default Login Credentials:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Username:</strong> admin<br />
                <strong>Password:</strong> admin123
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Footer */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          © 2024 99 Money Exchange. All rights reserved.
        </Typography>
      </Box>
      
      {/* Forgot Password Dialog */}
      <ForgotPassword 
        open={forgotPasswordOpen} 
        onClose={() => setForgotPasswordOpen(false)} 
      />
    </Container>
  );
};

export default Login; 