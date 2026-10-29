import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { Layout } from './components/Layout'
import './index.css'
import { DecisionPage } from './pages/DecisionPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { initTheme } from './lib/theme'

initTheme()

// The backend serves a fixed data snapshot, so cached responses never go stale.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false } },
})

const router = createBrowserRouter([
  {
    element: <Layout />,
    // Shown while a lazily loaded page is fetched on a direct visit.
    hydrateFallbackElement: <div className="min-h-dvh bg-page" />,
    children: [
      { path: '/', element: <DecisionPage /> },
      {
        path: '/accuracy',
        lazy: () => import('./pages/AccuracyPage').then((m) => ({ Component: m.AccuracyPage })),
      },
      {
        path: '/methodology',
        lazy: () => import('./pages/MethodologyPage').then((m) => ({ Component: m.MethodologyPage })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
