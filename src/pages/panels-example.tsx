import { useRef, useState } from "react"
import { Panel, PanelGroup, type PanelGroupHandle } from "@knurl/react-panels"
import "@knurl/react-panels/style.css"

interface LogEntry {
  id: string
  message: string
}

export default function PanelsExample() {
  const horizontalGroupRef = useRef<PanelGroupHandle>(null)
  const nestedGroupRef = useRef<PanelGroupHandle>(null)
  const [resizeLog, setResizeLog] = useState<LogEntry[]>([])

  const handleResize = (sizes: string[]) => {
    setResizeLog((prev) => [
      ...prev.slice(-5),
      { id: `${Date.now()}-${Math.random()}`, message: `Resizing: ${sizes.join(", ")}` },
    ])
  }

  const handleCollapseLeft = () => {
    horizontalGroupRef.current?.setSizes(["0px", "100%"])
  }

  const handleReset = () => {
    horizontalGroupRef.current?.setSizes(["50%", "50%"])
  }

  const handleCustomSplit = () => {
    horizontalGroupRef.current?.setSizes(["200px", "100%"])
  }

  const handleNestedCollapse = () => {
    nestedGroupRef.current?.setSizes(["0px", "100%"])
  }

  const handleNestedReset = () => {
    nestedGroupRef.current?.setSizes(["50%", "50%"])
  }

  return (
    <div style={{ padding: "20px", height: "100vh", display: "flex", flexDirection: "column" }}>
      <h1>React Panels Library - Examples</h1>

      <div style={{ marginBottom: "20px" }}>
        <h2>Controls</h2>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <button type="button" onClick={handleCollapseLeft}>
            Collapse Left
          </button>
          <button type="button" onClick={handleReset}>
            Reset 50/50
          </button>
          <button type="button" onClick={handleCustomSplit}>
            200px Left / Rest Right
          </button>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleNestedCollapse}>
            Collapse Nested Top
          </button>
          <button type="button" onClick={handleNestedReset}>
            Reset Nested
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <h3>Resize Log:</h3>
        <div style={{ fontSize: "12px", fontFamily: "monospace" }}>
          {resizeLog.map((log) => (
            <div key={log.id}>{log.message}</div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, border: "2px solid #ccc", overflow: "hidden" }}>
        <PanelGroup
          ref={horizontalGroupRef}
          direction="horizontal"
          onResize={handleResize}
          onResizeStart={() => console.log("Resize started")}
          onResizeEnd={(sizes) => console.log("Resize ended:", sizes)}
        >
          <Panel
            defaultSize="30%"
            minSize="10%"
            maxSize="70%"
            style={{
              background: "#f0f0f0",
              padding: "20px",
              borderRight: "1px solid #ccc",
            }}
          >
            <h3>Left Panel</h3>
            <p>Default: 30%</p>
            <p>Min: 10%</p>
            <p>Max: 70%</p>
            <p>Try dragging the resize handle!</p>
          </Panel>

          <Panel
            defaultSize="70%"
            minSize="100px"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3>Right Panel (with nested panels)</h3>
            <p>Default: 70%</p>
            <p>Min: 100px</p>

            <div style={{ flex: 1, marginTop: "10px", border: "1px solid #ccc" }}>
              <PanelGroup ref={nestedGroupRef} direction="vertical">
                <Panel
                  defaultSize="50%"
                  minSize="50px"
                  style={{
                    background: "#e8f4f8",
                    padding: "15px",
                    borderBottom: "1px solid #ccc",
                  }}
                >
                  <h4>Nested Top Panel</h4>
                  <p>This demonstrates vertical nested panels</p>
                  <p>Default: 50%, Min: 50px</p>
                </Panel>

                <Panel
                  defaultSize="50%"
                  minSize="50px"
                  style={{
                    background: "#f8e8f4",
                    padding: "15px",
                  }}
                >
                  <h4>Nested Bottom Panel</h4>
                  <p>Drag the horizontal handle above to resize</p>
                  <p>Default: 50%, Min: 50px</p>
                </Panel>
              </PanelGroup>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
