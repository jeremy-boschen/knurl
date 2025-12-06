/** biome-ignore-all lint/correctness/useUniqueElementIds: test code exempted */
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type SelectOption = {
  value: string
  label: string
  testId: string
}

const selectOptions: SelectOption[] = [
  { value: "alpha", label: "Alpha", testId: "ux-reference:select-option:alpha" },
  { value: "bravo", label: "Bravo", testId: "ux-reference:select-option:bravo" },
  { value: "charlie", label: "Charlie", testId: "ux-reference:select-option:charlie" },
]

const radioOptions = [
  { value: "option-a", label: "Option A", testId: "ux-reference:radio-option:a" },
  { value: "option-b", label: "Option B", testId: "ux-reference:radio-option:b" },
  { value: "option-c", label: "Option C", testId: "ux-reference:radio-option:c" },
]

export default function E2EUxReferencePage() {
  const [selectValue, setSelectValue] = useState(selectOptions[0]?.value)
  const [inputValue, setInputValue] = useState("")
  const [textareaValue, setTextareaValue] = useState("")
  const [switchEnabled, setSwitchEnabled] = useState(false)
  const [checkboxEnabled, setCheckboxEnabled] = useState(false)
  const [buttonClicks, setButtonClicks] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuValue, setMenuValue] = useState("")
  const [radioValue, setRadioValue] = useState("option-a")
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuValue, setContextMenuValue] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [alertDialogOpen, setAlertDialogOpen] = useState(false)
  const [dialogInput, setDialogInput] = useState("")
  const [activeTab, setActiveTab] = useState("tab-1")

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-8" data-test-id="ux-reference:page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">E2E UI Interaction Reference</h1>
        <p className="text-muted-foreground">
          This page provides canonical component surfaces for end-to-end tests. Use the helpers in
          `src-common/e2e/support/ui.ts` to interact with these elements.
        </p>
      </header>

      {/* INPUTS SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:inputs-section">
        <h2 className="text-xl font-semibold">Text Inputs</h2>

        <div className="space-y-2">
          <Label htmlFor="ux-reference-input">Single-line Input</Label>
          <Input
            id="ux-reference-input"
            data-test-id="ux-reference:input"
            placeholder="Type text... (use setInputText)"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <p className="text-sm text-muted-foreground" data-test-id="ux-reference:input-value">
            Value: <span className="font-mono text-foreground">{inputValue || "<empty>"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Helpers: setInputText, getInputText, clearInputText, appendInputText
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ux-reference-textarea">Textarea</Label>
          <Textarea
            id="ux-reference-textarea"
            data-test-id="ux-reference:textarea"
            placeholder="Write more text... (use setInputText)"
            value={textareaValue}
            onChange={(event) => setTextareaValue(event.target.value)}
          />
          <p className="text-sm text-muted-foreground" data-test-id="ux-reference:textarea-value">
            Length: <span className="font-mono text-foreground">{textareaValue.length}</span> characters
          </p>
        </div>
      </section>

      {/* SELECT / DROPDOWN SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:select-section">
        <h2 className="text-xl font-semibold">Radix Select (Dropdown)</h2>

        <div className="space-y-2">
          <Label htmlFor="ux-reference-select">Select Component</Label>
          <Select value={selectValue} onValueChange={(value) => setSelectValue(value)}>
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
        <p className="text-xs text-muted-foreground">
          Helper: selectOptionByTestId (supports Radix UI portal rendering)
        </p>
      </section>

      {/* DROPDOWN MENU SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:dropdown-menu-section">
        <h2 className="text-xl font-semibold">Dropdown Menu</h2>

        <div className="space-y-2">
          <Label>Dropdown Menu Example</Label>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-test-id="ux-reference:dropdown-trigger">
                Open Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-test-id="ux-reference:dropdown-content">
              <DropdownMenuItem
                data-test-id="ux-reference:dropdown-item:new-request"
                onClick={() => {
                  setMenuValue("new-request")
                  setMenuOpen(false)
                }}
              >
                New Request
              </DropdownMenuItem>
              <DropdownMenuItem
                data-test-id="ux-reference:dropdown-item:rename"
                onClick={() => {
                  setMenuValue("rename")
                  setMenuOpen(false)
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                data-test-id="ux-reference:dropdown-item:delete"
                onClick={() => {
                  setMenuValue("delete")
                  setMenuOpen(false)
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:dropdown-value">
          Last action: <span className="font-mono text-foreground">{menuValue || "<none>"}</span>
        </p>
        <p className="text-xs text-muted-foreground">Menu open state: closed</p>
        <p className="text-xs text-muted-foreground">Helper: selectOptionByTestId (works with DropdownMenuItems)</p>
      </section>

      {/* DROPDOWN MENU WITH RADIO GROUP */}
      <section className="space-y-4" data-test-id="ux-reference:dropdown-radio-section">
        <h2 className="text-xl font-semibold">Dropdown Menu with Radio Group</h2>

        <div className="space-y-2">
          <Label>Radio Selection Menu</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-test-id="ux-reference:dropdown-radio-trigger">
                Current: {radioOptions.find((o) => o.value === radioValue)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-test-id="ux-reference:dropdown-radio-content">
              <DropdownMenuRadioGroup value={radioValue} onValueChange={setRadioValue}>
                {radioOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} data-test-id={option.testId}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:dropdown-radio-value">
          Selected: <span className="font-mono text-foreground">{radioValue}</span>
        </p>
      </section>

      {/* CONTEXT MENU SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:context-menu-section">
        <h2 className="text-xl font-semibold">Context Menu (Right-Click)</h2>

        <div className="space-y-2">
          <Label>Right-click on the box below</Label>
          <ContextMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
            <ContextMenuTrigger
              className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/50 bg-muted/50"
              data-test-id="ux-reference:context-target"
            >
              <span className="text-sm text-muted-foreground">Right-click here</span>
            </ContextMenuTrigger>
            <ContextMenuContent data-test-id="ux-reference:context-menu-content">
              <ContextMenuItem
                data-test-id="ux-reference:context-item:copy"
                onClick={() => {
                  setContextMenuValue("copy")
                  setContextMenuOpen(false)
                }}
              >
                Copy
              </ContextMenuItem>
              <ContextMenuItem
                data-test-id="ux-reference:context-item:paste"
                onClick={() => {
                  setContextMenuValue("paste")
                  setContextMenuOpen(false)
                }}
              >
                Paste
              </ContextMenuItem>
              <ContextMenuItem
                data-test-id="ux-reference:context-item:delete"
                onClick={() => {
                  setContextMenuValue("delete")
                  setContextMenuOpen(false)
                }}
              >
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>

        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:context-menu-value">
          Last action: <span className="font-mono text-foreground">{contextMenuValue || "<none>"}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Note: Context menus require WebDriver right-click; may need custom helpers
        </p>
      </section>

      {/* TOGGLE CONTROLS SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:toggle-section">
        <h2 className="text-xl font-semibold">Toggle Controls</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="ux-reference-switch">Switch</Label>
              <p className="text-xs text-muted-foreground">
                Toggle {switchEnabled ? "off" : "on"} (use setSwitchState)
              </p>
            </div>
            <Switch
              id="ux-reference-switch"
              checked={switchEnabled}
              onCheckedChange={setSwitchEnabled}
              data-test-id="ux-reference:switch"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="ux-reference-checkbox">Checkbox</Label>
              <p className="text-xs text-muted-foreground">Check/uncheck (use setCheckboxState)</p>
            </div>
            <Checkbox
              id="ux-reference-checkbox"
              checked={checkboxEnabled}
              onCheckedChange={(checked) => setCheckboxEnabled(checked === true)}
              data-test-id="ux-reference:checkbox"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:toggle-state">
          Switch: <span className="font-mono text-foreground">{switchEnabled ? "on" : "off"}</span> · Checkbox:{" "}
          <span className="font-mono text-foreground">{checkboxEnabled ? "checked" : "unchecked"}</span>
        </p>
      </section>

      {/* BUTTONS SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:button-section">
        <h2 className="text-xl font-semibold">Buttons</h2>

        <div className="flex gap-3">
          <Button data-test-id="ux-reference:button-primary" onClick={() => setButtonClicks((count) => count + 1)}>
            Primary
          </Button>
          <Button
            variant="secondary"
            data-test-id="ux-reference:button-secondary"
            onClick={() => setButtonClicks((count) => count + 1)}
          >
            Secondary
          </Button>
          <Button
            variant="outline"
            data-test-id="ux-reference:button-outline"
            onClick={() => setButtonClicks((count) => count + 1)}
          >
            Outline
          </Button>
          <Button
            variant="ghost"
            data-test-id="ux-reference:button-ghost"
            onClick={() => setButtonClicks((count) => count + 1)}
          >
            Ghost
          </Button>
        </div>

        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:button-count">
          Total clicks: <span className="font-mono text-foreground">{buttonClicks}</span>
        </p>
        <p className="text-xs text-muted-foreground">Helper: clickByTestId</p>
      </section>

      {/* DIALOG SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:dialog-section">
        <h2 className="text-xl font-semibold">Dialog</h2>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-test-id="ux-reference:dialog-trigger">
              Open Dialog
            </Button>
          </DialogTrigger>
          <DialogContent data-test-id="ux-reference:dialog-content">
            <DialogHeader>
              <DialogTitle data-test-id="ux-reference:dialog-title">Dialog Example</DialogTitle>
              <DialogDescription data-test-id="ux-reference:dialog-description">
                This is a modal dialog. Test text input and button interaction.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dialog-input">Input in Dialog</Label>
                <Input
                  id="dialog-input"
                  data-test-id="ux-reference:dialog-input"
                  placeholder="Type something..."
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} data-test-id="ux-reference:dialog-cancel">
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)} data-test-id="ux-reference:dialog-confirm">
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:dialog-input-value">
          Dialog input: <span className="font-mono text-foreground">{dialogInput || "<empty>"}</span>
        </p>
        <p className="text-xs text-muted-foreground">Note: Dialog blocks interaction with page elements</p>
      </section>

      {/* ALERT DIALOG SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:alert-dialog-section">
        <h2 className="text-xl font-semibold">Alert Dialog</h2>

        <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" data-test-id="ux-reference:alert-trigger">
              Delete Something
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent data-test-id="ux-reference:alert-dialog-content">
            <AlertDialogHeader>
              <AlertDialogTitle data-test-id="ux-reference:alert-title">Confirm Delete</AlertDialogTitle>
              <AlertDialogDescription data-test-id="ux-reference:alert-description">
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-test-id="ux-reference:alert-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction data-test-id="ux-reference:alert-confirm">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <p className="text-xs text-muted-foreground">
          Alert dialogs demand user attention and block other interactions
        </p>
      </section>

      {/* TABS SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:tabs-section">
        <h2 className="text-xl font-semibold">Tabs</h2>

        <Tabs value={activeTab} onValueChange={setActiveTab} data-test-id="ux-reference:tabs">
          <TabsList data-test-id="ux-reference:tabs-list">
            <TabsTrigger value="tab-1" data-test-id="ux-reference:tab-trigger:1">
              Tab 1
            </TabsTrigger>
            <TabsTrigger value="tab-2" data-test-id="ux-reference:tab-trigger:2">
              Tab 2
            </TabsTrigger>
            <TabsTrigger value="tab-3" data-test-id="ux-reference:tab-trigger:3">
              Tab 3
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab-1" data-test-id="ux-reference:tab-content:1">
            <p>This is tab 1 content.</p>
          </TabsContent>
          <TabsContent value="tab-2" data-test-id="ux-reference:tab-content:2">
            <p>This is tab 2 content. Try switching tabs.</p>
          </TabsContent>
          <TabsContent value="tab-3" data-test-id="ux-reference:tab-content:3">
            <p>This is tab 3 content.</p>
          </TabsContent>
        </Tabs>

        <p className="text-sm text-muted-foreground" data-test-id="ux-reference:tabs-active">
          Active tab: <span className="font-mono text-foreground">{activeTab}</span>
        </p>
        <p className="text-xs text-muted-foreground">Helper: clickByTestId to switch tabs</p>
      </section>

      {/* ALERTS SECTION */}
      <section className="space-y-4" data-test-id="ux-reference:alerts-section">
        <h2 className="text-xl font-semibold">Alerts</h2>

        <Alert data-test-id="ux-reference:alert-info">
          <AlertDescription data-test-id="ux-reference:alert-info-text">
            This is an informational alert message.
          </AlertDescription>
        </Alert>

        <Alert data-test-id="ux-reference:alert-warning">
          <AlertDescription data-test-id="ux-reference:alert-warning-text">
            This is a warning alert message.
          </AlertDescription>
        </Alert>

        <Alert data-test-id="ux-reference:alert-error">
          <AlertDescription data-test-id="ux-reference:alert-error-text">
            This is an error alert message.
          </AlertDescription>
        </Alert>

        <p className="text-xs text-muted-foreground">
          Alerts are always visible; use getElementByTestId to check content
        </p>
      </section>

      {/* HELPER USAGE GUIDE */}
      <section className="rounded-lg border bg-muted p-4" data-test-id="ux-reference:helpers-guide">
        <h2 className="mb-2 text-sm font-semibold">E2E Helper Quick Reference</h2>
        <div className="space-y-1 text-xs text-muted-foreground font-mono">
          <p>• setInputText(testId, value) - Set input/textarea value</p>
          <p>• getInputText(testId) - Get input/textarea value</p>
          <p>• clickByTestId(testId) - Click element by test ID</p>
          <p>• selectOptionByTestId(trigger, option) - Select dropdown/menu option</p>
          <p>• setSwitchState(testId, desired) - Set switch on/off</p>
          <p>• setCheckboxState(testId, desired) - Set checkbox checked/unchecked</p>
          <p>• getElementByTestId(testId, timeout?) - Wait for and get element</p>
          <p>• waitForTestIdToDisappear(testId) - Wait for element removal</p>
          <p>• resetOverlays(attempts?) - Close open dialogs (Escape key)</p>
        </div>
      </section>
    </div>
  )
}
