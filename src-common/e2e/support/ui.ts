/**
 * E2E test helper functions for interacting with the UI.
 *
 * All helpers use semantic waits instead of arbitrary pauses, waiting for actual UI state changes.
 *
 * COMMON PATTERNS:
 * - getElementByTestId(testId) - Foundation for all interactions, waits for element to exist
 * - clickByTestId(testId) - Click a button or interactive element
 * - setInputText(testId, value) - Set input value and wait for it to update
 * - selectOptionByTestId(trigger, option) - Select from dropdown/menu and wait for close
 * - setSwitchState(testId, true/false) - Toggle switch on/off
 * - expectTextContent(testId, pattern) - Assert element contains text (regex or string)
 * - waitForTestIdToDisappear(testId) - Wait for dialog/modal to close
 *
 * SETUP HELPERS:
 * - ensureAppReady() - Wait for app to load before running tests
 * - ensureWorkspaceReady() - Wait for full app hydration and state loading
 * - navigateTo(path) - Navigate to a route
 * - resetOverlays() - Close any open dialogs/modals
 *
 * COLLECTION/REQUEST HELPERS:
 * - createCollection(name) - Create new collection via UI
 * - openNewRequestViaUI() - Create new request and return tab key
 * - selectMenuActionById(actionId, {triggerTestId}) - Select from context menu
 */

import { expect } from "@wdio/globals"

const DEFAULT_TIMEOUT = 15000
const ESCAPE_KEY = "Escape"

/**
 * Default timing configuration for waitFor operations:
 * - initialDelay: time to wait before starting to poll (allows UI to render)
 * - pollingInterval: how frequently to check once polling starts
 *   Note: 100ms is a good balance. Too aggressive (50ms) can starve the browser event loop.
 */
const DEFAULT_WAIT_CONFIG = {
  initialDelay: 0,
  pollingInterval: 100,
}

/**
 * Log timestamp for test step timing analysis
 * Usage: await logTestTime("Step description")
 */
export async function logTestTime(step: string): Promise<void> {
  const timestamp = new Date().toISOString()
  console.log(`[TEST-TIME] ${timestamp} ${step}`)
}

/**
 * Wait for the app to be fully loaded and interactive
 */
async function waitForAppReady(timeout = DEFAULT_TIMEOUT): Promise<void> {
  // Wait for React to render and the app to be interactive
  // Check document readiness - the app:main-window element appears later, so skip that check
  await browser.waitUntil(
    async () => {
      const ready = await browser.execute(() => {
        return document.readyState === "complete"
      })
      return ready
    },
    {
      timeout: Math.min(timeout, 10000),
      interval: 100,
      timeoutMsg: "App did not load in time",
    },
  )
}

async function withFallbackClick(element: WebdriverIO.Element): Promise<void> {
  try {
    await element.click()
    return
  } catch {}

  await browser.execute((el: HTMLElement) => {
    const dispatchers = [
      (e: HTMLElement) => e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
      (e: HTMLElement) => e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })),
      (e: HTMLElement) => e.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    ]
    dispatchers.forEach((dispatch) => {
      dispatch(el)
    })
  }, element)
}

/**
 * Find an element by its data-test-id attribute and wait for it to exist.
 * Use this as the foundation for all element interactions.
 *
 * @param testId - The data-test-id value to search for
 * @param timeout - How long to wait for element to appear (default 15s)
 * @param options - Optional timing configuration
 * @returns The WebdriverIO Element object once found
 * @throws If element doesn't appear within timeout
 *
 * @example
 * const button = await getElementByTestId("my-button")
 * const input = await getElementByTestId("my-input", 5000) // custom timeout
 */
export async function getElementByTestId(
  testId: string,
  timeout = DEFAULT_TIMEOUT,
  options?: { initialDelay?: number; pollingInterval?: number },
): Promise<WebdriverIO.Element> {
  const initialDelay = options?.initialDelay ?? DEFAULT_WAIT_CONFIG.initialDelay
  const pollingInterval = options?.pollingInterval ?? DEFAULT_WAIT_CONFIG.pollingInterval

  if (initialDelay > 0) {
    await browser.pause(initialDelay)
  }

  const locator = `[data-test-id="${testId}"]`
  const element = await $(locator)
  await element.waitForExist({ timeout, interval: pollingInterval })
  return element
}

