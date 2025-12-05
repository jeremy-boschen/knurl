import { expect } from "@wdio/globals"

import {
  appendInputText,
  clickByTestId,
  clearInputText,
  ensureAppReady,
  expectTextContent,
  getElementByTestId,
  getInputText,
  navigateTo,
  selectOptionByTestId,
  setCheckboxState,
  setInputText,
  setSwitchState,
} from "../support/ui"

describe("[SUPPLEMENTAL] E2E UX Reference Page - Helper Library Tests", () => {
  before(async () => {
    await ensureAppReady()
    await navigateTo("/__tests/ui")
    await getElementByTestId("ux-reference:page", 10000)
  })

  describe("Text Input Helpers", () => {
    it("setInputText sets input value correctly", async () => {
      await clearInputText("ux-reference:input")
      await setInputText("ux-reference:input", "test-value")
      await expectTextContent("ux-reference:input-value", /test-value/)
    })

    it("getInputText retrieves input value", async () => {
      await clearInputText("ux-reference:input")
      await setInputText("ux-reference:input", "hello")
      const value = await getInputText("ux-reference:input")
      await expect(value).toBe("hello")
    })

    it("clearInputText clears the input", async () => {
      await clearInputText("ux-reference:input")
      await setInputText("ux-reference:input", "to-clear")
      await clearInputText("ux-reference:input")
      const value = await getInputText("ux-reference:input")
      await expect(value).toBe("")
    })

    it("appendInputText appends text to existing value", async () => {
      await clearInputText("ux-reference:input")
      await setInputText("ux-reference:input", "hello")
      await appendInputText("ux-reference:input", " world")
      const value = await getInputText("ux-reference:input")
      await expect(value).toBe("hello world")
    })

    it("works with textarea elements", async () => {
      await clearInputText("ux-reference:textarea")
      await setInputText("ux-reference:textarea", "abc")
      await expectTextContent("ux-reference:textarea-value", /3 characters/)
    })
  })

  describe("Radix Select (Dropdown) Helper", () => {
    it("selectOptionByTestId selects from Radix Select", async () => {
      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:alpha")
      await expectTextContent("ux-reference:select-value", /alpha/)
    })

    it("can change selection multiple times", async () => {
      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:bravo")
      await expectTextContent("ux-reference:select-value", /bravo/)

      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:charlie")
      await expectTextContent("ux-reference:select-value", /charlie/)

      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:alpha")
      await expectTextContent("ux-reference:select-value", /alpha/)
    })

    it("handles Radix UI portal rendering delays", async () => {
      // This test verifies the enhanced selectOptionByTestId with retry logic
      for (let i = 0; i < 3; i++) {
        const options = ["alpha", "bravo", "charlie"]
        const option = options[i]
        await selectOptionByTestId("ux-reference:select-trigger", `ux-reference:select-option:${option}`)
        await expectTextContent("ux-reference:select-value", new RegExp(option, "i"))
      }
    })
  })

  describe("Dropdown Menu Helper", () => {
    it("selectOptionByTestId works with DropdownMenuItems", async () => {
      await selectOptionByTestId("ux-reference:dropdown-trigger", "ux-reference:dropdown-item:new-request")
      await expectTextContent("ux-reference:dropdown-value", /new-request/)
    })

    it("can select different menu items sequentially", async () => {
      await selectOptionByTestId("ux-reference:dropdown-trigger", "ux-reference:dropdown-item:rename")
      await expectTextContent("ux-reference:dropdown-value", /rename/)
      await browser.pause(200)

      await selectOptionByTestId("ux-reference:dropdown-trigger", "ux-reference:dropdown-item:delete")
      await expectTextContent("ux-reference:dropdown-value", /delete/)
    })
  })

  describe("Dropdown Menu with Radio Group Helper", () => {
    it("selectOptionByTestId works with DropdownMenuRadioItems", async () => {
      await selectOptionByTestId("ux-reference:dropdown-radio-trigger", "ux-reference:radio-option:b")
      await expectTextContent("ux-reference:dropdown-radio-value", /option-b/)
    })

    it("radio group maintains mutual exclusivity", async () => {
      await selectOptionByTestId("ux-reference:dropdown-radio-trigger", "ux-reference:radio-option:a")
      await expectTextContent("ux-reference:dropdown-radio-value", /option-a/)
      await browser.pause(200)

      await selectOptionByTestId("ux-reference:dropdown-radio-trigger", "ux-reference:radio-option:b")
      await expectTextContent("ux-reference:dropdown-radio-value", /option-b/)

      // Verify we're on the new option now
      const element = await getElementByTestId("ux-reference:dropdown-radio-value")
      const text = await element.getText()
      await expect(text).toContain("option-b")
    })
  })

  describe("Toggle Control Helpers", () => {
    it("setSwitchState turns switch on and off", async () => {
      await setSwitchState("ux-reference:switch", true)
      await expectTextContent("ux-reference:toggle-state", /on/)

      await setSwitchState("ux-reference:switch", false)
      await expectTextContent("ux-reference:toggle-state", /off/)
    })

    it("setCheckboxState checks and unchecks checkbox", async () => {
      await setCheckboxState("ux-reference:checkbox", true)
      await expectTextContent("ux-reference:toggle-state", /checked/)

      await setCheckboxState("ux-reference:checkbox", false)
      await expectTextContent("ux-reference:toggle-state", /unchecked/)
    })

    it("can toggle multiple times in sequence", async () => {
      const states = [true, false, true, false]
      for (const state of states) {
        await setSwitchState("ux-reference:switch", state)
        await setCheckboxState("ux-reference:checkbox", state)
        const expectedState = state ? "on" : "off"
        await expectTextContent("ux-reference:toggle-state", new RegExp(expectedState, "i"))
      }
    })
  })

  describe("Button Click Helper", () => {
    it("clickByTestId triggers button clicks", async () => {
      // Reset by clicking Outline button to verify counter works
      const initialCount = await getElementByTestId("ux-reference:button-count", 5000)
      const _initialText = await initialCount.getText()

      // Click primary button multiple times
      await clickByTestId("ux-reference:button-primary")
      await clickByTestId("ux-reference:button-primary")
      await clickByTestId("ux-reference:button-primary")

      await expectTextContent("ux-reference:button-count", /3/)
    })

    it("works with all button variants", async () => {
      // Click different button variants
      await clickByTestId("ux-reference:button-secondary")
      await clickByTestId("ux-reference:button-outline")
      await clickByTestId("ux-reference:button-ghost")

      // Verify count increased
      const countElement = await getElementByTestId("ux-reference:button-count")
      const text = await countElement.getText()
      const count = parseInt(text.match(/\d+/)?.[0] ?? "0", 10)
      await expect(count).toBeGreaterThanOrEqual(3)
    })
  })

  describe("Dialog Interaction", () => {
    it("can open and close dialog", async () => {
      // Open dialog
      await clickByTestId("ux-reference:dialog-trigger")
      await getElementByTestId("ux-reference:dialog-content", 5000)

      // Set input in dialog
      await setInputText("ux-reference:dialog-input", "dialog-test-value")
      await expectTextContent("ux-reference:dialog-input-value", /dialog-test-value/)

      // Close dialog with confirm button
      await clickByTestId("ux-reference:dialog-confirm")
      // Verify dialog is gone
      const dialogContent = await $('[data-test-id="ux-reference:dialog-content"]')
      await expect(dialogContent).not.toBeDisplayed()
    })

    it("can cancel dialog without saving", async () => {
      // Open dialog
      await clickByTestId("ux-reference:dialog-trigger")
      await getElementByTestId("ux-reference:dialog-content", 5000)

      // Set input in dialog
      await setInputText("ux-reference:dialog-input", "cancel-test")

      // Close dialog with cancel button
      await clickByTestId("ux-reference:dialog-cancel")

      // Dialog should be closed
      const dialogContent = await $('[data-test-id="ux-reference:dialog-content"]')
      await expect(dialogContent).not.toBeDisplayed()
    })
  })

  describe("Alert Dialog Interaction", () => {
    it("can trigger and interact with alert dialog", async () => {
      // Trigger alert dialog
      await clickByTestId("ux-reference:alert-trigger")
      await getElementByTestId("ux-reference:alert-dialog-content", 5000)

      // Verify content is visible
      await expectTextContent("ux-reference:alert-title", /Confirm Delete/)
      await expectTextContent("ux-reference:alert-description", /cannot be undone/)

      // Cancel action
      await clickByTestId("ux-reference:alert-cancel")

      // Dialog should be closed
      const alertContent = await $('[data-test-id="ux-reference:alert-dialog-content"]')
      await expect(alertContent).not.toBeDisplayed()
    })
  })

  describe("Tabs Navigation", () => {
    it("clickByTestId switches between tabs", async () => {
      // Click tab 2
      await clickByTestId("ux-reference:tab-trigger:2")
      await expectTextContent("ux-reference:tabs-active", /tab-2/)
      await getElementByTestId("ux-reference:tab-content:2", 5000)

      // Click tab 3
      await clickByTestId("ux-reference:tab-trigger:3")
      await expectTextContent("ux-reference:tabs-active", /tab-3/)
      await getElementByTestId("ux-reference:tab-content:3", 5000)

      // Click tab 1
      await clickByTestId("ux-reference:tab-trigger:1")
      await expectTextContent("ux-reference:tabs-active", /tab-1/)
      await getElementByTestId("ux-reference:tab-content:1", 5000)
    })
  })

  describe("Alert Components", () => {
    it("can read alert text content", async () => {
      await expectTextContent("ux-reference:alert-info-text", /informational/)
      await expectTextContent("ux-reference:alert-warning-text", /warning/)
      await expectTextContent("ux-reference:alert-error-text", /error/)
    })
  })

  describe("Complex Interaction Sequences", () => {
    it("can perform multi-step workflow using all helpers", async () => {
      // 1. Fill input
      await setInputText("ux-reference:input", "workflow-test")
      await expectTextContent("ux-reference:input-value", /workflow-test/)

      // 2. Select from dropdown
      await selectOptionByTestId("ux-reference:select-trigger", "ux-reference:select-option:bravo")
      await expectTextContent("ux-reference:select-value", /bravo/)

      // 3. Toggle controls
      await setSwitchState("ux-reference:switch", true)
      await setCheckboxState("ux-reference:checkbox", true)
      await expectTextContent("ux-reference:toggle-state", /on.*checked/)

      // 4. Click buttons
      await clickByTestId("ux-reference:button-primary")
      await clickByTestId("ux-reference:button-secondary")

      // 5. Switch tabs
      await clickByTestId("ux-reference:tab-trigger:2")
      await expectTextContent("ux-reference:tabs-active", /tab-2/)

      // 6. Switch back
      await clickByTestId("ux-reference:tab-trigger:1")
      await expectTextContent("ux-reference:tabs-active", /tab-1/)
    })
  })
})
