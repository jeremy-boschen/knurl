describe('Application Smoke Test', () => {
    it('should launch the application and have the correct title', async () => {
        await expect(browser).toHaveTitle(expect.stringContaining('KNURL'));
    });
    it('should show the "No request open" message on startup', async () => {
        const messageElement = await $('div.text-center > p.text-lg');
        await expect(messageElement).toBeDisplayed();
        await expect(messageElement).toHaveText('No request open');
    });
});
export {};
