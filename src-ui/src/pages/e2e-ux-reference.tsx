/** biome-ignore-all lint/correctness/useUniqueElementIds: test code exempted */
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type Option = {
  value: string
  label: string
  testId: string
}

const selectOptions: Option[] = [
  { value: "alpha", label: "Alpha", testId: "ux-reference:select-option:alpha" },
  { value: "bravo", label: "Bravo", testId: "ux-reference:select-option:bravo" },
  { value: "charlie", label: "Charlie", testId: "ux-reference:select-option:charlie" },
]

export default function E2EUxReferencePage() {
  const [selectValue, setSelectValue] = useState(selectOptions[0]?.value)
  const [inputValue, setInputValue] = useState("")
  const [textareaValue, setTextareaValue] = useState("")
  const [toggleEnabled, setToggleEnabled] = useState(false)
  const [checkboxEnabled, setCheckboxEnabled] = useState(false)
  const [buttonClicks, setButtonClicks] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuValue, setMenuValue] = useState("")

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8" data-test-id="ux-reference:page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">E2E UI Interaction Reference</h1>
        <p className="text-muted-foreground">
          This page exposes canonical component surfaces for end-to-end tests. The e2e helper library should exercise
          these elements to verify shared interactions (click, select, toggle, typing) continue to work across updates.
        </p>
      </header>

      <section className="space-y-4" data-test-id="ux-reference:select-section">
        <div className="space-y-2">
          <Label htmlFor="ux-reference-select">Select Example</Label>
          <Select
            value={selectValue}
            onValueChange={(value) => setSelectValue(value)}
            data-test-id="ux-reference:select"
          >
            <SelectTrigger id="ux-reference-select" data-test-id="ux-reference:select-trigger">
              <SelectValue placeholder="Choose an option" />
            </SelectTrigger>
            <SelectContent data-test-id="ux-reference:select-content">
              {selectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} data-test-id={option.testId}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:select-value">
          Selected: <span className="font-mono text-foreground">{selectValue}</span>
        </p>
        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:select-open-state">
          Menu: <span className="font-mono text-foreground">closed</span>
        </p>
      </section>

      <section className="space-y-4" data-test-id="ux-reference:menu-section">
        <div className="space-y-2">
          <Label>Dropdown Menu Example</Label>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-test-id="ux-reference:menu-trigger">
                Open Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-test-id="ux-reference:menu-content">
              <DropdownMenuItem
                data-test-id="new-request"
                onClick={() => {
                  setMenuValue("new-request")
                  setMenuOpen(false)
                }}
              >
                New Request
              </DropdownMenuItem>
              <DropdownMenuItem
                data-test-id="rename"
                onClick={() => {
                  setMenuValue("rename")
                  setMenuOpen(false)
                }}
              >
                Rename
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:menu-value">
          Last action: <span className="font-mono text-foreground">{menuValue || "<none>"}</span>
        </p>
        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:menu-open-state">
          Menu: <span className="font-mono text-foreground">{menuOpen ? "open" : "closed"}</span>
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2" data-test-id="ux-reference:text-inputs-section">
        <div className="space-y-2">
          <Label htmlFor="ux-reference-input">Single-line Input</Label>
          <Input
            id="ux-reference-input"
            data-test-id="ux-reference:input"
            placeholder="Type text..."
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <p className="text-sm text-muted-foreground" data-test-id="ux-reference:input-value">
            Value: <span className="font-mono text-foreground">{inputValue || "<empty>"}</span>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ux-reference-textarea">Textarea</Label>
          <Textarea
            id="ux-reference-textarea"
            data-test-id="ux-reference:textarea"
            placeholder="Write more text..."
            value={textareaValue}
            onChange={(event) => setTextareaValue(event.target.value)}
          />
          <p className="text-sm text-muted-foreground" data-test-id="ux-reference:textarea-value">
            Length: <span className="font-mono text-foreground">{textareaValue.length}</span> characters
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2" data-test-id="ux-reference:toggle-section">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="ux-reference-switch">Switch</Label>
            <p className="text-xs text-muted-foreground">
              Toggle to {toggleEnabled ? "disable" : "enable"} the preference flag.
            </p>
          </div>
          <Switch
            id="ux-reference-switch"
            checked={toggleEnabled}
            onCheckedChange={(checked) => setToggleEnabled(checked)}
            data-test-id="ux-reference:switch"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="ux-reference-checkbox">Checkbox</Label>
            <p className="text-xs text-muted-foreground">Use to opt-in/out of a feature.</p>
          </div>
          <Checkbox
            id="ux-reference-checkbox"
            checked={checkboxEnabled}
            onCheckedChange={(checked) => setCheckboxEnabled(checked === true)}
            data-test-id="ux-reference:checkbox"
          />
        </div>

        <p className="col-span-full text-sm text-muted-foreground" data-test-id="ux-reference:toggle-state">
          Switch: <span className="font-mono text-foreground">{toggleEnabled ? "on" : "off"}</span> · Checkbox:{" "}
          <span className="font-mono text-foreground">{checkboxEnabled ? "checked" : "unchecked"}</span>
        </p>
      </section>

      <section className="rounded-lg border p-4" data-test-id="ux-reference:button-section">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Button</Label>
            <p className="text-xs text-muted-foreground">Primary action button used throughout the app.</p>
          </div>
          <Button
            type="button"
            data-test-id="ux-reference:button"
            onClick={() => setButtonClicks((count) => count + 1)}
          >
            Press Me
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground" data-test-id="ux-reference:button-count">
          Click count: <span className="font-mono text-foreground">{buttonClicks}</span>
        </p>
      </section>
    </div>
  )
}
