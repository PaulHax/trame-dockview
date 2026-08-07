from trame.app import get_server
from trame.ui.html import DivLayout

from trame.widgets import dockview, html
from trame.widgets import vuetify3 as v3


class DockViewE2E:
    def __init__(self):
        self.server = get_server("trame_dockview_e2e", client_type="vue3")
        self.state = self.server.state
        self.state.e2e_events = {
            "activePanels": [],
            "layoutCount": 0,
            "removedPanels": [],
        }
        self._layout = None
        self._build_panel_templates()
        self._build_ui()

    def _build_panel_templates(self):
        for panel_id in ("panel-a", "panel-b", "panel-c"):
            template_name = panel_id.replace("-", "_")
            with DivLayout(self.server, template_name) as layout:
                layout.root.style = "height: 100%;"
                with html.Div(
                    id=f"content-{panel_id}",
                    style="height: 100%; padding: 1rem; box-sizing: border-box;",
                ):
                    v3.VSwitch(
                        v_model=(f"{template_name}_enabled", False),
                        label=f"Toggle {panel_id}",
                        hide_details=True,
                    )

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            self.ui.root.style = "height: 100vh;"
            with v3.VApp():
                with html.Div(
                    style="height: 100%; display: flex; flex-direction: column;"
                ):
                    with html.Div(style="flex: 0 0 auto; display: flex; gap: 0.5rem;"):
                        html.Button(
                            "Activate panel B",
                            id="activate-panel-b",
                            click=self.activate_panel_b,
                        )
                        html.Button(
                            "Activate panel C",
                            id="activate-panel-c",
                            click=self.activate_panel_c,
                        )
                        html.Button(
                            "Restore", id="restore-layout", click=self.restore_layout
                        )
                        html.Button(
                            "Remove panel B",
                            id="remove-panel-b",
                            click=self.remove_panel_b,
                        )
                        html.Button(
                            "Reset events", id="reset-events", click=self.reset_events
                        )
                    html.Pre(
                        "{{ JSON.stringify(e2e_events) }}",
                        id="event-state",
                        style="display: none;",
                    )
                    with html.Div(style="flex: 1 1 auto; min-height: 0;"):
                        self.dock = dockview.DockView(
                            ref="e2eDock",
                            default_renderer="always",
                            theme="Light",
                            ready=self.add_panels,
                            active_panel=(self.on_active_panel, "[$event]"),
                            layout_changed=(self.on_layout_changed, "[$event]"),
                            remove_panel=(self.on_remove_panel, "[$event]"),
                        )

    def _append_event(self, key, value):
        events = dict(self.state.e2e_events)
        events[key] = [*events[key], value]
        self.state.e2e_events = events

    def add_panels(self):
        self.dock.add_panel("panel-a", "panel-a", "panel_a")
        self.dock.add_panel(
            "panel-b",
            "panel-b",
            "panel_b",
            position={"referencePanel": "panel-a", "direction": "right"},
        )
        self.dock.add_panel(
            "panel-c",
            "panel-c",
            "panel_c",
            position={"referencePanel": "panel-a", "direction": "within"},
        )

    def activate_panel_b(self):
        self.dock.active_panel("panel-b")

    def activate_panel_c(self):
        self.dock.active_panel("panel-c")

    def remove_panel_b(self):
        self.dock.remove_panel("panel-b")

    def restore_layout(self):
        if self._layout is not None:
            self.dock.restore_layout(self._layout)

    def reset_events(self):
        self.state.e2e_events = {
            "activePanels": [],
            "layoutCount": 0,
            "removedPanels": [],
        }

    def on_active_panel(self, panel_id):
        self._append_event("activePanels", panel_id)

    def on_layout_changed(self, layout):
        self._layout = layout
        events = dict(self.state.e2e_events)
        events["layoutCount"] += 1
        self.state.e2e_events = events

    def on_remove_panel(self, panel_id):
        self._append_event("removedPanels", panel_id)


if __name__ == "__main__":
    app = DockViewE2E()
    app.server.start(
        host="127.0.0.1",
        port=4173,
        open_browser=False,
        show_connection_info=False,
    )