async function getActiveRequestTabKey(): Promise<string | null> {
  return await browser.execute(() => {
    // Try to find the active tab with data-state="active"
    const active = document.querySelector<HTMLElement>('[data-test-id^="request-tab:"][data-state="active"]')
    if (active) {
      return active.getAttribute("data-tab-key") ?? null
    }

    // Fallback: get the last request tab (most recently opened)
    const tabs = Array.from(document.querySelectorAll<HTMLElement>('[data-test-id^="request-tab:"]'))
    if (tabs.length > 0) {
      const lastTab = tabs[tabs.length - 1]!
      return lastTab.getAttribute("data-tab-key") ?? null
    }

    return null
  })
}

/**
 * Wait for the active request tab to change from a previous value.
 * Useful after operations that should open a new tab.
 *
 * @param previous - The previous active tab key (from getActiveRequestTabKey or null)
 * @param timeout - How long to wait for change (default 15s)
 * @returns The new active tab key
 *
 * @example
 * const previousTab = await getActiveRequestTabKey()
 * await clickByTestId("new-request-button")
 * const newTab = await waitForActiveRequestTabChange(previousTab)
 */
export async function waitForActiveRequestTabChange(
  previous: string | null,
  timeout = DEFAULT_TIMEOUT,
): Promise<string> {
  let next: string | null = null
  await browser.waitUntil(
    async () => {
      next = await getActiveRequestTabKey()
      return Boolean(next && next !== previous)
    },
    {
      timeout,
      timeoutMsg: "Active request tab did not change",
    },
  )

  if (!next) {
    throw new Error("Active request tab key not resolved")
  }
  return next
}

export async function openNewRequestViaUI(): Promise<string> {
  const previous = await getActiveRequestTabKey()
  const titleButton = await $('[data-test-id="titlebar:new-request-button"]')
  if (await titleButton.isExisting()) {
    await clickByTestId("titlebar:new-request-button")
  } else {
    await clickByTestId("request-tab-bar:new-request-button")
  }
  return await waitForActiveRequestTabChange(previous)
}

export async function ensureAppReady(): Promise<void> {
  await waitForAppReady()
}

export async function navigateTo(path: string): Promise<void> {
  await browser.execute((target: string) => {
    window.history.pushState({}, "", target)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }, path)

  await browser.waitUntil(
    async () => {
      const current = await browser.execute(() => window.location.pathname)
      return current === path
    },
    {
      timeout: DEFAULT_TIMEOUT,
      interval: 100,
      timeoutMsg: `Failed to navigate to ${path}`,
    },
  )
}

export async function resetOverlays(attempts = 2): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await browser.keys([ESCAPE_KEY])
      // Wait for any overlay/modal to actually close
      // Check if there are any visible modal or dialog overlays
      await browser
        .waitUntil(
          async () => {
            // Look for visible overlay elements that might indicate open dialogs/modals
            const overlays = await browser.execute(() => {
              // Check for common overlay indicators
              const backdrop = document.querySelector('[data-radix-dialog-overlay], [role="dialog"], .modal-backdrop')
              if (!backdrop) {
                return 0
              }
              // Return number of visible overlays
              return Array.from(
                document.querySelectorAll('[data-radix-dialog-overlay], [role="dialog"], .modal-backdrop'),
              ).filter((el) => {
                const style = window.getComputedStyle(el as HTMLElement)
                return style.display !== "none" && style.visibility !== "hidden"
              }).length
            })
            // Continue if there are still overlays visible
            return overlays === 0
          },
          {
            timeout: 2000,
            interval: 50,
            timeoutMsg: "Overlay did not close after pressing Escape",
          },
        )
        .catch(() => {
          // It's OK if this times out - overlays might not exist
        })
    } catch {
      break
    }
  }
}

