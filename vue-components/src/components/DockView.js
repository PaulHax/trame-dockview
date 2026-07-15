import "dockview-vue/dist/styles/dockview.css";
import { computed, onBeforeUnmount } from "vue";
import { DockviewVue } from "dockview-vue";
import DockPanel from "./DockPanel";

const THEMES = {
  dark: {
    name: "dark",
    className: "dockview-theme-dark",
  },
  light: {
    name: "light",
    className: "dockview-theme-light",
  },
  visualstudio: {
    name: "visualStudio",
    className: "dockview-theme-vs",
  },
  abyss: {
    name: "abyss",
    className: "dockview-theme-abyss",
  },
  dracula: {
    name: "dracula",
    className: "dockview-theme-dracula",
  },
  replit: {
    name: "replit",
    className: "dockview-theme-replit",
    gap: 10,
  },
  abyssspaced: {
    name: "abyssSpaced",
    className: "dockview-theme-abyss-spaced",
    gap: 10,
    dndOverlayMounting: "absolute",
    dndPanelOverlay: "group",
  },
  lightspaced: {
    name: "lightSpaced",
    className: "dockview-theme-light-spaced",
    gap: 10,
    dndOverlayMounting: "absolute",
    dndPanelOverlay: "group",
  },
};

const LAYOUT_CHANGE_DEBOUNCE = 500;

function templateToComponent(name) {
  const safeName = name
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll("--", "-");
  return `trame-template-${safeName}`;
}

const PROP_NAMES = [
  "defaultRenderer",
  "disableAutoResizing",
  "disableDnd",
  "disableFloatingGroups",
  "disableTabsOverflowList",
  "dndEdges",
  "floatingGroupBounds",
  "hideBorders",
  "locked",
  "noPanelsOverlay",
  "popoutUrl",
  "scrollbars",
  "singleTabMode",
];

export default {
  emits: [
    "ready",
    "activePanel",
    "removePanel",
    "layoutChanged",
    "panelVisibility",
  ],
  props: {
    theme: {
      default: "Dracula",
    },
    defaultRenderer: {
      default: "always",
      type: String,
    },
    disableAutoResizing: {
      default: false,
      type: Boolean,
    },
    disableDnd: {
      default: false,
      type: Boolean,
    },
    disableFloatingGroups: {
      default: false,
      type: Boolean,
    },
    disableTabsOverflowList: {
      default: false,
      type: Boolean,
    },
    dndEdges: {
      default: false,
      type: Boolean,
    },
    floatingGroupBounds: {}, // {minimumHeightWithinViewport, minimumWidthWithinViewport} | boundedWithinViewport
    hideBorders: {
      default: false,
      type: Boolean,
    },
    locked: {
      default: false,
      type: Boolean,
    },
    noPanelsOverlay: {
      default: "watermark", // watermark | emptyGroup
      type: String,
    },
    popoutUrl: {
      type: String,
    },
    scrollbars: {
      // custom | native
      type: String,
    },
    singleTabMode: {
      default: "default", // default | fullwidth
      type: String,
    },
    components: {
      default: () => ({
        defaultTabComponent: null,
        leftHeaderActionsComponent: null,
        prefixHeaderActionsComponent: null,
        rightHeaderActionsComponent: null,
        watermarkComponent: null,
      }),
    },
  },
  components: {
    DockviewVue,
    DockPanel,
  },
  setup(props, { emit }) {
    let api = null;
    const disposables = [];
    const panelDisposables = new Map();
    const pendingCalls = [];
    const theme = computed(() => THEMES[props.theme.toLowerCase()]);

    onBeforeUnmount(() => {
      panelDisposables.forEach((disposable) => disposable.dispose());
      panelDisposables.clear();
      while (disposables.length) {
        disposables.pop().dispose();
      }
    });

    // Queue calls made before the dockview api is ready and flush them in order
    function whenReady(fn) {
      if (api) {
        fn();
      } else {
        pendingCalls.push(fn);
      }
    }

    function debounce(fn, delay) {
      let timeout = null;
      const debounced = (...args) => {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(() => fn(...args), delay);
      };
      debounced.cancel = () => window.clearTimeout(timeout);
      return debounced;
    }

    function watchPanelVisibility(panel) {
      const panelId = panel?.id;
      if (!panelId || !panel?.api?.onDidVisibilityChange) {
        return;
      }
      panelDisposables.get(panelId)?.dispose();
      panelDisposables.set(
        panelId,
        panel.api.onDidVisibilityChange(({ isVisible }) => {
          emit("panelVisibility", { id: panelId, visible: isVisible });
        }),
      );
      // Seed the server-side visibility map with the panel's current state,
      // covering panels added inactive or restored hidden via fromJSON.
      emit("panelVisibility", { id: panelId, visible: panel.api.isVisible });
    }

    function onReady(event) {
      api = event.api;

      // Listen to active panel to emit event
      disposables.push(
        api.onDidActivePanelChange((e) => {
          emit("activePanel", e?.id);
        }),
      );
      disposables.push(
        api.onDidRemovePanel((e) => {
          panelDisposables.get(e?.id)?.dispose();
          panelDisposables.delete(e?.id);
          emit("removePanel", e?.id);
        }),
      );

      // Track visibility of every panel, including panels restored via fromJSON
      disposables.push(api.onDidAddPanel(watchPanelVisibility));

      // Emit debounced layout snapshots for persistence
      const emitLayout = debounce(
        () => emit("layoutChanged", api.toJSON()),
        LAYOUT_CHANGE_DEBOUNCE,
      );
      disposables.push(api.onDidLayoutChange(emitLayout));
      disposables.push({ dispose: emitLayout.cancel });

      emit("ready");

      while (pendingCalls.length) {
        const call = pendingCalls.shift();
        try {
          call();
        } catch (error) {
          console.error("trame-dockview: queued call failed", error);
        }
      }
    }

    function addPanel(id, title, templateName, addOn = {}) {
      whenReady(() => {
        api.addPanel({
          id,
          title,
          component: "DockPanel",
          params: { templateName },
          ...addOn,
        });
      });
    }
    // v-bind
    const bind = computed(() => {
      const dockViewProps = {};
      Object.entries(props.components).forEach(([k, v]) => {
        if (v) {
          dockViewProps[k] = templateToComponent(v);
        }
      });

      PROP_NAMES.forEach((key) => {
        if (props[key]) {
          dockViewProps[key] = props[key];
        }
      });

      return dockViewProps;
    });

    function removePanel(panelId) {
      whenReady(() => {
        api.getPanel(panelId)?.api?.close();
      });
    }

    function activePanel(panelId) {
      whenReady(() => {
        api.getPanel(panelId)?.api?.setActive();
      });
    }

    function setPanelTitle(panelId, title) {
      whenReady(() => {
        api.getPanel(panelId)?.api?.setTitle(title);
      });
    }

    function movePanelTo(panelId, position) {
      whenReady(() => {
        const panel = api.getPanel(panelId);
        panel?.api?.moveTo({
          position,
          group: panel.api._group,
        });
      });
    }

    function restoreLayout(layout) {
      whenReady(() => {
        api.fromJSON(layout);
        emit("activePanel", api.activePanel?.id);
      });
    }

    return {
      theme,
      onReady,
      addPanel,
      bind,
      removePanel,
      activePanel,
      setPanelTitle,
      movePanelTo,
      restoreLayout,
    };
  },
  template:
    '<div style="position:relative;width:100%;height:100%;"><dockview-vue style="position:absolute;width:100%;height:100%" :theme="theme" v-bind="bind" @ready="onReady" /></div>',
};
