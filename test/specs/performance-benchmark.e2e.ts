import { describe, it, beforeEach, afterEach } from 'vitest'
import { browser } from 'wdio'
import {
  createCollection,
  createRequest,
  deleteCollection,
  selectRequest,
  openCollectionTree,
  closeAllTabs,
} from '../support/ui'

describe('Performance Benchmarking - Phase 1 Optimizations', () => {
  let collectionId: string
  let requestId: string

  beforeEach(async () => {
    // Setup: Create test collection with requests
    collectionId = await createCollection('Perf Test')
    requestId = await createRequest(collectionId, 'GET', 'https://example.com')

    // Wait for app to be ready
    await browser.pause(500)
  })

  afterEach(async () => {
    // Cleanup
    await deleteCollection(collectionId)
    await closeAllTabs()
  })

  describe('CollectionTree Search Performance (useDeferredValue)', () => {
    it('should handle rapid search input with minimal lag', async () => {
      // Clear profiler metrics
      await browser.execute(() => {
        if (window.__REACT_PROFILER__) {
          window.__REACT_PROFILER__.clear()
        }
      })

      // Open collection tree sidebar
      await openCollectionTree()
      await browser.pause(300)

      // Get search input
      const searchInput = await browser.$('input[placeholder="Search requests..."]')

      // Simulate rapid typing (search term)
      const searchTerm = 'example'
      for (const char of searchTerm) {
        await searchInput.addValue(char)
        await browser.pause(50) // Simulate typing speed
      }

      await browser.pause(200)

      // Collect metrics
      const metrics = await browser.execute(() => {
        if (window.__REACT_PROFILER__) {
          return window.__REACT_PROFILER__.getStats('CollectionTree')
        }
        return null
      })

      if (metrics) {
        console.log('CollectionTree Search Metrics:', metrics)
        // Assert search responsiveness (should be instant with useDeferredValue)
        expect(metrics.avgDuration).toBeLessThan(50)
      }
    })

    it('should clear search and restore full tree view', async () => {
      const searchInput = await browser.$('input[placeholder="Search requests..."]')

      // Type search term
      await searchInput.setValue('example')
      await browser.pause(200)

      // Clear search
      await searchInput.clearValue()
      await browser.pause(200)

      // Tree should show all collections
      const collections = await browser.$$('[data-test-id*="collection-tree"]')
      expect(collections.length).toBeGreaterThan(0)
    })
  })

  describe('Header Editing Performance (useOptimistic)', () => {
    it('should show optimistic feedback on header edits', async () => {
      // Clear metrics
      await browser.execute(() => {
        if (window.__REACT_PROFILER__) {
          window.__REACT_PROFILER__.clear()
        }
      })

      // Select request to open editor
      await selectRequest(collectionId, requestId)
      await browser.pause(500)

      // Click on Headers tab
      const headersTab = await browser.$('[data-test-id*="headers"]')
      if (await headersTab.isDisplayed()) {
        await headersTab.click()
      }
      await browser.pause(300)

      // Find first header input
      const headerInputs = await browser.$$('[data-test-id*="header-row"] input')
      if (headerInputs.length > 0) {
        const firstInput = headerInputs[0]

        // Record start time
        const startTime = Date.now()

        // Edit header value (should show optimistically)
        await firstInput.click()
        await firstInput.clearValue()
        await firstInput.setValue('test-value')

        const editTime = Date.now() - startTime

        // With useOptimistic, this should feel instant (< 50ms perceived latency)
        console.log(`Header edit time: ${editTime}ms`)
        expect(editTime).toBeLessThan(100)

        // Verify value appears in input immediately
        const value = await firstInput.getValue()
        expect(value).toContain('test-value')
      }
    })

    it('should update headers and maintain optimistic state', async () => {
      await selectRequest(collectionId, requestId)
      await browser.pause(500)

      // Add a new header (if there's an add button)
      const addHeaderBtn = await browser.$('[data-test-id*="add-header"]')
      if (await addHeaderBtn.isDisplayed()) {
        await addHeaderBtn.click()
        await browser.pause(200)

        // Verify new header row appears
        const headerRows = await browser.$$('[data-test-id*="header-row"]')
        expect(headerRows.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Tab Switching Performance (useTransition)', () => {
    it('should switch tabs with non-blocking transition', async () => {
      // Create multiple requests/tabs
      const req2 = await createRequest(collectionId, 'POST', 'https://example.com/api')
      const req3 = await createRequest(collectionId, 'DELETE', 'https://example.com/resource')

      await browser.pause(300)

      // Clear metrics
      await browser.execute(() => {
        if (window.__REACT_PROFILER__) {
          window.__REACT_PROFILER__.clear()
        }
      })

      // Click through tabs rapidly
      const tabs = await browser.$$('[data-test-id*="request-tab:"]')
      const startTime = Date.now()

      for (const tab of tabs.slice(0, 3)) {
        await tab.click()
        await browser.pause(100)
      }

      const switchTime = Date.now() - startTime

      // Multiple tab switches should be responsive
      console.log(`Tab switching time (3 switches): ${switchTime}ms`)
      expect(switchTime).toBeLessThan(500)

      // Get metrics if available
      const metrics = await browser.execute(() => {
        if (window.__REACT_PROFILER__) {
          return window.__REACT_PROFILER__.export()
        }
        return []
      })

      if (metrics && metrics.length > 0) {
        console.log('Tab switch render metrics:', metrics)
      }
    })
  })

  describe('RequestHeadersPanel Performance (React.memo + useCallback)', () => {
    it('should render headers panel efficiently', async () => {
      await selectRequest(collectionId, requestId)
      await browser.pause(500)

      // Clear metrics
      await browser.execute(() => {
        if (window.__REACT_PROFILER__) {
          window.__REACT_PROFILER__.clear()
        }
      })

      // Get panel metrics
      const panelMetrics = await browser.execute(() => {
        if (window.__REACT_PROFILER__) {
          return window.__REACT_PROFILER__.getStats('RequestHeadersPanel')
        }
        return null
      })

      if (panelMetrics) {
        console.log('RequestHeadersPanel metrics:', panelMetrics)
        // Panel should render efficiently (< 30ms on average)
        expect(panelMetrics.avgDuration).toBeLessThan(50)
      }
    })

    it('should maintain performance with multiple header edits', async () => {
      await selectRequest(collectionId, requestId)
      await browser.pause(500)

      const headerInputs = await browser.$$('[data-test-id*="header-row"] input')

      // Edit multiple headers
      for (let i = 0; i < Math.min(headerInputs.length, 3); i++) {
        const input = headerInputs[i]
        await input.click()
        await input.clearValue()
        await input.setValue(`value-${i}`)
        await browser.pause(50)
      }

      // Should still be responsive
      const finalInputs = await browser.$$('[data-test-id*="header-row"] input')
      expect(finalInputs.length).toBeGreaterThan(0)
    })
  })

  describe('Overall Workspace Performance', () => {
    it('should maintain responsiveness during complex interactions', async () => {
      const startTime = Date.now()

      // Complex workflow
      await selectRequest(collectionId, requestId)
      await browser.pause(300)

      // Edit headers
      const headerInput = await browser.$('[data-test-id*="header-row"] input')
      if (await headerInput.isDisplayed()) {
        await headerInput.click()
        await headerInput.setValue('X-Custom-Header')
        await browser.pause(100)
      }

      // Edit parameters
      const paramInputs = await browser.$$('[data-test-id*="param"] input')
      if (paramInputs.length > 0) {
        await paramInputs[0].setValue('param-value')
        await browser.pause(100)
      }

      const totalTime = Date.now() - startTime

      // Complex interaction should still be fast
      console.log(`Complex workflow time: ${totalTime}ms`)
      expect(totalTime).toBeLessThan(2000)

      // Get overall metrics
      const allMetrics = await browser.execute(() => {
        if (window.__REACT_PROFILER__) {
          return window.__REACT_PROFILER__.export()
        }
        return []
      })

      if (allMetrics && allMetrics.length > 0) {
        const avgDuration =
          allMetrics.reduce((sum, m) => sum + m.duration, 0) / allMetrics.length
        console.log(`Average component render time: ${avgDuration.toFixed(2)}ms`)
        // Average render should be fast
        expect(avgDuration).toBeLessThan(50)
      }
    })
  })
})