export async function ensureWorkspaceReady(): Promise<void> {
  await ensureAppReady()

  // Wait for the close button (always present in titlebar regardless of state)
  // By the time this renders, full hydration has completed and all state is loaded
  await browser.waitUntil(
    async () => {
      const closeButton = await $('[data-test-id="title-bar:close-button"]')
      if (await closeButton.isExisting()) {
        try {
          await closeButton.waitForDisplayed({ timeout: 200 })
          return true
        } catch {
          return false
        }
      }
      return false
    },
    {
      timeout: DEFAULT_TIMEOUT,
      interval: 100,
      timeoutMsg: "Workspace close button did not appear - app hydration incomplete",
    },
  )
}

/**
 * Simulate an app reload by refreshing the browser
 *
 * This triggers:
 * 1. Browser beforeunload event → app calls saveAll() to persist Zustand state
 * 2. Page refresh → DOM clears
 * 3. App remounts → Zustand restores state from disk
 *
 * Use this to verify that application state is properly persisted and restored.
 * After calling this, you should call ensureWorkspaceReady() to wait for app hydration.
 */
export async function simulateAppReload(): Promise<void> {
  console.log(`[SIMULATION] Simulating app reload via browser.refresh()`)
  await browser.refresh()
}

export async function resetAppState(): Promise<void> {
  console.log(`[TEST] ${new Date().toISOString()} Resetting app state via page reload`)

  // Prepare the app for reset (disable auto-save, etc)
  try {
    const bridge = await browser.execute(() => (window as any).__E2E_BRIDGE__)
    if (bridge && typeof bridge === "object") {
      // Note: we can't actually call the bridge method here because browser.execute returns serialized data
      // Instead, we'll just reload and the app will start fresh
    }
  } catch {
    // Continue with reset even if bridge prep fails
  }

  // Reload the page to get a clean slate
  await browser.keys(["Control", "r"])

  // Wait for the app to be ready again after reload
  await ensureWorkspaceReady()
  console.log(`[TEST] ${new Date().toISOString()} App state reset complete`)
}

/**
 * Set an input field's value and wait for React to update it.
 * Works with text inputs, textareas, and controlled components.
 *
 * @param testId - The data-test-id of the input element
 * @param value - The text value to set
 * @throws If input doesn't update to the expected value within timeout
 *
 * @example
 * await setInputText("search-input", "hello world")
 * await setInputText("name-field", "John Doe")
 */
export async function setInputText(testId: string, value: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await element.click()
  await element.setValue(value)
  // Wait for the value to be set on the element (for controlled inputs)
  await browser.waitUntil(
    async () => {
      const val = await element.getValue()
      return val === value
    },
    {
      timeout: DEFAULT_TIMEOUT,
      interval: 50,
      timeoutMsg: `Input did not update to "${value}"`,
    },
  )
}

/**
 * Get the current value of an input field.
 *
 * @param testId - The data-test-id of the input element
 * @returns The current input value
 *
 * @example
 * const value = await getInputText("email-input")
 * expect(value).toBe("user@example.com")
 */
export async function getInputText(testId: string): Promise<string> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  return element.getValue()
}

/**
 * Append text to an input field's existing value.
 * Triggers onChange events like a real user would.
 *
 * @param testId - The data-test-id of the input element
 * @param value - The text to append
 *
 * @example
 * await appendInputText("url-input", "?param=value")
 */
export async function appendInputText(testId: string, value: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  // addValue triggers onChange events, so this works correctly with controlled inputs
  await element.addValue(value)
}

/**
 * Clear an input field's value.
 *
 * @param testId - The data-test-id of the input element
 *
 * @example
 * await clearInputText("search-input")
 */
export async function clearInputText(testId: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await element.clearValue()
}

export async function waitForSendButtonReady(timeout = DEFAULT_TIMEOUT): Promise<void> {
  // Wait for the Send button to be visible and ready (Cancel button should disappear)
  // This ensures any pending request has completed before we send a new one
  await browser.waitUntil(
    async () => {
      const sendBtn = await $('[data-test-id="request-workspace:send-button"]')
      const cancelBtn = await $('[data-test-id="request-workspace:cancel-button"]')
      // Button is ready when Send exists and Cancel doesn't
      return (await sendBtn.isExisting()) && !(await cancelBtn.isExisting())
    },
    {
      timeout,
      interval: 100,
      timeoutMsg: "Send button did not become ready (request may still be pending)",
    },
  )
}

