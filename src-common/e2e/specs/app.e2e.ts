describe("Application Smoke Test", () => {
  it("should launch the application and have the correct title", async () => {
    await expect(browser).toHaveTitle(expect.stringContaining("KNURL"))
  })
})
