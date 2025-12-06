import { expect } from "@wdio/globals"

import {
  appendInputText,
  clickByTestId,
  ensureAppReady,
  ensureWorkspaceReady,
  expectTextContent,
  getElementByTestId,
  navigateTo,
  selectMenuActionById,
  selectOptionByTestId,
  setCheckboxState,
  setInputText,
  setSwitchState,
} from "../support/ui"

describe("[SUPPLEMENTAL] Settings & UI Customization", () => {
  describe("[SUPPLEMENTAL] Theme Settings", () => {
    before(async () => {
      await ensureAppReady()
      await ensureWorkspaceReady()
    })

    it("switches preset theme in appearance settings", async () => {
      // Ensure sidebar is expanded
      await getElementByTestId("sidebar", 5000)

      // Try to expand sidebar if collapsed
      try {
        const expandButton = await getElementByTestId("sidebar:expand-button", 2000)
        if (await expandButton.isDisplayed()) {
          await clickByTestId("sidebar:expand-button")
        }
      } catch {
        // Sidebar already expanded
      }

      // Open settings
      await clickByTestId("sidebar:settings-button")
      await getElementByTestId("settings:sheet", 5000)

      // Navigate to appearance
      await clickByTestId("settings-nav:appearance-button")

      // Switch to preset source
      await clickByTestId("appearance:theme-source-preset")

      // Fetch themes if needed
      try {
        const fetchBtn = await getElementByTestId("theme-selector:fetch-button", 2000)
        if (await fetchBtn.isDisplayed()) {
          await clickByTestId("theme-selector:fetch-button")
        }
      } catch {
        // Fetch button not available
      }

      // Wait for next button to be enabled
      const nextBtn = await getElementByTestId("theme-selector:next-button", 20000)
      await nextBtn.waitForEnabled({ timeout: 20000 })

      // Get the currently selected theme name from the combobox trigger button
      const comboboxTrigger = await getElementByTestId("theme-selector:combobox-trigger", 5000)
      const beforeText = (await comboboxTrigger.getText()).trim()
      console.log("Currently selected theme:", beforeText)

      // Click to switch theme
      await clickByTestId("theme-selector:next-button")
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

      // Close settings
      await browser.keys(["Escape"])
    })
  })

  describe("UI Helper Library", () => {
    before(async () => {
      await ensureAppReady()
      await navigateTo("/__tests/ui")
      await getElementByTestId("ux-reference:page", 10000)
    })

    it("selectOption selects items by data-test-id", async () => {
      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:bravo")
      await expectTextContent("ux-reference:select-value", /Selected: bravo/)

      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:charlie")
      await expectTextContent("ux-reference:select-value", /Selected: charlie/)
    })

    it("menu helpers select actions and close the dropdown", async () => {
      await selectMenuActionById("ux-reference:dropdown-item:new-request", {
        triggerTestId: "ux-reference:dropdown-trigger",
      })
      await expectTextContent("ux-reference:dropdown-value", /new-request/)

      await selectMenuActionById("ux-reference:dropdown-item:rename", {
        triggerTestId: "ux-reference:dropdown-trigger",
      })
      await expectTextContent("ux-reference:dropdown-value", /rename/)
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
      await clickByTestId("ux-reference:button-primary")
      await clickByTestId("ux-reference:button-primary")
      const buttonCount = await getElementByTestId("ux-reference:button-count", 5000)
      const text = await buttonCount.getText()
      await expect(text).toContain("2")
    })
  })
})