/**
 * Click a button or clickable element by its data-test-id.
 * Scrolls element into view and uses fallback click if standard click fails.
 *
 * @param testId - The data-test-id of the element to click
 *
 * @example
 * await clickByTestId("submit-button")
 * await clickByTestId("dialog:confirm-button")
 */
export async function clickByTestId(testId: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await element.scrollIntoView({ block: "center", inline: "center" })
  await withFallbackClick(element)
}

/**
 * Wait for an element to disappear from the DOM.
 * Useful for verifying dialogs, overlays, or notifications close properly.
 *
 * @param testId - The data-test-id of the element to wait for disappearance
 * @param timeout - How long to wait (default 15s)
 * @throws If element doesn't disappear within timeout
 *
 * @example
 * await waitForTestIdToDisappear("loading-spinner")
 * await waitForTestIdToDisappear("error-message", 5000)
 */
export async function waitForTestIdToDisappear(testId: string, timeout = DEFAULT_TIMEOUT): Promise<void> {
  const locator = `[data-test-id="${testId}"]`
  await browser.waitUntil(async () => !(await $(locator).isExisting()), {
    timeout,
    interval: 100,
    timeoutMsg: `Element ${testId} remained visible`,
  })
}

/**
 * Select an option from a dropdown (Radix Select or similar).
 * Opens the dropdown, waits for the option to appear, clicks it, and waits for menu to close.
 *
 * @param selectTriggerTestId - The data-test-id of the button/trigger that opens the dropdown
 * @param optionTestId - The data-test-id of the option to select
 * @throws If option doesn't appear or menu doesn't close within timeout
 *
 * @example
 * await selectOptionByTestId("auth-type-select", "auth-type:basic")
 * await selectOptionByTestId("method-dropdown", "method:post")
 */
export async function selectOptionByTestId(selectTriggerTestId: string, optionTestId: string): Promise<void> {
  // Wait for trigger to be in the DOM and visible - give extra time for lazy-loaded content
  let trigger = await getElementByTestId(selectTriggerTestId, DEFAULT_TIMEOUT, { initialDelay: 100 })
  await browser.waitUntil(
    async () => {
      try {
        trigger = await getElementByTestId(selectTriggerTestId, 1000)
        const displayed = await trigger.isDisplayed()
        return displayed
      } catch {
        return false
      }
    },
    {
      timeout: 10000,
      interval: 150,
      timeoutMsg: `Select trigger ${selectTriggerTestId} did not become visible`,
    },
  )

  await trigger.scrollIntoView({ block: "center", inline: "center" })
  await withFallbackClick(trigger)

  // Give the dropdown menu time to render after click
  await browser.waitUntil(
    async () => {
      try {
        // Check if ANY menu content has appeared by looking for common menu element selectors
        const menuContent = await $('[role="menu"], [role="listbox"], [role="combobox"]')
        return await menuContent.isDisplayed().catch(() => false)
      } catch {
        return false
      }
    },
    {
      timeout: 5000,
      interval: 150,
      timeoutMsg: `Menu did not open for trigger ${selectTriggerTestId}`,
    },
  )

  // Wait for the option to appear in DOM and become displayed
  // Radix UI portals can take time to render, so we poll with retries
  await browser.waitUntil(
    async () => {
      try {
        const option = await $(`[data-test-id="${optionTestId}"]`)
        return await option.isDisplayed()
      } catch {
        return false
      }
    },
    {
      timeout: DEFAULT_TIMEOUT,
      interval: 100,
      timeoutMsg: `Option ${optionTestId} did not appear after opening menu`,
    },
  )

  const option = await getElementByTestId(optionTestId)
  await option.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await option.scrollIntoView({ block: "center", inline: "center" })
  await withFallbackClick(option)

  // Wait for menu to close after selection (option should disappear)
  await browser.waitUntil(
    async () => {
      try {
        const opt = await $(`[data-test-id="${optionTestId}"]`)
        return !(await opt.isDisplayed())
      } catch {
        // Element doesn't exist anymore (menu closed)
        return true
      }
    },
    {
      timeout: 5000,
      interval: 100,
      timeoutMsg: `Menu did not close after selecting ${optionTestId}`,
    },
  )
}

