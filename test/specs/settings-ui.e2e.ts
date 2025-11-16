import { expect } from "@wdio/globals"

import {
  appendInputText,
  clickByTestId,
  ensureAppReady,
  expectTextContent,
  navigateTo,
  selectMenuActionById,
  selectOptionByTestId,
  setCheckboxState,
  setInputText,
  setSwitchState,
  ensureWorkspaceReady,
} from "../support/ui"

describe("Settings & UI Customization", () => {
  describe("Theme Settings", () => {
    before(async () => {
      await ensureAppReady()
      await ensureWorkspaceReady()
    })

    it("switches preset theme in appearance settings", async () => {
      // Ensure sidebar is expanded
      const sidebar = await $('[data-test-id="sidebar"]')
      await sidebar.waitForDisplayed({ timeout: 5000 })

      // Check if sidebar is collapsed, expand if needed
      const expandButton = await $('[data-test-id="sidebar:expand-button"]')
      if (await expandButton.isDisplayed()) {
        await expandButton.click()
        await browser.pause(300)
      }

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

  describe("UI Helper Library", () => {
    before(async () => {
      await ensureAppReady()
      await navigateTo("/__tests/ui")
      const page = await $("[data-test-id='ux-reference:page']")
      await page.waitForDisplayed({ timeout: 10000 })
    })

    it("selectOption selects items by data-test-id", async () => {
      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:bravo")
      await expectTextContent("ux-reference:select-value", /Selected: bravo/)
      await expectTextContent("ux-reference:select-open-state", /Menu:\s+closed/i)

      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:charlie")
      await expectTextContent("ux-reference:select-value", /Selected: charlie/)
      await expectTextContent("ux-reference:select-open-state", /Menu:\s+closed/i)
    })

    it("menu helpers select actions and close the dropdown", async () => {
      await selectMenuActionById("new-request", { triggerTestId: "ux-reference:menu-trigger" })
      await expectTextContent("ux-reference:menu-value", /new-request/)
      await expectTextContent("ux-reference:menu-open-state", /Menu:\s+closed/i)

      await selectMenuActionById("rename", { triggerTestId: "ux-reference:menu-trigger" })
      await expectTextContent("ux-reference:menu-value", /rename/)
      await expectTextContent("ux-reference:menu-open-state", /Menu:\s+closed/i)
    })

    it("input helpers set and append text", async () => {
      await setInputText("ux-reference:input", "hello")
      await expectTextContent("ux-reference:input-value", /hello/)

      await appendInputText("ux-reference:input", " world")
      await expectTextContent("ux-reference:input-value", /hello world/)
    })

    it("toggle helpers drive switch and checkbox", async () => {
      await setSwitchState("ux-reference:switch", true)
      await setCheckboxState("ux-reference:checkbox", true)
      await expectTextContent("ux-reference:toggle-state", /on.*checked/i)

      await setSwitchState("ux-reference:switch", false)
      await setCheckboxState("ux-reference:checkbox", false)
      await expectTextContent("ux-reference:toggle-state", /off.*unchecked/i)
    })

    it("click helper triggers buttons", async () => {
      await clickByTestId("ux-reference:button")
      await clickByTestId("ux-reference:button")
      const text = await $("[data-test-id='ux-reference:button-count']").getText()
      await expect(text).toContain("2")
    })
  })
})
