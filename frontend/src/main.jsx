import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#101827',
              color: '#E2E8F0',
              border: '1px solid #1E293B',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontFamily: 'Inter, sans-serif',
            },
            duration: 4000,
            success: { iconTheme: { primary: '#10B981', secondary: '#101827' } },
            error:   { iconTheme: { primary: '#EF4444', secondary: '#101827' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