/**
 * Set a toggle switch to on or off.
 * Only clicks if current state differs from desired state.
 *
 * @param testId - The data-test-id of the switch element
 * @param desired - True for on, false for off
 *
 * @example
 * await setSwitchState("dark-mode-toggle", true)
 * await setSwitchState("notifications-switch", false)
 */
export async function setSwitchState(testId: string, desired: boolean): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  const current = await element.getAttribute("data-state")
  const isOn = current === "checked" || current === "on"
  if (isOn === desired) {
    return
  }
  await withFallbackClick(element)
}

export async function closeApplicationWindow(timeout = DEFAULT_TIMEOUT): Promise<void> {
  await browser.waitUntil(
    async () =>
      await browser.execute(() => {
        return Boolean(document.querySelector<HTMLElement>('[data-test-id="title-bar:close-button"]'))
      }),
    {
      timeout,
      interval: 100,
      timeoutMsg: "Close button not available",
    },
  )

  const clickSucceeded = await browser.execute(() => {
    const button = document.querySelector<HTMLElement>('[data-test-id="title-bar:close-button"]')
    if (!button) {
      return false
    }

    const events: Array<() => void> = [
      () => button.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })),
      () => button.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true })),
      () => button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 })),
      () => button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 })),
      () => button.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 })),
    ]

    events.forEach((fire) => {
      fire()
    })
    return true
  })

  if (!clickSucceeded) {
    throw new Error("Close button interaction failed")
  }

  await browser.waitUntil(
    async () => {
      try {
        const handles = await browser.getWindowHandles()
        return handles.length === 0
      } catch {
        return true
      }
    },
    {
      timeout,
      interval: 100,
      timeoutMsg: "Application window did not close",
    },
  )
}

/**
 * Set a checkbox to checked or unchecked.
 * Only clicks if current state differs from desired state.
 *
 * @param testId - The data-test-id of the checkbox element
 * @param desired - True for checked, false for unchecked
 *
 * @example
 * await setCheckboxState("agree-terms-checkbox", true)
 * await setCheckboxState("email-notification-checkbox", false)
 */
export async function setCheckboxState(testId: string, desired: boolean): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  const current = await element.getAttribute("data-state")
  const isChecked = current === "checked" || (await element.isSelected())
  if (isChecked === desired) {
    return
  }
  await withFallbackClick(element)
}

/**
 * Assert an element's text content matches a pattern.
 *
 * @param testId - The data-test-id of the element
 * @param expected - A string or RegExp pattern to match against
 * @throws If text doesn't match pattern
 *
 * @example
 * await expectTextContent("error-message", "Email is required")
 * await expectTextContent("welcome-text", /Welcome, \w+/)
 * await expectTextContent("price", /\$\d+\.\d{2}/)
 */
export async function expectTextContent(testId: string, expected: string | RegExp): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  const text = await element.getText()
  await expect(text).toMatch(expected)
}

