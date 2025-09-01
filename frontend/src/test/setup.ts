import { beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Setup default window.location for all tests
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
  configurable: true,
})

// Setup default window dimensions for responsive tests
Object.defineProperty(window, 'innerWidth', {
  value: 1024,
  writable: true,
  configurable: true,
})

Object.defineProperty(window, 'innerHeight', {
  value: 768,
  writable: true,
  configurable: true,
})

// Reset DOM before each test
beforeEach(() => {
  document.body.innerHTML = ''
})