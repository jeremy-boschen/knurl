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

export async function resolveRequestId(tabKey: string | null): Promise<string | null> {
  if (!tabKey) {
    return null
  }

  return await browser.executeAsync(async (key: string, done: (value: string | null) => void) => {
    try {
      const { useApplication } = await import("@/state/application")
      const tab = useApplication
        .getState()
        .requestTabsApi.getOpenTabs()
        .find((entry) => entry.tabId === key)
      done(tab?.requestId ?? null)
    } catch (error) {
      console.error("Failed to resolve request id from tab key", error)
      done(null)
    }
  }, tabKey)
}

export async function waitForRequestEditor(timeout = 10000): Promise<WebdriverIO.Element> {
  const urlInput = await $('[data-test-id="request-workspace:url-input"]')
  await urlInput.waitForDisplayed({ timeout })
  return urlInput
}