export async function ensureCollectionRowVisible(
  collectionId: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<WebdriverIO.Element> {
  await browser.waitUntil(
    async () =>
      await browser.execute(
        ({ targetId }) => {
          return Boolean(document.querySelector(`[data-test-id="collection-tree:collection-row:${targetId}"]`))
        },
        { targetId: collectionId },
      ),
    {
      timeout,
      interval: 150,
      timeoutMsg: `Collection row ${collectionId} not visible`,
    },
  )

  const row = await getElementByTestId(`collection-tree:collection-row:${collectionId}`, timeout)
  await row.scrollIntoView({ block: "center", inline: "center" })
  return row
}

export async function openCollectionMenu(collectionId: string): Promise<void> {
  const row = await ensureCollectionRowVisible(collectionId)
  try {
    await row.moveTo()
  } catch {}
  // Right-click to open context menu
  await row.click({ button: 2 })
  // Wait for context menu to appear (look for any visible menu item)
  await browser.waitUntil(
    async () => {
      // Wait for at least one context menu item to be visible
      const contextMenuItems = await $$('[role="menuitem"]')
      for (const item of contextMenuItems) {
        if (await item.isDisplayed()) {
          return true
        }
      }
      return false
    },
    {
      timeout: 5000,
      interval: 100,
      timeoutMsg: "Context menu did not appear after right-click",
    },
  )
}

export async function selectCollectionRow(collectionId: string): Promise<void> {
  const row = await ensureCollectionRowVisible(collectionId)
  await withFallbackClick(row)
}

export async function expectAttributeValue(testId: string, attribute: string, expected: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  const value = await element.getAttribute(attribute)
  await expect(value).toBe(expected)
}

export async function selectMenuActionById(actionId: string, options: { triggerTestId: string }): Promise<void> {
  // Click the menu trigger to open it
  await clickByTestId(options.triggerTestId)

  // Wait for the menu to open by checking if the action item becomes displayed
  await browser.waitUntil(
    async () => {
      try {
        const actionElement = await $(`[data-test-id="${actionId}"]`)
        return await actionElement.isDisplayed()
      } catch {
        return false
      }
    },
    {
      timeout: 20000,
      interval: 100,
      timeoutMsg: `Menu action ${actionId} did not appear after opening menu`,
    },
  )

  // Click the menu action
  const actionElement = await $(`[data-test-id="${actionId}"]`)
  await actionElement.waitForDisplayed({ timeout: 20000 })
  await actionElement.scrollIntoView({ block: "center", inline: "center" })
  await withFallbackClick(actionElement)

  // Wait for menu to close after selection (action item should disappear)
  await browser.waitUntil(
    async () => {
      try {
        const elem = await $(`[data-test-id="${actionId}"]`)
        return !(await elem.isDisplayed())
      } catch {
        // Element doesn't exist anymore (menu closed)
        return true
      }
    },
    {
      timeout: 5000,
      interval: 100,
      timeoutMsg: `Menu did not close after selecting ${actionId}`,
    },
  )
}

/**
 * Ensures the sidebar is expanded so that collection tree items are visible.
 * If the sidebar is collapsed, clicks the expand button to show the collection tree.
 */
export async function ensureSidebarExpanded(timeout = 5000): Promise<void> {
  try {
    // Check if expand button exists (indicating sidebar is collapsed)
    const expandButton = await $('[data-test-id="sidebar:expand-button"]')
    if (await expandButton.isExisting()) {
      const isDisplayed = await expandButton.isDisplayed()
      if (isDisplayed) {
        // Sidebar is collapsed, click to expand
        await expandButton.click()
        // Wait for sidebar to expand and collection tree to appear
        await browser.waitUntil(
          async () => {
            const collapseButton = await $('[data-test-id="sidebar:collapse-button"]')
            return await collapseButton.isDisplayed()
          },
          {
            timeout,
            interval: 50,
            timeoutMsg: "Sidebar did not expand in time",
          },
        )
      }
    }
  } catch (error) {
    // If sidebar expand check fails, continue anyway - sidebar might already be expanded
    console.log("Sidebar expansion check encountered issue (may already be expanded):", error)
  }
}

/**
 * Clicks the new collection button, handling both expanded and collapsed sidebar states.
 */
export async function clickVisibleNewCollectionButton(): Promise<void> {
  const candidates = ["sidebar:new-collection-button", "sidebar:new-collection-button-collapsed"]
  for (const testId of candidates) {
    const elements = await $$(`[data-test-id="${testId}"]`)
    for (const element of elements) {
      if (await element.isDisplayed()) {
        await element.scrollIntoView({ block: "center", inline: "center" })
        await element.click()
        return
      }
    }
  }
  throw new Error("New collection trigger not visible")
}

/**
 * Creates a new collection via UI and returns its ID.
 */
export async function createCollection(name: string): Promise<string> {
  const NEW_COLLECTION_DIALOG_TEST_ID = "new-collection-dialog"
  await ensureSidebarExpanded()
  await clearSidebarSearch().catch(() => {})
  const beforeIds = await browser.execute(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-test-id^="collection-tree:collection-row:"]'))
      .map((el) => el.getAttribute("data-test-id"))
      .filter((id): id is string => Boolean(id))
  })

  await clickVisibleNewCollectionButton()
  await getElementByTestId(NEW_COLLECTION_DIALOG_TEST_ID, 5000)
  await setInputText(`${NEW_COLLECTION_DIALOG_TEST_ID}:name-input`, name)
  await clickByTestId(`${NEW_COLLECTION_DIALOG_TEST_ID}:create-button`)

  // Wait for dialog to close - check both existence and visibility
  await browser.waitUntil(
    async () => {
      try {
        const element = await $(`[data-test-id="${NEW_COLLECTION_DIALOG_TEST_ID}"]`)
        const exists = await element.isExisting()
        if (!exists) {
          return true
        }
        const displayed = await element.isDisplayed().catch(() => false)
        return !displayed
      } catch {
        return true
      }
    },
    {
      timeout: 10000,
      interval: 200,
      timeoutMsg: `Dialog ${NEW_COLLECTION_DIALOG_TEST_ID} did not close`,
    },
  )

  const newTestId = await browser.waitUntil(
    async () => {
      const ids = await browser.execute(() => {
        return Array.from(document.querySelectorAll<HTMLElement>('[data-test-id^="collection-tree:collection-row:"]'))
          .map((el) => el.getAttribute("data-test-id"))
          .filter((id): id is string => Boolean(id))
      })
      const diff = ids.filter((id) => !beforeIds.includes(id))
      return diff[0] ?? null
    },
    {
      timeout: 20000,
      interval: 150,
      timeoutMsg: "New collection row did not appear in sidebar",
    },
  )

  const match = newTestId?.match(/collection-tree:collection-row:(.+)$/)
  if (match?.[1]) {
    return match[1]
  }

  // Fallback to name search if diff strategy fails
  return await waitForCollectionIdByName(name)
}

