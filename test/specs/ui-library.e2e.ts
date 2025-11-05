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
} from "../support/ui"

describe("UI helper library", () => {
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
