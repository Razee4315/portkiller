import { render } from 'preact'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById('app')!,
)
