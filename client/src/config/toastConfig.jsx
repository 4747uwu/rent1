// src/config/toastConfig.jsx
import { Toaster } from 'react-hot-toast';

export const ToastConfig = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        // Default options
        duration: 4000,
        style: {
          background: '#ffffff',
          color: '#1f2937',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb',
          maxWidth: '400px',
        },
        
        // Success toast
        success: {
          duration: 3000,
          style: {
            background: '#ffffff',
            color: '#065f46',
            border: '1px solid #10b981',
            boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.1), 0 2px 4px -1px rgba(16, 185, 129, 0.06)',
          },
          iconTheme: {
            primary: '#10b981',
            secondary: '#ffffff',
          },
        },
        
        // Error toast
        error: {
          duration: 5000,
          style: {
            background: '#ffffff',
            color: '#991b1b',
            border: '1px solid #ef4444',
            boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1), 0 2px 4px -1px rgba(239, 68, 68, 0.06)',
          },
          iconTheme: {
            primary: '#ef4444',
            secondary: '#ffffff',
          },
        },
        
        // Loading toast
        loading: {
          style: {
            background: '#ffffff',
            color: '#1f2937',
            border: '1px solid #3b82f6',
            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06)',
          },
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#ffffff',
          },
        },
        
        // Custom toast
        custom: {
          duration: 4000,
        },
      }}
    />
  );
};

export default ToastConfig;