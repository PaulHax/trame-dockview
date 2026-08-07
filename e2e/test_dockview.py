from contextlib import asynccontextmanager
from uuid import uuid4

import pytest
from playwright.async_api import Page, async_playwright, expect

from e2e.app import DockViewE2E

EMPTY_EVENTS = '{"activePanels":[],"layoutCount":0,"removedPanels":[]}'


async def reset_events(page: Page):
    await page.locator("#reset-events").click()
    await expect(page.locator("#event-state")).to_have_text(EMPTY_EVENTS)


@asynccontextmanager
async def e2e_page():
    app = DockViewE2E(f"trame_dockview_e2e_{uuid4().hex}")
    server_task = app.server.start(
        exec_mode="task",
        host="127.0.0.1",
        port=0,
        open_browser=False,
        show_connection_info=False,
    )
    await app.server.ready

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()
            try:
                page = await browser.new_page()
                await page.goto(f"http://127.0.0.1:{app.server.port}/")
                await expect(page.get_by_role("tab", name="panel-c")).to_be_visible()
                await expect(page.locator("#content-panel-c")).to_be_visible()
                await reset_events(page)
                yield page
            finally:
                await browser.close()
    finally:
        await app.server.stop()
        await server_task


@pytest.mark.asyncio
async def test_trame_panel_labels_target_only_their_own_switch():
    async with e2e_page() as page:
        panel_b = page.locator("#content-panel-b")
        panel_c = page.locator("#content-panel-c")

        await panel_b.get_by_text("Toggle panel-b").click()
        await expect(panel_b.locator('input[type="checkbox"]')).to_be_checked()
        await expect(panel_c.locator('input[type="checkbox"]')).not_to_be_checked()

        await panel_c.get_by_text("Toggle panel-c").click()
        await expect(panel_c.locator('input[type="checkbox"]')).to_be_checked()
        await expect(panel_b.locator('input[type="checkbox"]')).to_be_checked()


@pytest.mark.asyncio
async def test_restore_reuses_mounted_panels_and_emits_one_final_active_panel():
    async with e2e_page() as page:
        event_state = page.locator("#event-state")

        await page.locator("#activate-panel-b").click()
        await expect(event_state).to_contain_text('"activePanels":["panel-b"]')
        await reset_events(page)

        await page.locator("#activate-panel-c").click()
        await expect(event_state).to_have_text(
            '{"activePanels":["panel-c"],"layoutCount":1,"removedPanels":[]}'
        )

        await page.evaluate(
            """window.panelCInput = document.querySelector(
                '#content-panel-c input[type="checkbox"]'
            )"""
        )
        await reset_events(page)
        await page.locator("#restore-layout").click()

        await expect(event_state).to_have_text(
            '{"activePanels":["panel-c"],"layoutCount":1,"removedPanels":[]}'
        )
        assert await page.evaluate(
            """window.panelCInput === document.querySelector(
                '#content-panel-c input[type="checkbox"]'
            )"""
        )


@pytest.mark.asyncio
async def test_user_and_programmatic_removals_each_emit_exactly_once():
    async with e2e_page() as page:
        event_state = page.locator("#event-state")

        await (
            page.get_by_role("tab", name="panel-c")
            .locator(".dv-default-tab-action")
            .click()
        )
        await expect(event_state).to_contain_text('"removedPanels":["panel-c"]')

        await reset_events(page)
        await page.locator("#remove-panel-b").click()
        await expect(event_state).to_have_text(
            '{"activePanels":[],"layoutCount":1,"removedPanels":["panel-b"]}'
        )