/**
 * Finds a collection by name in the sidebar tree and returns its ID.
 * Throws if collection is not found.
 */
export async function waitForCollectionIdByName(name: string, timeout = 25000): Promise<string> {
  // Ensure sidebar is expanded before searching for collections
  await ensureSidebarExpanded()

  // Start from top of the list to ensure deterministic scan order
  await browser.execute(() => {
    const container = document.querySelector<HTMLElement>('[data-test-id="collection-tree"]')
    if (container) {
      container.scrollTop = 0
    }
  })

  const scrollAndFind = async (): Promise<string | null> => {
    const result = await browser.execute((searchName: string) => {
      const container = document.querySelector<HTMLElement>('[data-test-id="collection-tree"]')
      if (!container) {
        return { foundId: null, canScroll: false, scrollBy: 0 }
      }

      const rows = Array.from(
        container.querySelectorAll<HTMLElement>('[data-test-id^="collection-tree:collection-row:"]'),
      )
      const hit = rows.find((row) => row.textContent?.includes(searchName))
      if (hit) {
        return {
          foundId: hit.getAttribute("data-test-id"),
          canScroll: false,
          scrollBy: 0,
        }
      }

      // When search is active, search rows don't carry data-test-id. Use data-collection-id instead.
      const searchRows = Array.from(
        container.querySelectorAll<HTMLElement>('[data-collection-id][data-action-id][data-kind="collection"]'),
      )
      const searchHit = searchRows.find((row) => row.textContent?.includes(searchName))
      if (searchHit) {
        const colId = searchHit.getAttribute("data-collection-id")
        return {
          foundId: colId ? `collection-tree:collection-row:${colId}` : null,
          canScroll: false,
          scrollBy: 0,
        }
      }

      const canScroll = container.scrollTop + container.clientHeight < container.scrollHeight - 1
      return {
        foundId: null,
        canScroll,
        scrollBy: container.clientHeight || 200,
      }
    }, name)

    if (result.foundId) {
      return result.foundId
    }

    if (result.canScroll) {
      await browser.execute((amount: number) => {
        const container = document.querySelector<HTMLElement>('[data-test-id="collection-tree"]')
        if (container) {
          container.scrollBy({ top: amount })
        }
      }, result.scrollBy)
    }
    return null
  }

  let foundId: string | null = null
  await browser.waitUntil(
    async () => {
      foundId = await scrollAndFind()
      return Boolean(foundId)
    },
    {
      timeout,
      interval: 150,
      timeoutMsg: `Collection "${name}" not found in sidebar tree after scrolling`,
    },
  )

  if (!foundId) {
    throw new Error(`Collection "${name}" not found in sidebar tree`)
  }

  const match = foundId.match(/collection-tree:collection-row:(.+)$/)
  if (!match || !match[1]) {
    throw new Error(`Could not extract collection ID from test ID: ${foundId}`)
  }
  return match[1]
}

