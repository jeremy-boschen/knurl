import { expect } from "@wdio/globals"

const DEFAULT_TIMEOUT = 15000
const ESCAPE_KEY = "Escape"

/**
 * Default timing configuration for waitFor operations:
 * - initialDelay: time to wait before starting to poll (allows UI to render)
 * - pollingInterval: how frequently to check once polling starts (tight but not excessive)
 */
const DEFAULT_WAIT_CONFIG = {
  initialDelay: 0,
  pollingInterval: 50,
}

/**
 * Wait for the app to be fully loaded and interactive
 */
async function waitForAppReady(timeout = DEFAULT_TIMEOUT): Promise<void> {
  // Wait for React to render and the app to be interactive
  // Try to wait for the main window element
  try {
    const appContainer = await $('[data-test-id="app:main-window"]')
    await appContainer.waitForExist({ timeout: Math.min(timeout, 5000) })
    await appContainer.waitForDisplayed({ timeout: Math.min(timeout, 5000) })
    return
  } catch {
    // Fallback: wait for the document to be ready
    await browser.waitUntil(
      async () => {
        const ready = await browser.execute(() => {
          return document.readyState === "complete"
        })
        return ready
      },
      {
        timeout,
        timeoutMsg: "App did not load in time",
      },
    )
    await browser.pause(500)
  }
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
    dispatchers.forEach((dispatch) => dispatch(el))
  }, element)
}

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
    const active = document.querySelector<HTMLElement>('[data-test-id^="request-tab:"][data-state="active"]')
    return active?.getAttribute("data-tab-key") ?? null
  })
}

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
      await browser.pause(50)
    } catch {
      break
    }
  }
}

export async function ensureWorkspaceReady(): Promise<void> {
  await ensureAppReady()

  // Ensure the UI is fully ready with new request controls available
  await browser.waitUntil(
    async () => {
      const titleButton = await $('[data-test-id="titlebar:new-request-button"]')
      if (await titleButton.isExisting()) {
        try {
          await titleButton.waitForDisplayed({ timeout: 200 })
          return true
        } catch {
          // fall through to check tab bar button
        }
      }

      const tabBarButton = await $('[data-test-id="request-tab-bar:new-request-button"]')
      if (await tabBarButton.isExisting()) {
        try {
          await tabBarButton.waitForDisplayed({ timeout: 200 })
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
      timeoutMsg: "Workspace UI did not expose new request controls",
    },
  )
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

export async function setInputText(testId: string, value: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  // For controlled inputs in React, use keyboard events instead of direct DOM manipulation
  // This ensures onChange events are triggered properly
  await element.click()
  await browser.pause(100) // Give input time to receive focus
  await browser.keys(['Control', 'a']) // Select all
  await browser.pause(50)
  await browser.keys(['Delete']) // Clear
  await browser.pause(100) // Allow state update
  // Only add value if not empty - WebdriverIO throws "invalid argument" for empty addValue
  if (value.length > 0) {
    await element.addValue(value) // Type the new value
    await browser.pause(50) // Allow state update after typing
  }
}

export async function appendInputText(testId: string, value: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  // addValue triggers onChange events, so this works correctly with controlled inputs
  await element.addValue(value)
}

export async function clearInputText(testId: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  // For controlled inputs, use keyboard events
  await element.click()
  await browser.keys(['Control', 'a'])
  await browser.keys(['Delete'])
  await browser.pause(50)
}

export async function clickByTestId(testId: string): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await element.scrollIntoView({ block: "center", inline: "center" })
  await withFallbackClick(element)
}

export async function waitForTestIdToDisappear(testId: string, timeout = DEFAULT_TIMEOUT): Promise<void> {
  const locator = `[data-test-id="${testId}"]`
  await browser.waitUntil(
    async () => !(await $(locator).isExisting()),
    {
      timeout,
      interval: 100,
      timeoutMsg: `Element ${testId} remained visible`,
    },
  )
}

export async function selectOptionByTestId(selectTriggerTestId: string, optionTestId: string): Promise<void> {
  const trigger = await getElementByTestId(selectTriggerTestId)
  await trigger.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await trigger.scrollIntoView({ block: "center", inline: "center" })
  await withFallbackClick(trigger)

  const option = await getElementByTestId(optionTestId)
  await option.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await option.scrollIntoView({ block: "center", inline: "center" })
  await withFallbackClick(option)
}

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

    events.forEach((fire) => fire())
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

export async function expectTextContent(testId: string, expected: string | RegExp): Promise<void> {
  const element = await getElementByTestId(testId)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  const text = await element.getText()
  await expect(text).toMatch(expected)
}

export async function ensureCollectionRowVisible(collectionId: string, timeout = DEFAULT_TIMEOUT): Promise<WebdriverIO.Element> {
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
  await browser.pause(50)
  await clickByTestId(`collection-tree:collection-row:menu-button:${collectionId}`)
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

export async function selectMenuActionById(
  actionId: string,
  options: { triggerTestId: string },
): Promise<void> {
  // Click the menu trigger to open it
  await clickByTestId(options.triggerTestId)
  await browser.pause(100)

  // Click the menu action by its ID
  const actionElement = await $(`[data-test-id="${actionId}"]`)
  await actionElement.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await withFallbackClick(actionElement)
}
