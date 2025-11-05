import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, ensureAppReady } from "../support/ui"

describe("Theme Settings", () => {
  before(async () => {
    await ensureAppReady()
    await ensureWorkspaceReady()
  })

  it("switches preset theme in appearance settings", async () => {
    // Open settings
    const settingsButton = await $('[data-test-id="sidebar:settings-button"]')
    await settingsButton.waitForDisplayed({ timeout: 5000 })
    await settingsButton.click()

    const settingsSheet = await $('[data-test-id="settings:sheet"]')
    await settingsSheet.waitForDisplayed({ timeout: 5000 })
    await browser.pause(800)

    // Navigate to appearance
    const appearanceButton = await $('[data-test-id="settings-nav:appearance-button"]')
    await appearanceButton.waitForDisplayed({ timeout: 5000 })
    await appearanceButton.click()

    // Switch to preset source
    const presetSource = await $('[data-test-id="appearance:theme-source-preset"]')
    await presetSource.waitForExist({ timeout: 5000 })
    await presetSource.click()

    // Fetch themes if needed
    const fetchBtn = await $('[data-test-id="theme-selector:fetch-button"]')
    if (await fetchBtn.isExisting()) {
      console.log("Fetching themes...")
      await fetchBtn.click()
      await browser.pause(500)
    }

    // Wait for next button to be enabled
    const nextBtn = await $('[data-test-id="theme-selector:next-button"]')
    await nextBtn.waitForExist({ timeout: 20000 })
    await nextBtn.waitForEnabled({ timeout: 20000 })
    console.log("Next button is ready")

    // Get the currently selected theme name from the combobox trigger button
    const comboboxTrigger = await $('[data-test-id="theme-selector:combobox-trigger"]')
    const beforeText = (await comboboxTrigger.getText()).trim()
    console.log("Currently selected theme:", beforeText)

    // Click to switch theme
    await nextBtn.click()
    console.log("Clicked next button, waiting for theme to apply...")

    // Wait for a different theme to be selected (combobox button text should change)
    let themeChanged = false
    let attempts = 0
    const maxAttempts = 30 // 30 attempts * 500ms = 15 seconds

    while (attempts < maxAttempts) {
      try {
        const afterText = (await comboboxTrigger.getText()).trim()
        console.log(`Attempt ${attempts + 1}: currently selected = "${afterText}"`)

        if (afterText !== beforeText) {
          themeChanged = true
          console.log("Theme changed successfully:", afterText)
          break
        }
      } catch (e) {
        console.log(`Attempt ${attempts + 1}: Error checking theme`, e)
      }

      await browser.pause(500)
      attempts++
    }

    expect(themeChanged).toBe(true)

    // Allow CSS to render
    await browser.pause(2000)

    // Close settings
    await browser.keys(["Escape"])
    await browser.pause(500)
  })
})
