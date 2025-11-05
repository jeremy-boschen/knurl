import type { Screen } from "@testing-library/react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { buildQueries, queryHelpers } from "@testing-library/dom"

const queryAllByAttribute = (container: HTMLElement, attr: string, value: string) =>
  queryHelpers.queryAllByAttribute(attr, container as HTMLElement, value)

const getMultipleError = (_c: Element | null, attr: string, value: string) =>
  `Found multiple elements with [${attr}="${value}"]`
const getMissingError = (_c: Element | null, attr: string, value: string) =>
  `Unable to find an element with [${attr}="${value}"]`

const [queryByAttr, getAllByAttr, getByAttr, findAllByAttr, findByAttr] = buildQueries(
  queryAllByAttribute,
  getMultipleError,
  getMissingError,
)

// document.body defaults so you don't pass a container each time
export const getByAttribute = (attr: string, value: string, c: HTMLElement = document.body) => getByAttr(c, attr, value)
export const queryByAttribute = (attr: string, value: string, c: HTMLElement = document.body) =>
  queryByAttr(c, attr, value)
export const findByAttribute = (attr: string, value: string, c: HTMLElement = document.body) =>
  findByAttr(c, attr, value)
export const getAllByAttribute = (attr: string, value: string, c: HTMLElement = document.body) =>
  getAllByAttr(c, attr, value)
export const findAllByAttribute = (attr: string, value: string, c: HTMLElement = document.body) =>
  findAllByAttr(c, attr, value)

const SELECT_CONTENT_SELECTOR = '[data-slot="select-content"][data-state="open"]'

interface Page extends Screen {
  getByAttribute: (attr: string, value: string) => HTMLElement
  queryByAttribute: (attr: string, value: string) => HTMLElement | null
  findByAttribute: (attr: string, value: string) => Promise<HTMLElement>
  getAllByAttribute: (attr: string, value: string) => HTMLElement[]
  findAllByAttribute: (attr: string, value: string) => Promise<HTMLElement[]>
  selectOptionByTestId: (triggerTestId: string, optionTestId: string) => Promise<void>
}

export const page: Page = {
  ...screen,
  getByAttribute: (attr: string, value: string) => getByAttribute(attr, value),
  queryByAttribute: (attr: string, value: string) => queryByAttribute(attr, value),
  findByAttribute: (attr: string, value: string) => findByAttribute(attr, value),
  getAllByAttribute: (attr: string, value: string) => getAllByAttribute(attr, value),
  findAllByAttribute: (attr: string, value: string) => findAllByAttribute(attr, value),
  selectOptionByTestId: (triggerTestId: string, optionTestId: string) =>
    selectOptionByTestId(triggerTestId, optionTestId),
}

export async function selectOptionByTestId(triggerTestId: string, optionTestId: string): Promise<void> {
  const trigger = getByAttribute("data-test-id", triggerTestId) as HTMLElement
  await userEvent.click(trigger)

  const option = (await findByAttribute("data-test-id", optionTestId)) as HTMLElement
  await userEvent.click(option)

  await waitFor(() => {
    const isOpen = document.querySelector(SELECT_CONTENT_SELECTOR)
    if (isOpen) {
      throw new Error(`Select menu "${triggerTestId}" remained open after choosing "${optionTestId}"`)
    }
    if (trigger.getAttribute("aria-expanded") === "true") {
      throw new Error(`Trigger "${triggerTestId}" still reports aria-expanded="true"`)
    }
  })
}

// Re-export common types
export { screen, render }
