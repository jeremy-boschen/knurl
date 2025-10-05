import type { Screen } from "@testing-library/react"
import { render, screen } from "@testing-library/react"

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

interface Page extends Screen {
  getByAttribute: (attr: string, value: string) => HTMLElement
  queryByAttribute: (attr: string, value: string) => HTMLElement | null
  findByAttribute: (attr: string, value: string) => Promise<HTMLElement>
  getAllByAttribute: (attr: string, value: string) => HTMLElement[]
  findAllByAttribute: (attr: string, value: string) => Promise<HTMLElement[]>
}

export const page: Page = {
  ...screen,
  getByAttribute: (attr: string, value: string) => getByAttribute(attr, value),
  queryByAttribute: (attr: string, value: string) => queryByAttribute(attr, value),
  findByAttribute: (attr: string, value: string) => findByAttribute(attr, value),
  getAllByAttribute: (attr: string, value: string) => getAllByAttribute(attr, value),
  findAllByAttribute: (attr: string, value: string) => findAllByAttribute(attr, value),
}

// Re-export common types
export { screen, render }