/**
 * Clears the sidebar search input (if present) and waits for value to empty.
 */
export async function clearSidebarSearch(timeout = 3000): Promise<void> {
  try {
    const input = await $('[data-test-id="sidebar:search-input"]')
    if (!(await input.isExisting())) {
      return
    }
    const clearBtn = await $('[data-test-id="sidebar:clear-search-button"]')
    if (await clearBtn.isExisting()) {
      try {
        await clearBtn.click()
      } catch {
        // fall back to manual clear
      }
    }
    await input.clearValue()
    await browser.waitUntil(
      async () => {
        try {
          const val = await input.getValue()
          return val === ""
        } catch {
          return true
        }
      },
      { timeout, interval: 100, timeoutMsg: "Search input did not clear" },
    )
  } catch {
    // swallow cleanup errors; not fatal
  }
}

/**
 * Waits for and returns the active request tab key.
 */
export async function waitForActiveRequestTab(timeout = 15000): Promise<string> {
  let activeId: string | null = null
  await browser.waitUntil(
    async () => {
      activeId = await browser.execute(() => {
        const element = document.querySelector<HTMLElement>('[data-state="active"][data-tab-key]')
        return element?.getAttribute("data-tab-key") ?? null
      })
      return Boolean(activeId)
    },
    {
      timeout,
      timeoutMsg: "Active request tab did not appear in time",
    },
  )

  if (!activeId) {
    throw new Error("Active request tab not resolved")
  }
  return activeId
}

/**
 * Waits for the request editor panel (URL input) to be displayed.
 */
export async function waitForRequestEditor(timeout = 10000): Promise<WebdriverIO.Element> {
  const urlInput = await $('[data-test-id="request-workspace:url-input"]')
  await urlInput.waitForDisplayed({ timeout })
  return urlInput
}

/**
 * Extracts text content from the response viewer body (CodeMirror).
 * Returns empty string if response body not found.
 */
export async function getResponseBodyText(): Promise<string> {
  const responseText = await browser.execute(() => {
    const responseBody = document.querySelector('[data-test-id="response-viewer:body"]')
    if (!responseBody) {
      return ""
    }
    const codeEditor = responseBody.querySelector('[data-test-id="code-editor"]')
    if (!codeEditor) {
      return ""
    }
    const content = codeEditor.querySelector(".cm-content")
    return content ? content.textContent : codeEditor.textContent
  })
  return responseText || ""
}

/**
 * Waits for response body to appear, then extracts and verifies it contains specific text.
 * Polls until response body exists, then returns the text (verifying search content in caller).
 * More efficient than polling+extracting every iteration.
 */
export async function waitForResponseContaining(searchText: string, timeout = 5000): Promise<string> {
  // First, poll until response body element exists
  await browser.waitUntil(
    async () => {
      const text = await getResponseBodyText()
      return text.length > 0
    },
    { timeout, interval: 100, timeoutMsg: `Response body did not appear within ${timeout}ms` },
  )

  // Then extract once and verify content
  const responseText = await getResponseBodyText()
  if (!responseText.includes(searchText)) {
    throw new Error(`Response body does not contain "${searchText}". Got: ${responseText.substring(0, 200)}`)
  }

  return responseText
}

/**
 * Selects an authentication type from the request editor auth dropdown.
 * Handles both single-click and two-step selection patterns.
 */
export async function selectAuthType(
  type: "basic" | "bearer" | "apiKey" | "oauth2" | "none" | "inherit",
): Promise<void> {
  await clickByTestId("request-editor:auth-tab")
  const typeTestIds: Record<string, string> = {
    basic: "request-editor:auth-menu:type-basic",
    bearer: "request-editor:auth-menu:type-bearer",
    apiKey: "request-editor:auth-menu:type-apiKey",
    oauth2: "request-editor:auth-menu:type-oauth2",
    none: "request-editor:auth-menu:type-none",
    inherit: "request-editor:auth-menu:type-inherit",
  }
  await selectOptionByTestId("request-editor:auth-tab-dropdown-trigger", typeTestIds[type])
}
