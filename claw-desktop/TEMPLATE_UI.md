Directory structure:
└── src/
    ├── App.tsx
    ├── components/
    │   ├── AIPanel.tsx
    │   ├── ChatHistoryList.tsx
    │   └── ai/
    │       ├── AIPanelHeader.tsx
    │       ├── AIPromptInput.tsx
    │       ├── ChatMessage.tsx
    │       ├── ChatMessageList.tsx
    │       └── NoApiKeyView.tsx
    ├── hooks/
    │   └── useSubAgentListener.ts
    ├── scenes/
    │   └── MainPanel.tsx
    └── store/
        ├── actions/
        │   ├── aiChatActions.ts
        │   └── aiSessionActions.ts
        ├── appStore.ts
        └── types.ts


================================================
FILE: src/App.tsx
================================================
// src/App.tsx
import { useEffect, useMemo, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
  CheckMenuItem,
} from "@tauri-apps/api/menu";
import { save, message } from "@tauri-apps/plugin-dialog"; // <-- THAY ĐỔI IMPORT
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useAppStore, useAppActions } from "./store/appStore";
import {
  type GroupStats,
  type AppSettings,
  type ScanCompletePayload,
  type AIModel,
} from "./store/types";
import { useShallow } from "zustand/react/shallow"; // <-- THÊM IMPORT NÀY
import { WelcomeScene } from "./scenes/WelcomeScene";
import { ScanningScene } from "./scenes/ScanningScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { SidebarPanel } from "./scenes/SidebarPanel";
import { GitPanel } from "./components/GitPanel";
import { AIPanel } from "./components/AIPanel"; // THÊM IMPORT
import { KiloPanel } from "./components/KiloPanel"; // THÊM IMPORT KILO PANEL
import { PatchPanel } from "./components/patch/PatchPanel";
import { MainPanel } from "./scenes/MainPanel";
import { googleModels, nvidiaModels } from "@/lib/aiModels";
import { StatusBar } from "./components/StatusBar";
import { useSubAgentListener } from "./hooks/useSubAgentListener";
import { RescanIndicator } from "./components/RescanIndicator";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./components/ui/resizable";
import { throttle } from "@/lib/utils";
import "./App.css";

function App() {
  const {
    selectedPath,
    activeScene,
    isScanning,
    isRescanning,
    projectStats,
    isSidebarVisible,
    isEditorPanelVisible,
    isGitPanelVisible,
    gitRepoInfo,
    isGroupEditorPanelVisible,
    isAiPanelVisible,
    isKiloPanelVisible,
    isPatchPanelVisible,
  } = useAppStore(
    // --- SỬA LỖI TẠI ĐÂY ---
    useShallow((state) => ({
      selectedPath: state.selectedPath,
      activeScene: state.activeScene,
      isScanning: state.isScanning,
      isRescanning: state.isRescanning,
      projectStats: state.projectStats,
      isSidebarVisible: state.isSidebarVisible,
      isGitPanelVisible: state.isGitPanelVisible,
      isEditorPanelVisible: state.isEditorPanelVisible,
      gitRepoInfo: state.gitRepoInfo,
      isGroupEditorPanelVisible: state.isGroupEditorPanelVisible,
      isAiPanelVisible: state.isAiPanelVisible, // THÊM STATE
      isKiloPanelVisible: state.isKiloPanelVisible,
      isPatchPanelVisible: state.isPatchPanelVisible,
    }))
  );

  const {
    _setScanProgress,
    _setAnalysisProgress,
    _setScanComplete,
    _setScanError,
    _setGroupUpdateComplete,
    rescanProject,
    openFolderFromMenu,
    showSettingsScene,
    exportProject,
    copyProjectToClipboard,
    toggleProjectPanelVisibility,
    toggleGitPanelVisibility,
    toggleEditorPanelVisibility,
    _setRecentPaths,
    updateAppSettings,
    reset,
    toggleGroupEditorPanelVisibility,
    toggleAiPanelVisibility, // THÊM ACTION
    toggleKiloPanelVisibility,
    togglePatchPanelVisibility,
    addKiloLog,
    setKiloServerStatus,
    addPatchLog,
    setPatchServerStatus,
  } = useAppActions();

  const { t } = useTranslation();

  const appMenuRef = useRef<Menu | null>(null);

  // Hook khởi chạy Sub-Agent ngầm
  useSubAgentListener();

  // --- Effect áp dụng theme (giữ nguyên) ---
  useEffect(() => {
    const theme = localStorage.getItem("theme") || "light";
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, []);

  // Effect to manage syntax highlighting theme
  useEffect(() => {
    const linkId = "hljs-theme";
    let link = document.getElementById(linkId) as HTMLLinkElement;

    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      link.href = isDark
        ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css";
    };

    updateTheme(); // Set initial theme

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Load app settings on startup
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("get_app_settings");
        // Cập nhật state một lần với tất cả cài đặt
        _setRecentPaths(settings.recentPaths ?? []);

        let allAvailableModels: AIModel[] = [...googleModels, ...nvidiaModels];

        // Fetch all models from OpenRouter
        try {
          const response = await tauriFetch(
            "https://openrouter.ai/api/v1/models"
          );
          const data = await response.json();
          const allModelsData: any[] = data.data;
          const openRouterModels: AIModel[] = allModelsData.map((m: any) => ({
            provider: "openrouter",
            id: m.id,
            name: m.name,
            context_length: m.context_length,
            pricing: {
              prompt: m.pricing.prompt,
              completion: m.pricing.completion,
            },
          }));
          allAvailableModels.push(...openRouterModels);
        } catch (e) {
          console.warn("Could not fetch OpenRouter models", e);
        }

        const savedKiloModel = settings.selectedKiloModel ?? "kilo/minimax/minimax-m2.5:free";

        const savedModelIds = settings.aiModels ?? ["gemini-flash-latest"];

        const projectAiModels: AIModel[] = savedModelIds
          .map((id) => allAvailableModels.find((m) => m.id === id))
          .filter((m): m is AIModel => !!m);

        // Dùng set thay vì updateAppSettings để không ghi lại file
        useAppStore.setState({
          nonAnalyzableExtensions: settings.nonAnalyzableExtensions ?? [],
          nonAnalyzableFolders: settings.nonAnalyzableFolders ?? [],
          openRouterApiKey: settings.openRouterApiKey ?? "",
          googleApiKey: settings.googleApiKey ?? "",
          nvidiaApiKey: settings.nvidiaApiKey ?? "",
          allAvailableModels,
          // SỬA LỖI: Thêm các cài đặt AI bị thiếu vào đây
          streamResponse: settings.streamResponse ?? true,
          systemPrompt: settings.systemPrompt ?? "",
          temperature: settings.temperature ?? 1.0,
          topP: settings.topP ?? 1.0,
          topK: settings.topK ?? 0,
          maxTokens: settings.maxTokens ?? 0,
          geminiThinkingLevel: settings.geminiThinkingLevel ?? "MEDIUM",
          subAgentModel: settings.subAgentModel ?? "",
          subAgentEnabled: settings.subAgentEnabled ?? true,
          subAgentMaxRetries: settings.subAgentMaxRetries ?? 3,
          kiloPort: settings.kiloPort ?? 9999,
          patchPort: settings.patchPort ?? 9998,
          discordWebhookUrl: settings.discordWebhookUrl ?? "",
          aiModels: projectAiModels.length
            ? projectAiModels
            : [
                allAvailableModels.find((m) => m.id === "gemini-flash-latest")!,
              ].filter(Boolean),
          selectedAiModel:
            projectAiModels.find(
              (m) => m.id === useAppStore.getState().selectedAiModel
            )?.id ||
            projectAiModels[0]?.id ||
            "gemini-flash-latest",
          selectedKiloModel: savedKiloModel,
        });

        // Bắn model đã lưu xuống backend để Kilo Agent biết
        if (savedKiloModel) {
           invoke("set_kilo_model", { model: savedKiloModel }).catch(console.error);
        }
      } catch (e) {
        console.error("Could not load app settings:", e);
      }
    };
    loadSettings();
  }, [_setRecentPaths]);

  // --- CẬP NHẬT LOGIC TẠO MENU ---
  // Effect này sẽ chạy mỗi khi `selectedPath` hoặc `isScanning` thay đổi
  const createMenu = async () => {
    const setupMenu = async () => {
      try {
        const openFolderItem = await MenuItem.new({
          id: "open_new_folder",
          text: t("appMenu.file.openNew"),
          action: openFolderFromMenu,
        });

        const rescanFolderItem = await MenuItem.new({
          id: "rescan_folder",
          text: t("appMenu.file.rescan"),
          enabled: !isRescanning,
          action: async () => {
            if (useAppStore.getState().selectedPath) {
              rescanProject();
            } else {
              await message("Vui lòng mở một dự án trước khi quét lại.", {
                title: "Thông báo",
                kind: "info",
              });
            }
          },
        });

        // --- TẠO CÁC MENU ITEM MỚI ---
        const exportProjectItem = await MenuItem.new({
          id: "export_project",
          text: t("appMenu.file.exportProject"),
          action: exportProject,
        });

        const copyProjectItem = await MenuItem.new({
          id: "copy_project",
          text: t("appMenu.file.copyProject"),
          action: copyProjectToClipboard,
        });

        const closeProjectItem = await MenuItem.new({
          id: "close_project",
          text: t("appMenu.file.closeProject"),
          action: reset,
        });

        const fileSubmenu = await Submenu.new({
          text: t("appMenu.file.title"),
          items: [
            openFolderItem,
            rescanFolderItem,
            exportProjectItem,
            copyProjectItem,
            await PredefinedMenuItem.new({ item: "Separator" }),
            closeProjectItem,
          ],
        });

        // --- MENU MỚI ---
        const windowSubmenu = await Submenu.new({
          text: t("appMenu.window.title"),
          items: [
            await CheckMenuItem.new({
              id: "toggle_project_panel",
              text: t("appMenu.window.projectPanel"),
              action: toggleProjectPanelVisibility,
              checked: isSidebarVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_git_panel",
              text: t("appMenu.window.gitPanel"),
              action: toggleGitPanelVisibility,
              checked: isGitPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_group_editor_panel",
              text: t("appMenu.window.groupEditorPanel"),
              action: toggleGroupEditorPanelVisibility,
              checked: isGroupEditorPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_editor_panel",
              text: t("appMenu.window.editorPanel"),
              action: toggleEditorPanelVisibility,
              checked: isEditorPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_ai_panel",
              text: t("appMenu.window.aiPanel"), // THÊM DÒNG NÀY
              action: toggleAiPanelVisibility,
              checked: isAiPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_kilo_panel",
              text: t("appMenu.window.kiloPanel"),
              action: toggleKiloPanelVisibility,
              checked: isKiloPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_patch_panel",
              text: "Auto-Patch Panel",
              action: togglePatchPanelVisibility,
              checked: isPatchPanelVisible,
            }),
          ],
        });

        const appMenu = await Menu.new({
          items: [fileSubmenu, windowSubmenu],
        });

        // Đặt menu cho cửa sổ hiện tại
        await appMenu.setAsAppMenu();
        appMenuRef.current = appMenu; // Lưu lại menu để cập nhật sau
      } catch (error) {
        console.error("Failed to create application menu:", error);
        await message(t("appMenu.errors.initFailed"), {
          title: t("appMenu.errors.criticalError"),
          kind: "error",
        });
      }
    };

    const clearMenu = async () => {
      try {
        // Tạo menu rỗng để gỡ bỏ menu
        const emptyMenu = await Menu.new({
          items: [],
        });
        await emptyMenu.setAsAppMenu();
        appMenuRef.current = null;
      } catch (error) {
        console.error("Failed to clear application menu:", error);
      }
    };

    // Logic chính:
    // Nếu có selectedPath VÀ không đang quét, thì tạo menu
    if (selectedPath && !isScanning) {
      setupMenu();
    } else {
      // Nếu không có (đang ở Welcome hoặc đang quét), thì gỡ menu
      clearMenu();
    }
  };

  // Effect để tạo menu chỉ một lần khi cần
  useEffect(() => {
    createMenu();
  }, [
    selectedPath,
    isScanning,
    t, // Chạy lại nếu ngôn ngữ thay đổi
    openFolderFromMenu,
    rescanProject,
    exportProject,
    copyProjectToClipboard,
    toggleProjectPanelVisibility,
    toggleGitPanelVisibility,
    toggleEditorPanelVisibility,
    toggleGroupEditorPanelVisibility,
    toggleAiPanelVisibility,
    toggleKiloPanelVisibility,
    togglePatchPanelVisibility,
    _setRecentPaths,
    reset,
  ]);

  // Effects riêng để cập nhật trạng thái checked của từng menu item
  // Điều này hiệu quả hơn rất nhiều so với việc tạo lại toàn bộ menu
  const updateMenuCheckedState = async (id: string, checked: boolean) => {
    if (appMenuRef.current) {
      const item = (await appMenuRef.current.get(id)) as CheckMenuItem;
      if (item && (await item.isChecked()) !== checked) {
        await item.setChecked(checked);
      }
    }
  };

  useEffect(() => {
    updateMenuCheckedState("toggle_project_panel", isSidebarVisible);
  }, [isSidebarVisible]);

  useEffect(() => {
    updateMenuCheckedState("toggle_git_panel", isGitPanelVisible);
  }, [isGitPanelVisible]);

  useEffect(() => {
    updateMenuCheckedState(
      "toggle_group_editor_panel",
      isGroupEditorPanelVisible
    );
  }, [isGroupEditorPanelVisible]);

  useEffect(() => {
    updateMenuCheckedState("toggle_editor_panel", isEditorPanelVisible);
  }, [isEditorPanelVisible]);

  useEffect(() => {
    updateMenuCheckedState("toggle_ai_panel", isAiPanelVisible);
  }, [isAiPanelVisible]);

  useEffect(() => {
    updateMenuCheckedState("toggle_kilo_panel", isKiloPanelVisible);
  }, [isKiloPanelVisible]);

  useEffect(() => {
    updateMenuCheckedState("toggle_patch_panel", isPatchPanelVisible);
  }, [isPatchPanelVisible]);

  const throttledSetScanProgress = useMemo(
    () => throttle((file: string) => _setScanProgress(file), 10),
    [_setScanProgress]
  );
  const throttledSetAnalysisProgress = useMemo(
    () => throttle((file: string) => _setAnalysisProgress(file), 10),
    [_setAnalysisProgress]
  );

  // --- LẮNG NGHE SỰ KIỆN TỪ RUST ---
  useEffect(() => {
    const unlistenFuncs: Promise<() => void>[] = [];

    unlistenFuncs.push(
      listen<string>("scan_progress", (event) => {
        throttledSetScanProgress(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<string>("analysis_progress", (event) => {
        throttledSetAnalysisProgress(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<ScanCompletePayload>("scan_complete", async (event) => {
        const { projectData, isFirstScan } = event.payload;
        _setScanComplete(projectData);

        if (isFirstScan) {
          let permissionGranted = await isPermissionGranted();
          if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === "granted";
          }
          if (permissionGranted) {
            sendNotification({
              title: t("notifications.firstScanComplete.title"),
              body: t("notifications.firstScanComplete.body"),
            });
          }
        }
      })
    );
    unlistenFuncs.push(
      listen<string>("scan_error", async (event) => {
        _setScanError(event.payload);
        const errorKey = `errors.${event.payload}`;
        const translatedError = t(errorKey);
        await message(
          t("errors.scanError", {
            error:
              translatedError === errorKey ? event.payload : translatedError,
          }),
          {
            title: t("common.error"),
            kind: "error",
          }
        );
      })
    );
    unlistenFuncs.push(
      listen<{ groupId: string; stats: GroupStats; paths: string[] }>(
        "group_update_complete",
        async (event) => {
          _setGroupUpdateComplete(event.payload);
        }
      )
    );
    unlistenFuncs.push(
      listen<string>("auto_sync_error", async (event) => {
        await message(t("errors.syncError", { error: event.payload }), {
          title: t("common.syncError"),
          kind: "error",
        });
      })
    );
    unlistenFuncs.push(
      listen<void>("file_change_detected", () => {
        if (!useAppStore.getState().isScanning) {
          rescanProject();
        }
      })
    );

    unlistenFuncs.push(
      listen<{ updates: Record<string, number> }>("file_token_update_batch", (event) => {
        useAppStore.getState().actions._updateFileTokenBatch(event.payload.updates);
      })
    );

    unlistenFuncs.push(
      listen<void>("analysis_completed", () => {
        useAppStore.setState({ scanProgress: { currentFile: null, currentPhase: "scanning" } });
      })
    );

    // Lắng nghe logs từ Kilo Server (Rust)
    unlistenFuncs.push(
      listen<string>("kilo_log", async (event) => {
        addKiloLog(event.payload);
      })
    );

    unlistenFuncs.push(
      listen("kilo_task_start", () => {
        useAppStore.getState().actions.setKiloTaskStatus("running");
      })
    );

    unlistenFuncs.push(
      listen("kilo_task_success", async () => {
        const state = useAppStore.getState();
        state.actions.setKiloTaskStatus("success");

        // 1. Bắn thông báo Discord NGAY LẬP TỨC (Không bị block bởi UI Dialog)
        if (state.discordWebhookUrl) {
          const projectName = state.rootPath ? state.rootPath.split(/[/\\]/).pop() : "Dự án";
          try {
            await fetch(state.discordWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `@everyone ✅ **Kilo Agent** đã hoàn thành tác vụ cập nhật mã nguồn trong dự án \`${projectName}\`.\n*🕒 ${new Date().toLocaleString('vi-VN')} | ID: ${Math.random().toString(36).substring(7)}*`,
              }),
            });
          } catch (e) {
            console.error("Lỗi khi gửi Discord webhook:", e);
          }
        }

        // 2. Trigger rescan project ngay lập tức
        if (!state.isScanning) {
          state.actions.rescanProject();
        }

        // 3. Hiển thị Dialog UI CUỐI CÙNG (Vì hàm này sẽ chặn luồng cho đến khi user bấm OK)
        await message(t("Trợ lý Kilo đã hoàn thành nhiệm vụ và cập nhật mã nguồn thành công!"), {
          title: "Kilo Agent",
          kind: "info",
        });
      })
    );

    unlistenFuncs.push(
      listen("kilo_task_error", async () => {
        const state = useAppStore.getState();
        state.actions.setKiloTaskStatus("error");

        if (state.discordWebhookUrl) {
          const projectName = state.rootPath ? state.rootPath.split(/[/\\]/).pop() : "Dự án";
          try {
            await fetch(state.discordWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `@everyone ❌ **Kilo Agent** đã GẶP LỖI trong dự án \`${projectName}\`. Vui lòng kiểm tra log trên ứng dụng.\n*🕒 ${new Date().toLocaleString('vi-VN')} | ID: ${Math.random().toString(36).substring(7)}*`,
              }),
            });
          } catch (e) {
            console.error("Lỗi khi gửi Discord webhook:", e);
          }
        }

        await message(t("Kilo Agent gặp lỗi hoặc đã bị dừng. Vui lòng xem log ở Kilo Panel."), {
          title: "Lỗi Kilo Agent",
          kind: "error",
        });
      })
    );

    unlistenFuncs.push(
      listen<boolean>("kilo_status_changed", (event) => {
        setKiloServerStatus(event.payload);
      })
    );

    // Lắng nghe sự kiện từ Auto-Patch Server
    unlistenFuncs.push(
      listen<string>("patch_log", (event) => {
        addPatchLog(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<import("@/store/types").PatchOpUI>("patch_file_event", (event) => {
        useAppStore.getState().actions.addOrUpdatePatchOperation(event.payload);
      })
    );
    unlistenFuncs.push(
      listen("patch_task_start", () => {
        useAppStore.getState().actions.setPatchTaskStatus("running");
        useAppStore.getState().actions.startNewPatchTask();
      })
    );
    unlistenFuncs.push(
      listen("patch_task_success", async () => {
        const state = useAppStore.getState();
        state.actions.setPatchTaskStatus("success");
        state.actions.updateCurrentPatchTaskStatus("success");

        if (state.discordWebhookUrl) {
          const projectName = state.rootPath ? state.rootPath.split(/[/\\]/).pop() : "Dự án";
          try {
            await fetch(state.discordWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `@everyone 🔧 **Auto-Patch** đã áp dụng thành công mã nguồn trong dự án \`${projectName}\`.\n*🕒 ${new Date().toLocaleString('vi-VN')} | ID: ${Math.random().toString(36).substring(7)}*`,
              }),
            });
          } catch (e) {
            console.error("Lỗi khi gửi Discord webhook:", e);
          }
        }

        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }
        if (permissionGranted) {
          sendNotification({
            title: "Auto-Patch (Thành công)",
            body: "Đã áp dụng các thay đổi mã nguồn!",
          });
        }

        if (!state.isScanning) {
          state.actions.rescanProject();
        }
      })
    );
    unlistenFuncs.push(
      listen("patch_task_error", async () => {
        const state = useAppStore.getState();
        state.actions.setPatchTaskStatus("error");
        state.actions.updateCurrentPatchTaskStatus("error");

        if (state.discordWebhookUrl) {
          const projectName = state.rootPath ? state.rootPath.split(/[/\\]/).pop() : "Dự án";
          try {
            await fetch(state.discordWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `@everyone ❌ **Auto-Patch** đã GẶP LỖI khi áp dụng bản vá trong dự án \`${projectName}\`. Vui lòng kiểm tra màn hình ứng dụng.\n*🕒 ${new Date().toLocaleString('vi-VN')} | ID: ${Math.random().toString(36).substring(7)}*`,
              }),
            });
          } catch (e) {
            console.error("Lỗi khi gửi Discord webhook:", e);
          }
        }

        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }
        if (permissionGranted) {
          sendNotification({
            title: "Auto-Patch (Lỗi)",
            body: "Có lỗi xảy ra khi áp dụng bản vá!",
          });
        }

        await message(t("Auto-Patch báo lỗi hoặc không thể khớp mã nguồn. Vui lòng kiểm tra Patch Panel."), {
          title: "Lỗi Auto-Patch",
          kind: "error",
        });
      })
    );
    unlistenFuncs.push(
      listen<boolean>("patch_status_changed", (event) => {
        setPatchServerStatus(event.payload);
      })
    );

    // Listener cho sự kiện xuất dự án (để hiển thị toast)
    unlistenFuncs.push(
      listen<string>("project_export_complete", async (event) => {
        try {
          const filePath = await save({
            title: t("dialogs.saveProjectContext.title"),
            defaultPath: "project_context.txt",
            filters: [{ name: t("dialogs.filters.text"), extensions: ["txt"] }],
          });
          if (filePath) {
            await writeTextFile(filePath, event.payload);
            await message(t("dialogs.saveSuccess.body"), {
              title: t("common.success"),
              kind: "info",
            });
          }
        } catch (error) {
          console.error("Lỗi khi lưu file ngữ cảnh dự án:", error);
          await message(t("errors.fileSaveFailed"), {
            title: t("common.error"),
            kind: "error",
          });
        }
      })
    );
    unlistenFuncs.push(
      listen<string>("project_export_error", async (event) => {
        const errorKey = `errors.${event.payload}`;
        const translatedError = t(errorKey);
        await message(
          t("errors.projectExportError", {
            error:
              translatedError === errorKey ? event.payload : translatedError,
          }),
          {
            title: t("common.error"),
            kind: "error",
          }
        );
      })
    );

    return () => {
      unlistenFuncs.forEach((unlisten) => {
        unlisten.then((f) => f());
      });
    };
  }, [
    _setScanProgress,
    _setAnalysisProgress,
    _setScanComplete,
    _setScanError,
    throttledSetScanProgress,
    throttledSetAnalysisProgress,
    _setGroupUpdateComplete,
    rescanProject,
    _setRecentPaths,
    t,
    updateAppSettings,
  ]); // <-- Thêm dependency

  const renderContent = () => {
    if (isScanning) {
      return <ScanningScene />;
    }
    if (!selectedPath) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <WelcomeScene />
        </div>
      );
    }

    if (activeScene === "settings") {
      return <SettingsScene />;
    }

    // --- RENDER LAYOUT MỚI ---
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {isSidebarVisible && (
            <>
              <ResizablePanel
                id="project-panel"
                order={1}
                defaultSize={20}
                minSize={20}
                maxSize={35}
              >
                <SidebarPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          {isGitPanelVisible && (
            <>
              <ResizablePanel
                id="git-panel"
                order={2}
                defaultSize={20}
                minSize={20}
                maxSize={35}
              >
                <GitPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          {/* Nếu không có panel nào hiển thị, ẩn handle đi */}
          {!isSidebarVisible && !isGitPanelVisible && (
            <style>{`[data-slot="resizable-handle"] { display: none; }`}</style>
          )}
          <ResizablePanel id="center-container" order={3} defaultSize={40}>
            {(isKiloPanelVisible || isPatchPanelVisible) ? (
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel id="main-panel" order={1} defaultSize={70}>
                  <MainPanel />
                </ResizablePanel>
                {isKiloPanelVisible && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                      id="kilo-panel"
                      order={2}
                      defaultSize={30}
                      minSize={15}
                    >
                      <KiloPanel />
                    </ResizablePanel>
                  </>
                )}
                {isPatchPanelVisible && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                      id="patch-panel"
                      order={3}
                      defaultSize={30}
                      minSize={15}
                    >
                      <PatchPanel />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            ) : (
              <MainPanel />
            )}
          </ResizablePanel>
          {isAiPanelVisible && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="ai-panel"
                order={4}
                defaultSize={20}
                minSize={20}
                maxSize={35}
              >
                <AIPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
        <StatusBar
          stats={projectStats}
          path={selectedPath}
          gitRepoInfo={gitRepoInfo}
          onShowSettings={showSettingsScene}
        />
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {/* <Toaster richColors /> XÓA DÒNG NÀY */}
      {isRescanning && <RescanIndicator />}
      {renderContent()}
    </div>
  );
}

export default App;


================================================
FILE: src/components/AIPanel.tsx
================================================
import { useState, useEffect } from "react";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ChatHistoryList } from "./ChatHistoryList";
import { AIPanelHeader } from "./ai/AIPanelHeader";
import { ChatMessageList } from "./ai/ChatMessageList";
import { AIPromptInput } from "./ai/AIPromptInput";
import { NoApiKeyView } from "./ai/NoApiKeyView";

export function AIPanel() {
  const {
    sendChatMessage,
    createNewChatSession,
    stopAiResponse,
    loadChatSessions,
    loadChatSession,
    setAiChatMode,
    setSelectedAiModel,
    detachItemFromAi,
    attachItemToAi,
  } = useAppActions();
  const {
    chatMessages,
    isAiPanelLoading,
    openRouterApiKey,
    googleApiKey,
    nvidiaApiKey,
    aiModels,
    selectedAiModel,
    aiChatMode,
    activeChatSession,
    aiAttachedFiles,
  } = useAppStore(
    useShallow((state) => ({
      chatMessages: state.chatMessages,
      isAiPanelLoading: state.isAiPanelLoading,
      openRouterApiKey: state.openRouterApiKey,
      googleApiKey: state.googleApiKey,
      nvidiaApiKey: state.nvidiaApiKey,
      aiModels: state.aiModels,
      selectedAiModel: state.selectedAiModel,
      aiChatMode: state.aiChatMode,
      activeChatSession: state.activeChatSession,
      aiAttachedFiles: state.aiAttachedFiles,
    }))
  );
  const editingMessageIndex = useAppStore((state) => state.editingMessageIndex);

  const [prompt, setPrompt] = useState("");
  const [view, setView] = useState<"chat" | "history">("chat");

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  const handleSend = () => {
    if (prompt.trim()) {
      sendChatMessage(prompt.trim());
      setPrompt("");
    }
  };

  const handleStartEdit = (index: number) => {
    const messageToEdit = chatMessages[index];
    if (messageToEdit && messageToEdit.role === "user") {
      // Clear any currently attached files before loading the old ones
      useAppStore.getState().actions.clearAttachedFilesFromAi();

      setPrompt(messageToEdit.content || "");
      useAppStore.setState({ editingMessageIndex: index });

      // Load attachments from the message being edited
      messageToEdit.attachedFiles?.forEach((item) => attachItemToAi(item));
    }
  };

  const handleCancelEdit = () => {
    useAppStore.setState({ editingMessageIndex: null });
    setPrompt(""); // Clear the input when cancelling edit
    useAppStore.getState().actions.clearAttachedFilesFromAi();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isAiPanelLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderChatView = () => {
    const provider = aiModels.find((m) => m.id === selectedAiModel)?.provider || "openrouter";
    const hasKey = 
      (provider === "openrouter" && openRouterApiKey) ||
      (provider === "google" && googleApiKey) ||
      (provider === "nvidia" && nvidiaApiKey);

    if (!hasKey) {
      return <NoApiKeyView />;
    }

    return (
      <>
        <ChatMessageList
          chatMessages={chatMessages}
          isAiPanelLoading={isAiPanelLoading}
          editingMessageIndex={editingMessageIndex}
          onStartEdit={handleStartEdit}
        />
        <AIPromptInput
          prompt={prompt}
          setPrompt={setPrompt}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          onStop={stopAiResponse}
          isLoading={isAiPanelLoading}
          attachedFiles={aiAttachedFiles}
          onDetachFile={detachItemFromAi}
          chatMode={aiChatMode}
          setChatMode={setAiChatMode}
          models={aiModels}
          selectedModel={selectedAiModel}
          setSelectedModel={setSelectedAiModel}
          isEditing={editingMessageIndex !== null}
          onCancelEdit={handleCancelEdit}
        />
      </>
    );
  };

  const handleNewChat = () => {
    if (isAiPanelLoading) {
      stopAiResponse();
    }
    createNewChatSession();
    setView("chat");
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <AIPanelHeader
        view={view}
        setView={setView}
        activeChatSession={activeChatSession}
        onNewChat={handleNewChat}
      />

      {view === "chat" ? (
        renderChatView()
      ) : (
        <ChatHistoryList
          onSelectSession={(id) => {
            if (isAiPanelLoading) {
              stopAiResponse();
            }
            loadChatSession(id);
            setView("chat");
          }}
        />
      )}
    </div>
  );
}


================================================
FILE: src/components/ChatHistoryList.tsx
================================================
// src/components/ChatHistoryList.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "./ui/input";

interface ChatHistoryListProps {
  onSelectSession: (sessionId: string) => void;
}

export function ChatHistoryList({ onSelectSession }: ChatHistoryListProps) {
  const { t } = useTranslation();
  const { deleteChatSession, updateChatSessionTitle } = useAppActions();
  const { chatSessions, activeChatSessionId } = useAppStore(
    useShallow((state) => ({
      chatSessions: state.chatSessions,
      activeChatSessionId: state.activeChatSessionId,
    }))
  );

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );

  const handleStartEdit = (session: { id: string; title: string }) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleConfirmEdit = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateChatSessionTitle(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirmEdit();
    } else if (e.key === "Escape") {
      setEditingSessionId(null);
      setEditingTitle("");
    }
  };

  const handleConfirmDelete = () => {
    if (deletingSessionId) {
      deleteChatSession(deletingSessionId);
    }
    setDeletingSessionId(null);
  };

  return (
    <>
      <ScrollArea className="flex-1 p-2 min-h-0">
        <div className="space-y-1">
          {chatSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center justify-between p-2 rounded-md cursor-pointer",
                activeChatSessionId === session.id
                  ? "bg-primary/10"
                  : "hover:bg-accent"
              )}
              onClick={() =>
                editingSessionId !== session.id && onSelectSession(session.id)
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="h-4 w-4 shrink-0" />
                {editingSessionId === session.id ? (
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleConfirmEdit}
                    autoFocus
                    className="h-7 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate max-w-[140px] text-sm">
                    {session.title}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "flex items-center opacity-0 group-hover:opacity-100",
                  editingSessionId === session.id && "opacity-100"
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(session);
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingSessionId(session.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <AlertDialog
        open={!!deletingSessionId}
        onOpenChange={(open) => !open && setDeletingSessionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiPanel.deleteChatDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiPanel.deleteChatDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


================================================
FILE: src/components/ai/AIPanelHeader.tsx
================================================
// src/components/ai/AIPanelHeader.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, History, X, BrainCircuit, Coins, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { type AIChatSession } from "@/store/types";
import { useAppStore, useAppActions } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";

interface AIPanelHeaderProps {
  view: "chat" | "history";
  setView: (view: "chat" | "history") => void;
  activeChatSession: AIChatSession | null;
  onNewChat: () => void;
}

export function AIPanelHeader({
  view,
  setView,
  activeChatSession,
  onNewChat,
}: AIPanelHeaderProps) {
  const { t } = useTranslation();
  const { deleteAllChatSessions } = useAppActions();
  const { aiModels, selectedAiModel, chatSessions } = useAppStore(
    useShallow((s) => ({
      aiModels: s.allAvailableModels, // Use all models to find details
      selectedAiModel: s.selectedAiModel,
      chatSessions: s.chatSessions,
    }))
  );
  const selectedModelDetails = aiModels.find((m) => m.id === selectedAiModel);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

  const handleConfirmClearAll = () => deleteAllChatSessions();

  const handleNewChat = () => onNewChat();

  const handleViewHistory = () => setView("history");

  return (
    <header className="flex items-center p-4 pl-5 border-b shrink-0 gap-4">
      <div className="flex-1 min-w-0">
        <h1
          className="text-xl font-bold truncate"
          title={view === "chat" ? activeChatSession?.title : ""}
        >
          {view === "history"
            ? t("aiPanel.history")
            : activeChatSession?.title || t("aiPanel.title")}
        </h1>
        {view === "chat" && activeChatSession && (
          <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
            {activeChatSession.totalTokens != null &&
              selectedModelDetails?.context_length != null && (
                <div
                  className={cn(
                    "flex items-center gap-1.5",
                    selectedModelDetails.context_length > 0 &&
                      activeChatSession.totalTokens /
                        selectedModelDetails.context_length >
                        0.9 &&
                      "text-destructive",
                    selectedModelDetails.context_length > 0 &&
                      activeChatSession.totalTokens /
                        selectedModelDetails.context_length >
                        0.75 &&
                      activeChatSession.totalTokens /
                        selectedModelDetails.context_length <=
                        0.9 &&
                      "text-yellow-500"
                  )}
                  title={t("aiPanel.sessionTokensTooltip")}
                >
                  <BrainCircuit className="h-3 w-3" />
                  <span>
                    {activeChatSession.totalTokens.toLocaleString()} /{" "}
                    {selectedModelDetails.context_length.toLocaleString()}
                  </span>
                </div>
              )}
            {activeChatSession.totalCost != null &&
              activeChatSession.totalCost > 0 && (
                <div
                  className="flex items-center gap-1.5"
                  title="Total Session Cost"
                >
                  <Coins className="h-3 w-3" />
                  <span>${activeChatSession.totalCost.toFixed(6)}</span>
                </div>
              )}
          </div>
        )}
      </div>
      <Badge variant="outline" className="border-yellow-500 text-yellow-500">
        Beta
      </Badge>
      <div className="flex items-center gap-2">
        {view === "chat" ? (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={handleNewChat}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("aiPanel.newChat")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={"outline"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={handleViewHistory}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("aiPanel.viewHistory")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <AlertDialog
              open={isClearAllDialogOpen}
              onOpenChange={setIsClearAllDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-9 w-9"
                  disabled={chatSessions.length === 0}
                  title={t("aiPanel.clearAllHistory")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("aiPanel.clearAllDialog.title")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("aiPanel.clearAllDialog.description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmClearAll}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {t("common.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setView("chat")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}


================================================
FILE: src/components/ai/AIPromptInput.tsx
================================================
// src/components/ai/AIPromptInput.tsx
import { useTranslation } from "react-i18next";
import {
  Send,
  X,
  Square,
  AlignJustify,
  HelpCircle,
  Link as LinkIcon,
  FileDiff,
  Folder,
  FileText,
  ListChecks,
  XCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/utils";
import { type AIModel, type AttachedItem } from "@/store/types";

interface AIPromptInputProps {
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  isLoading: boolean;
  attachedFiles: AttachedItem[];
  onDetachFile: (itemId: string) => void;
  chatMode: "ask" | "context" | "mc";
  setChatMode: (mode: "ask" | "context" | "mc") => void;
  models: AIModel[];
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  isEditing: boolean;
  onCancelEdit: () => void;
}

export function AIPromptInput({
  prompt,
  setPrompt,
  onSend,
  onKeyDown,
  onStop,
  isLoading,
  attachedFiles,
  onDetachFile,
  chatMode,
  setChatMode,
  models,
  selectedModel,
  setSelectedModel,
  isEditing,
  onCancelEdit,
}: AIPromptInputProps) {
  const { t } = useTranslation();
  const selectedModelDetails = models.find(
    (m) => m.id === (selectedModel || models[0]?.id)
  );

  return (
    <div className="p-4 border-t">
      {isEditing && (
        <div className="flex items-center justify-between px-1 pb-2 text-xs text-amber-700 dark:text-amber-500">
          <span>{t("aiPanel.editingMode")}</span>
        </div>
      )}
      <div className="relative">
        <div className="flex flex-col min-h-[80px] max-h-48 w-full rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden">
          {attachedFiles.length > 0 && (
            <div className="flex-shrink-0 px-3 py-2 text-xs text-muted-foreground border-b bg-muted/50">
              <ScrollArea className="max-h-16 custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((item) => (
                    <Badge
                      key={item.id}
                      variant="secondary"
                      className="pl-2 pr-1"
                    >
                      {item.type === "file" && (
                        <FileText className="h-3 w-3 mr-1.5" />
                      )}
                      {item.type === "folder" && (
                        <Folder className="h-3 w-3 mr-1.5" />
                      )}
                      {item.type === "group" && (
                        <ListChecks className="h-3 w-3 mr-1.5" />
                      )}
                      {item.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-1 h-4 w-4 rounded-full"
                        onClick={() => onDetachFile(item.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          <Textarea
            placeholder={t("aiPanel.placeholder")}
            className="flex-1 w-full !rounded-none resize-none border-none bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 custom-scrollbar pr-10"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="flex-shrink-0 flex h-12 items-center justify-between px-3 pt-1">
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 gap-2 px-2 text-muted-foreground"
                  >
                    {chatMode === "ask" ? (
                      <HelpCircle className="h-4 w-4 shrink-0" />
                    ) : chatMode === "context" ? (
                      <LinkIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileDiff className="h-4 w-4 shrink-0" />
                    )}
                    <span className="capitalize text-xs font-medium">
                      {t(`aiPanel.modes.${chatMode}`)}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[180px]">
                  <DropdownMenuRadioGroup
                    value={chatMode}
                    onValueChange={(value) =>
                      setChatMode(value as "ask" | "context" | "mc")
                    }
                  >
                    <DropdownMenuRadioItem value="ask">
                      {t("aiPanel.modes.ask")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="context">
                      {t("aiPanel.modes.context")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="mc">
                      {t("aiPanel.modes.mc")}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {models.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-8 gap-2 px-2 text-muted-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <AlignJustify className="h-4 w-4 shrink-0" />
                        <span className="truncate max-w-[100px] text-xs font-medium">
                          {selectedModelDetails?.name.split(":").pop() || "..."}
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[350px]">
                    <DropdownMenuRadioGroup
                      value={selectedModel || models[0]?.id}
                      onValueChange={setSelectedModel}
                    >
                      {models.map((model) => (
                        <DropdownMenuRadioItem
                          key={`${model.provider}-${model.id}`}
                          value={model.id}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  model.provider === "google"
                                    ? "font-semibold text-blue-600 dark:text-blue-400"
                                    : model.provider === "nvidia"
                                    ? "font-semibold text-green-600 dark:text-green-400"
                                    : ""
                                }
                              >
                                {model.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {model.provider}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                              {model.provider === "openrouter" ? (
                                <>
                                  <span>
                                    {model.context_length?.toLocaleString()} ctx
                                  </span>
                                  <span>
                                    In: {formatPrice(model.pricing.prompt)}/M
                                  </span>
                                  <span>
                                    Out: {formatPrice(model.pricing.completion)}
                                    /M
                                  </span>
                                </>
                              ) : (
                                <span>
                                  {model.context_length?.toLocaleString()}{" "}
                                  context
                                </span>
                              )}
                            </div>
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Button
              variant={isLoading ? "destructive" : "default"}
              size="icon"
              className="h-8 w-8"
              onClick={isLoading ? onStop : onSend}
              disabled={!isLoading && !prompt.trim()}
            >
              {isLoading ? (
                <Square className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 rounded-full"
            onClick={onCancelEdit}
            title={t("aiPanel.cancelEdit")}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}


================================================
FILE: src/components/ai/ChatMessage.tsx
================================================
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import {
  CheckCircle2,
  FileText,
  Folder,
  ListChecks,
  Loader2,
  Scissors,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Brain,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileEdit,
  Terminal,
  Pencil,
  Search,
  Files,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type ChatMessage as ChatMessageType } from "@/store/types";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  message: ChatMessageType;
  index: number;
  onRegenerate: (index: number) => void; // This will now trigger a dialog if needed
  isAiPanelLoading: boolean;
  isLastAssistantMessageInTurn: boolean;
  editingMessageIndex: number | null;
  onStartEdit: (index: number) => void;
}

export function ChatMessage({
  message,
  index,
  onRegenerate,
  isAiPanelLoading,
  isLastAssistantMessageInTurn,
  editingMessageIndex,
  onStartEdit,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const [showThoughts, setShowThoughts] = useState(false);

  if (message.hidden) {
    return null;
  }

  const renderToolCall = (
    tool: NonNullable<ChatMessageType["tool_calls"]>[0]
  ) => {
    let toolContent: React.ReactNode;
    let ToolIcon: React.ElementType | null = null;
    const isPending = tool.status === "pending";
    const isError = tool.status === "error";
    // "success" or "partial" will fall to success key if not pending and not error
    const getStatusKey = () => isPending ? "pending" : (isError ? "error" : "success");
    const statusKey = getStatusKey();

    switch (tool.function.name) {
      case "get_project_file_tree":
        toolContent = (
          <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
            {t(`aiPanel.toolCall.listingFiles.${statusKey}`)}
          </p>
        );
        break;

      case "read_file":
        ToolIcon = FileText;
        try {
          const args = JSON.parse(tool.function.arguments);
          const filesToRead: any[] = args.files_to_read || (args.file_path ? [args] : []);
          
          if (filesToRead.length === 1) {
            const f = filesToRead[0];
            const fileName = f.file_path?.split("/").pop() || "unknown";
            toolContent = (
              <div className="w-full">
                <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
                  {t(`aiPanel.toolCall.read.${statusKey}`)} <code className="ml-1 text-xs text-muted-foreground">{fileName}</code>
                </p>
              </div>
            );
          } else {
            toolContent = (
              <div className="w-full">
                <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
                  {t(`aiPanel.toolCall.readingFile.${statusKey}`)} ({filesToRead.length})
                </p>
                {filesToRead.length > 0 && (
                  <pre className="mt-2 bg-muted/30 dark:bg-muted/20 p-2 rounded-md text-xs font-mono max-h-40 overflow-auto custom-scrollbar">
                    <code>
                      {filesToRead.map((f, idx) => {
                        const fileName = f.file_path?.split("/").pop() || "unknown";
                        let lineInfo = "";
                        if (f.start_line && f.end_line) lineInfo = `(${f.start_line}-${f.end_line})`;
                        else if (f.start_line) lineInfo = `(${f.start_line}-...)`;
                        else if (f.end_line) lineInfo = `(...-${f.end_line})`;

                        const detail = tool.detailed_results?.[idx];
                        return (
                          <div
                            key={`read-${idx}`}
                            className="text-blue-600 dark:text-blue-400 whitespace-pre-wrap flex items-baseline gap-1.5"
                          >
                            <span className="select-none text-muted-foreground">
                              {detail?.status === 'error' ? <XCircle className="h-3 w-3 text-destructive inline" /> : <CheckCircle2 className="h-3 w-3 text-green-500 inline" />}
                            </span>
                            <span title={f.file_path} className={cn(detail?.status === 'error' && "text-destructive line-through")}>{fileName}</span>
                            {lineInfo && <span className="text-muted-foreground text-[10px]">{lineInfo}</span>}
                          </div>
                        );
                      })}
                    </code>
                  </pre>
                )}
              </div>
            );
          }
        } catch (e) {
          toolContent = <p className={cn(isError && "text-destructive font-medium")}>{t(`aiPanel.toolCall.readFallback.${statusKey}`)}</p>;
        }
        break;

      case "get_current_context_group_files":
        toolContent = (
          <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
            {t(`aiPanel.toolCall.listingGroupFiles.${statusKey}`)}
          </p>
        );
        break;

      case "modify_context_group":
        try {
          const args = JSON.parse(tool.function.arguments);
          const filesToAdd: string[] = args.files_to_add || [];
          const filesToRemove: string[] = args.files_to_remove || [];

          toolContent = (
            <div className="w-full">
              <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
                {t(`aiPanel.toolCall.modifiedGroup.${statusKey}`)}
              </p>
              {filesToAdd.length > 0 || filesToRemove.length > 0 ? (
                <pre className="mt-2 bg-muted/30 dark:bg-muted/20 p-2 rounded-md text-xs font-mono max-h-40 overflow-auto custom-scrollbar">
                  <code>
                    {filesToAdd.map((file) => (
                      <div
                        key={`add-${file}`}
                        className="text-green-600 dark:text-green-500 whitespace-pre-wrap"
                      >
                        <span className="select-none">+ </span>
                        {file}
                      </div>
                    ))}
                    {filesToRemove.map((file) => (
                      <div
                        key={`remove-${file}`}
                        className="text-red-600 dark:text-red-500 whitespace-pre-wrap"
                      >
                        <span className="select-none">- </span>
                        {file}
                      </div>
                    ))}
                  </code>
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic mt-1">
                  No files were added or removed.
                </p>
              )}
            </div>
          );
        } catch (e) {
          toolContent = (
            <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
              {t(`aiPanel.toolCall.modifiedGroup.${statusKey}`)}
            </p>
          );
        }
        break;

      case "add_exclusion_range_to_file":
        ToolIcon = Scissors;
        try {
          const args = JSON.parse(tool.function.arguments);
          const filePath = args.file_path ?? "unknown file";
          const fileName = filePath.split("/").pop() ?? filePath;
          const lineInfo = `${args.start_line}-${args.end_line}`;

          toolContent = (
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "font-medium",
                  isError ? "text-destructive" : "text-foreground"
                )}
              >
                {t(`aiPanel.toolCall.addedExclusion.${statusKey}`)}
              </span>
              <code className="font-medium" title={filePath}>
                {fileName}
              </code>
              <span className="text-xs text-muted-foreground">
                ({lineInfo})
              </span>
            </div>
          );
        } catch (e) {
          toolContent = <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{t(`aiPanel.toolCall.addedExclusion.${statusKey}`)}</p>;
        }
        break;

      case "get_dummy_project_context":
        ToolIcon = Brain;
        toolContent = (
          <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
            {t(`aiPanel.toolCall.gettingDummyContext.${statusKey}`)}
          </p>
        );
        break;

      case "create_context_group":
        ToolIcon = Folder;
        try {
          const args = JSON.parse(tool.function.arguments);
          toolContent = (
            <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
              {t(`aiPanel.toolCall.creatingGroup.${statusKey}`)} <code className="ml-1 px-1.5 py-0.5 bg-background rounded-md text-xs">{args.name}</code>
            </p>
          );
        } catch (e) {
          toolContent = <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{t(`aiPanel.toolCall.creatingGroupFallback.${statusKey}`)}</p>;
        }
        break;

      case "bash":
        ToolIcon = Terminal;
        try {
          const args = JSON.parse(tool.function.arguments);
          toolContent = (
            <div className="w-full flex flex-col gap-1.5">
              <p className={cn("font-medium flex items-center gap-2", isError ? "text-destructive" : "text-foreground")}>
                {t(`aiPanel.toolCall.bash.${statusKey}`)} <code className="text-xs text-muted-foreground truncate max-w-[300px]">{args.command}</code>
              </p>
              {tool.result && (
                <details className="group/details mt-1">
                  <summary className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer select-none list-none flex items-center gap-1 w-fit">
                    <ChevronRight className="h-3 w-3 transition-transform group-open/details:rotate-90" />
                    {t("aiPanel.viewDetails")}
                  </summary>
                  <pre className="mt-1.5 bg-muted/50 border border-border/50 p-2 rounded-md text-[11px] font-mono max-h-60 overflow-auto custom-scrollbar whitespace-pre-wrap text-foreground/80">
                    {tool.result}
                  </pre>
                </details>
              )}
            </div>
          );
        } catch (e) {
          toolContent = <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{t(`aiPanel.toolCall.bashFallback.${statusKey}`)}</p>;
        }
        break;

      case "read":
        ToolIcon = FileText;
        try {
          const args = JSON.parse(tool.function.arguments);
          const filePath = args.file_path ?? "unknown";
          toolContent = (
            <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
              {t(`aiPanel.toolCall.read.${statusKey}`)} <code className="ml-1 text-xs text-muted-foreground">{filePath}</code>
            </p>
          );
        } catch (e) {
          toolContent = <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{t(`aiPanel.toolCall.readFallback.${statusKey}`)}</p>;
        }
        break;

      case "write":
        ToolIcon = FileEdit;
        try {
          const args = JSON.parse(tool.function.arguments);
          toolContent = (
            <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
              {t(`aiPanel.toolCall.write.${statusKey}`)} <code className="ml-1 text-xs text-muted-foreground">{args.file_path}</code>
            </p>
          );
        } catch (e) {
          toolContent = <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{t(`aiPanel.toolCall.writeFallback.${statusKey}`)}</p>;
        }
        break;

      case "edit":
        ToolIcon = Pencil;
        try {
          const args = JSON.parse(tool.function.arguments);
          toolContent = (
            <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
              {t(`aiPanel.toolCall.edit.${statusKey}`)} <code className="ml-1 text-xs text-muted-foreground">{args.file_path}</code>
            </p>
          );
        } catch (e) {
          toolContent = <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{t(`aiPanel.toolCall.editFallback.${statusKey}`)}</p>;
        }
        break;

      case "glob":
        ToolIcon = Files;
        try {
          const args = JSON.parse(tool.function.arguments);
          toolContent = (
            <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
              {t(`aiPanel.toolCall.glob.${statusKey}`)} <code className="ml-1 text-xs text-muted-foreground">{args.pattern}</code>
            </p>
          );
        } catch (e) {
          toolContent = <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{t(`aiPanel.toolCall.globFallback.${statusKey}`)}</p>;
        }
        break;

      case "grep":
        ToolIcon = Search;
        try {
          const args = JSON.parse(tool.function.arguments);
          toolContent = (
            <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
              {t(`aiPanel.toolCall.grep.${statusKey}`)} <code className="ml-1 text-xs text-muted-foreground truncate max-w-[200px] inline-block align-bottom">{args.pattern}</code>
            </p>
          );
        } catch (e) {
          toolContent = <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>{t(`aiPanel.toolCall.grepFallback.${statusKey}`)}</p>;
        }
        break;

      default:
        toolContent = <p>{tool.function.name}</p>;
        break;
    }

    return (
      <div
        key={tool.id}
        className="flex text-sm bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full flex-row items-start gap-2.5"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          {tool.status === "error" ? (
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : tool.status === "partial" ? (
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          ) : tool.status === "pending" ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
          )}
          {ToolIcon && (
            <ToolIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
        </div>
        <div className="flex-1 w-full min-w-0">
          {toolContent}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "group flex w-full items-start gap-2 min-w-0",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex flex-col",
          message.role === "user" ? "items-end" : "items-start",
          "transition-all"
        )}
      >
        <div
          className={cn(
            message.role === "assistant" && message.tool_calls && message.tool_calls.length > 0
              ? "max-w-full lg:max-w-3xl w-full"
              : "max-w-xs md:max-w-md lg:max-w-lg",
            "text-sm rounded-lg",
            editingMessageIndex === index &&
              "ring-2 ring-primary ring-offset-2 ring-offset-background",
            message.role === "user" && !message.hidden && "cursor-pointer",
            message.role === "user"
              ? "bg-muted px-3 py-2 group-hover:bg-accent"
              : ""
          )}
          onClick={
            message.role === "user" && !message.hidden
              ? () => onStartEdit(index)
              : undefined
          }
        >
          {message.role === "user" ? (
            <div className="flex flex-col gap-2 w-full min-w-0 max-w-full">
              {message.attachedFiles && message.attachedFiles.length > 0 && (
                <div className="border-b border-background/50 pb-2">
                  <div className="flex flex-wrap gap-1.5">
                    {message.attachedFiles.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-md bg-background/50"
                      >
                        {item.type === "file" && (
                          <FileText className="h-3 w-3" />
                        )}
                        {item.type === "folder" && (
                          <Folder className="h-3 w-3" />
                        )}
                        {item.type === "group" && (
                          <ListChecks className="h-3 w-3" />
                        )}
                        {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="markdown-content w-full min-w-0 max-w-full overflow-x-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {message.content || ""}
                </ReactMarkdown>
              </div>
            </div>
          ) : message.role === "assistant" && message.tool_calls ? (
            <div className="space-y-2 w-full min-w-0 max-w-full">
              {message.tool_calls.map(renderToolCall)}
            </div>
          ) : (
            <div className="flex flex-col w-full min-w-0 max-w-full">
              {message.role === "assistant" && message.thoughts && (
                <div className="mb-3 rounded-md border border-border/50 bg-muted/20 overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between p-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => setShowThoughts(!showThoughts)}
                  >
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      <span className="uppercase tracking-wider">{t("aiPanel.thinking")}</span>
                    </div>
                    {showThoughts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showThoughts && (
                    <div className="p-3 pt-0 text-sm text-muted-foreground border-t border-border/50 markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.thoughts}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
              <div className="markdown-content w-full min-w-0 max-w-full overflow-x-auto">
                {message.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {message.content || ""}
                  </ReactMarkdown>
                ) : null}
              </div>
            </div>
          )}
        </div>
        {message.role === "assistant" &&
          !isAiPanelLoading &&
          isLastAssistantMessageInTurn && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 mt-1"
              onClick={() => onRegenerate(index)}
              title={t("aiPanel.regenerate")}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
      </div>
    </div>
  );
}

export function LoadingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-start gap-2 text-muted-foreground italic text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      <p>{t("aiPanel.responding")}</p>
    </div>
  );
}


================================================
FILE: src/components/ai/ChatMessageList.tsx
================================================
// src/components/ai/ChatMessageList.tsx
import { useRef, useEffect, useState } from "react";
import { ArrowDownCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage, LoadingIndicator } from "./ChatMessage";
import { type ChatMessage as ChatMessageType } from "@/store/types";
import { cn } from "@/lib/utils";
import { useAppActions } from "@/store/appStore";

interface ChatMessageListProps {
  chatMessages: ChatMessageType[];
  isAiPanelLoading: boolean;
  editingMessageIndex: number | null;
  onStartEdit: (index: number) => void;
}

export function ChatMessageList({
  chatMessages,
  isAiPanelLoading,
  editingMessageIndex,
  onStartEdit,
}: ChatMessageListProps) {
  const { regenerateResponse } = useAppActions();
  const viewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Recalculate scroll button visibility
  const updateScrollButtonVisibility = () => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setShowScrollButton(false);
      return;
    }
    const isScrollable = viewport.scrollHeight > viewport.clientHeight + 1; // +1 for tolerance
    const isNearBottom =
      viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 10;

    setShowScrollButton(isScrollable && !isNearBottom);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Only auto-scroll if the user is already near the bottom
    const isScrolledToBottom =
      viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 100; // 100px threshold

    if (isScrolledToBottom) {
      scrollToBottom("smooth");
    }
  }, [chatMessages, isAiPanelLoading]); // Rerun when messages or loading state changes

  const handleScroll = () => {
    updateScrollButtonVisibility();
  };

  // Effect to re-evaluate scroll button when messages change (e.g., after revert/edit)
  useEffect(() => {
    updateScrollButtonVisibility();
  }, [chatMessages]);

  const handleRegenerate = (index: number) => {
    regenerateResponse(index);
  };

  // Find the index of the last assistant message for EACH turn.
  // A "turn" consists of a user message followed by one or more assistant messages.
  const lastAssistantMessageIndices = new Set<number>();
  for (let i = 0; i < chatMessages.length; i++) {
    // If the current message is from the user, look ahead for the last assistant message before the next user message.
    if (chatMessages[i].role === "user" && !chatMessages[i].hidden) {
      let lastAsstInTurn = -1;
      for (let j = i + 1; j < chatMessages.length; j++) {
        if (chatMessages[j].role === "assistant") {
          lastAsstInTurn = j;
        } else if (chatMessages[j].role === "user" && !chatMessages[j].hidden) {
          // Found the next user message, so the turn ends here.
          break;
        }
      }
      if (lastAsstInTurn !== -1) {
        lastAssistantMessageIndices.add(lastAsstInTurn);
      }
    }
  }

  return (
    <ScrollArea
      className="flex-1 p-4 min-h-0 relative" // Add relative positioning here
      viewportRef={viewportRef}
      onScroll={handleScroll}
    >
      <div className="space-y-4">
        {chatMessages.map((msg, index) =>
          msg.hidden ? null : (
            <ChatMessage
              key={index}
              message={msg}
              index={index}
              onRegenerate={handleRegenerate}
              isAiPanelLoading={isAiPanelLoading}
              isLastAssistantMessageInTurn={lastAssistantMessageIndices.has(
                index
              )}
              editingMessageIndex={editingMessageIndex}
              onStartEdit={onStartEdit}
            />
          )
        )}
        {isAiPanelLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "absolute bottom-2 right-2 z-10 rounded-full h-10 w-10 transition-opacity duration-300", // Positioned relative to the ScrollArea
          showScrollButton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => scrollToBottom()}
      >
        <ArrowDownCircle className="h-5 w-5" />
      </Button>
    </ScrollArea>
  );
}


================================================
FILE: src/components/ai/NoApiKeyView.tsx
================================================
// src/components/ai/NoApiKeyView.tsx
import { useTranslation } from "react-i18next";

export function NoApiKeyView() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <p className="text-muted-foreground">{t("aiPanel.noApiKey")}</p>
    </div>
  );
}


================================================
FILE: src/hooks/useSubAgentListener.ts
================================================
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { useAppStore } from "@/store/appStore";

const normalize = (s: string) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const cleanTrailing = (s: string) => s.split('\n').map(line => line.trimEnd()).join('\n');

export function useSubAgentListener() {
  useEffect(() => {
    const unlistenPromise = listen<{ id: string; file: string; fileContent: string; failedSearch: string; failedReplace: string }>(
      "patch_needs_fix",
      async (event) => {
        const { id, file, fileContent, failedSearch, failedReplace } = event.payload;
        const state = useAppStore.getState();
        const { addPatchLog, addSubAgentLogToOperation } = state.actions;

        const logUI = (msg: string) => {
          addPatchLog(`[SUB-AGENT 🤖] ${msg}`);
          addSubAgentLogToOperation(id, msg);
        };

        if (!state.subAgentEnabled) {
          logUI(`⚠️ Tính năng Sub-Agent đã bị tắt trong Cài đặt. Bỏ qua block lỗi tại file: ${file}`);
          await invoke("submit_patch_fix", { search: null, replace: null });
          return;
        }

        try {
          const { openRouterApiKey, googleApiKey, nvidiaApiKey, subAgentModel, selectedAiModel, allAvailableModels, subAgentMaxRetries } = state;
          const targetModelId = subAgentModel || selectedAiModel;
          const model = allAvailableModels.find((m) => m.id === targetModelId);

          if (!model) throw new Error("Không có Model AI nào được cấu hình để Sub-Agent chạy.");

          const actualApiKey =
            model.provider === "google"
              ? googleApiKey
              : model.provider === "nvidia"
              ? nvidiaApiKey
              : openRouterApiKey;

          if (!actualApiKey) throw new Error("Chưa cung cấp API Key cho Sub-Agent.");

          logUI(`Khởi động Sub-Agent (${model.name})...`);

          let attempt = 0;
          let success = false;
          let chatHistory: any[] = [];

          const initialPrompt = `You are a strict, autonomous code-fixing agent.
I tried to apply a SEARCH/REPLACE block to a file, but the SEARCH block did not exactly match the file's current content (indentation or minor changes might exist).

FILE CONTENT:
\`\`\`
${fileContent}
\`\`\`

FAILED SEARCH BLOCK:
\`\`\`
${failedSearch}
\`\`\`

INTENDED REPLACE BLOCK:
\`\`\`
${failedReplace}
\`\`\`

YOUR TASK:
1. Locate the correct lines in the FILE CONTENT that correspond to the FAILED SEARCH BLOCK.
2. Output a NEW, perfectly matching SEARCH/REPLACE block that contains the exact lines from the FILE CONTENT in the SEARCH section, and the updated lines in the REPLACE section.
3. Output ONLY the block. Do not add any markdown formatting, no explanations, no yapping.

FORMAT REQUIRED:
<<<<<<< SEARCH
[exact matching lines from file]
=======
[new replaced lines]
>>>>>>> REPLACE`;

          chatHistory.push({ role: "user", content: initialPrompt });

          while (attempt < subAgentMaxRetries && !success) {
            attempt++;
            logUI(`Đang phân tích và sửa mã nguồn (Lần thử ${attempt}/${subAgentMaxRetries})...`);

            let fixResult = "";

            if (model.provider === "google") {
              const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`;
              const response = await tauriFetch(endpoint, {
                method: "POST",
                headers: {
                  "x-goog-api-key": actualApiKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  contents: chatHistory.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })),
                  generationConfig: { temperature: 0.1 },
                }),
              });
              const data = await response.json();
              fixResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
              const endpoint =
                model.provider === "nvidia"
                  ? "https://integrate.api.nvidia.com/v1/chat/completions"
                  : "https://openrouter.ai/api/v1/chat/completions";
              const response = await tauriFetch(endpoint, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${actualApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: model.id,
                  messages: chatHistory,
                  temperature: 0.1,
                }),
              });
              const data = await response.json();
              fixResult = data.choices?.[0]?.message?.content || "";
            }

            chatHistory.push({ role: "assistant", content: fixResult });

            const cleanResult = fixResult.replace(/```[a-z]*\n/g, "").replace(/```/g, "");
            const searchMatch = cleanResult.match(/<<<<<<< SEARCH[\r\n]+([\s\S]*?)[\r\n]+=======/);
            const replaceMatch = cleanResult.match(/=======[\r\n]+([\s\S]*?)[\r\n]+>>>>>>> REPLACE/);

            if (searchMatch && replaceMatch) {
              const proposedSearch = searchMatch[1];
              const proposedReplace = replaceMatch[1];

              const cleanFileContent = cleanTrailing(normalize(fileContent));
              const cleanProposedSearch = cleanTrailing(normalize(proposedSearch));

              if (cleanFileContent.includes(cleanProposedSearch)) {
                success = true;
                logUI(`✅ Vá lỗi thành công! Cập nhật mã nguồn...`);
                await invoke("submit_patch_fix", {
                  search: proposedSearch,
                  replace: proposedReplace,
                });
                return;
              } else {
                logUI(`❌ Lần thử ${attempt} thất bại: Mã nguồn thay thế vẫn chưa khớp.`);
                chatHistory.push({ role: "user", content: "Your proposed SEARCH block STILL does not exactly match the FILE CONTENT. Please try again. Pay extremely close attention to indentation, blank lines, and brackets. Output ONLY the strict SEARCH/REPLACE block." });
              }
            } else {
              logUI(`❌ Lần thử ${attempt} thất bại: AI trả về sai cấu trúc format.`);
              chatHistory.push({ role: "user", content: "You did not output the proper <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE format. Try again and output ONLY the block." });
            }
          }

          if (!success) {
            logUI(`🚨 Đã thử tối đa (${subAgentMaxRetries} lần). Bỏ qua block này.`);
          }
          await invoke("submit_patch_fix", { search: null, replace: null });

        } catch (e) {
          console.error("Sub-Agent Error:", e);
          logUI(`🚨 Lỗi cấu hình / Gọi API Sub-Agent: ${String(e)}`);
          await invoke("submit_patch_fix", { search: null, replace: null });
        }
      }
    );

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, []);
}


================================================
FILE: src/scenes/MainPanel.tsx
================================================
// src/scenes/MainPanel.tsx
import { useAppStore } from "@/store/appStore";
import { useTranslation } from "react-i18next";
import { GroupEditorPanel } from "./GroupEditorPanel";
import { EditorPanel } from "@/components/EditorPanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { LayoutGrid, ListChecks, FileCode } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function MainPanel() {
  const { t } = useTranslation();
  const {
    editingGroupId,
    activeEditorFile,
    isEditorPanelVisible,
    isGroupEditorPanelVisible,
  } = useAppStore(
    useShallow((state) => ({
      editingGroupId: state.editingGroupId,
      activeEditorFile: state.activeEditorFile,
      isEditorPanelVisible: state.isEditorPanelVisible,
      isGroupEditorPanelVisible: state.isGroupEditorPanelVisible,
    }))
  );

  if (!isGroupEditorPanelVisible && !isEditorPanelVisible) {
    return (
      <Placeholder
        message={t("mainPanel.placeholder.selectGroupOrFile")}
        icon={LayoutGrid}
        t={t}
      />
    );
  }

  return (
    <div className="relative h-full w-full">
      <ResizablePanelGroup direction="horizontal">
        {isGroupEditorPanelVisible && (
          <ResizablePanel defaultSize={50} minSize={30} order={1}>
            {editingGroupId ? (
              <GroupEditorPanel />
            ) : (
              <Placeholder
                message={t("mainPanel.placeholder.noGroupSelected")}
                icon={ListChecks}
                t={t}
              />
            )}
          </ResizablePanel>
        )}
        {isGroupEditorPanelVisible && isEditorPanelVisible && (
          <ResizableHandle withHandle />
        )}
        {isEditorPanelVisible && (
          <ResizablePanel defaultSize={50} minSize={30} order={2}>
            {activeEditorFile ? (
              <EditorPanel />
            ) : (
              <Placeholder
                message={t("mainPanel.placeholder.noFileSelected")}
                icon={FileCode}
                t={t}
              />
            )}
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

const Placeholder = ({
  message,
  icon: Icon,
  t,
}: {
  message: string;
  icon: React.ElementType;
  t: (key: string) => string;
}) => (
  <div className="flex flex-col items-center justify-center h-full text-center bg-muted/40 p-4">
    <Icon className="h-16 w-16 text-muted-foreground mb-4" />
    <h2 className="text-xl font-semibold">
      {t("mainPanel.placeholder.title")}
    </h2>
    <p className="text-muted-foreground mt-2 max-w-md">{message}</p>
  </div>
);


================================================
FILE: src/store/actions/aiChatActions.ts
================================================
// src/store/actions/aiChatActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import i18n from "@/i18n";

// Đặt ở đầu file để tránh nhầm lẫn — dùng trước khi định nghĩa
// Helper to get translations
const t = (key: string) => i18n.t(key);

import {
  type ChatMessage,
  type AIChatSession,
  type AttachedItem,
} from "../types";
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
  handleNonStreamingResponse,
  handleStreamingResponse,
} from "@/lib/openRouter";
import {
  handleNonStreamingResponseGoogle,
  handleStreamingResponseGoogle,
  toGooglePayload,
} from "@/lib/googleAI";
import { getGoogleTools, getOpenRouterTools } from "@/lib/aiTools";

export interface AiChatActions {
  sendChatMessage: (prompt: string) => Promise<void>;
  fetchAiResponse: () => Promise<void>;
  stopAiResponse: () => void;
  regenerateResponse: (fromIndex: number) => Promise<void>;
  _internal_editAndResubmit: (
    prompt: string,
    fromIndex: number
  ) => Promise<void>;
}

/**
 * (Private helper) Generates the hidden context string from attached items.
 */
const _generateHiddenContent = async (
  get: () => AppState,
  items: AttachedItem[]
): Promise<string | undefined> => {
  const { rootPath, activeProfile } = get();
  if (items.length === 0 || !rootPath || !activeProfile) {
    return undefined;
  }

  const contentPromises = items.map(async (item: AttachedItem) => {
    if (item.type === "folder") {
      const treeStructure = await invoke<string>("generate_directory_tree", {
        rootPathStr: rootPath,
        dirRelPath: item.id,
      });
      return `--- START OF DIRECTORY STRUCTURE FOR ${item.name} ---\n${treeStructure}\n--- END OF DIRECTORY STRUCTURE FOR ${item.name} ---`;
    } else if (item.type === "group") {
      const groupContext = await invoke<string>(
        "generate_group_context_for_ai",
        {
          rootPathStr: rootPath,
          profileName: activeProfile,
          groupId: item.id,
        }
      );
      return `--- START OF CONTEXT FOR GROUP "${item.name}" ---\n${groupContext}\n--- END OF CONTEXT FOR GROUP "${item.name}" ---`;
    } else {
      const fileContent = await invoke<string>("get_file_content", {
        rootPathStr: rootPath,
        fileRelPath: item.id,
      });
      return `--- START OF FILE ${item.name} ---\n${fileContent}\n--- END OF FILE ${item.name} ---`;
    }
  });
  const allContents = await Promise.all(contentPromises);
  return allContents.join("\n\n");
};

export const createAiChatActions: StateCreator<
  AppState,
  [],
  [],
  AiChatActions
> = (set, get) => ({
  sendChatMessage: async (prompt: string) => {
    const {
      openRouterApiKey,
      googleApiKey,
      rootPath,
      allAvailableModels,
      selectedAiModel,
      editingMessageIndex,
      actions,
    } = get();
    // Reset editing state regardless of the outcome
    set({ editingMessageIndex: null });

    if (editingMessageIndex !== null) {
      await actions._internal_editAndResubmit(
        prompt,
        editingMessageIndex
      );
      return;
    }
    const model = allAvailableModels.find((m) => m.id === selectedAiModel);
    const aiAttachedFiles = get().aiAttachedFiles;

    if (
      (model?.provider === "openrouter" && !openRouterApiKey) ||
      (model?.provider === "google" && !googleApiKey)
    ) {
      return;
    }

    set({ isAiPanelLoading: true });

    try {
      let currentSession = get().activeChatSession;

      if (!currentSession) {
        const { activeProfile } = get();
        if (!rootPath || !activeProfile) {
          throw new Error("Project path or profile not set.");
        }
        const newSession = await invoke<AIChatSession>("create_chat_session", {
          projectPath: rootPath,
          profileName: activeProfile,
          title: prompt.substring(0, 50),
        });

        currentSession = newSession;

        set((state) => ({
          activeChatSession: newSession,
          activeChatSessionId: newSession.id,
          chatMessages: [],
          chatSessions: [
            {
              id: newSession.id,
              title: newSession.title,
              createdAt: newSession.createdAt,
            },
            ...state.chatSessions,
          ],
        }));
      }

      const hiddenContent = await _generateHiddenContent(get, aiAttachedFiles);
      const newUserMessage: ChatMessage = {
        role: "user",
        content: prompt,
        hiddenContent,
        attachedFiles: [...aiAttachedFiles],
      };

      const newMessages = [...get().chatMessages, newUserMessage];
      set({ chatMessages: newMessages });

      await get().actions.saveCurrentChatSession(newMessages);

      get().actions.clearAttachedFilesFromAi();

      await get().actions.fetchAiResponse();
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : String(error);
      console.error("Error in sendChatMessage:", errorMessage);
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const assistantErrorMessage: ChatMessage = {
        role: "assistant",
        content: `${t("aiPanel.error")}\n\n${errorMessage}`,
      };
      set((state) => ({
        chatMessages: [...state.chatMessages, assistantErrorMessage],
        isAiPanelLoading: false,
      }));
      await get().actions.saveCurrentChatSession();
    }
  },
  fetchAiResponse: async () => {
    const {
      openRouterApiKey,
      googleApiKey,
      nvidiaApiKey,
      allAvailableModels,
      aiModels,
      selectedAiModel,
      chatMessages,
      activeChatSession,
      streamResponse,
      systemPrompt,
      temperature,
      topP,
      topK,
      maxTokens,
      geminiThinkingLevel,
      aiChatMode,
    } = get();
    const { editingGroupId } = get();

    const controller = new AbortController();
    set({ abortController: controller });

    const model = allAvailableModels.find((m) => m.id === selectedAiModel);
    if (!model || !activeChatSession) return;

    const actualApiKey = model.provider === "google" ? googleApiKey : (model.provider === "nvidia" ? nvidiaApiKey : openRouterApiKey);
    if (!actualApiKey) {
      console.error(`API key for ${model.provider} is not set.`);
      set({ isAiPanelLoading: false });
      return;
    }
    const messagesToSend: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      messagesToSend.push({ role: "system", content: systemPrompt });
    }
    messagesToSend.push(...chatMessages);

    if (model.provider === "google") {
      const tools = getGoogleTools(aiChatMode, editingGroupId);
      const payload = toGooglePayload(messagesToSend, {
        systemPrompt,
        temperature,
        topP,
        topK,
        maxTokens,
        thinkingLevel: geminiThinkingLevel,
        tools,
      });

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${
          model.id
        }:${streamResponse ? "streamGenerateContent" : "generateContent"}`;
        const response = await tauriFetch(endpoint, {
          method: "POST",
          headers: {
            "x-goog-api-key": actualApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || response.statusText);
        }

        if (streamResponse) {
          await handleStreamingResponseGoogle(response, {
            getState: get,
            setState: set,
          });
        } else {
          const assistantMessage = await handleNonStreamingResponseGoogle(
            response
          );
          set((state) => ({
            chatMessages: [...state.chatMessages, assistantMessage],
          }));
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("AI response aborted by user.");
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Google AI API error:", errorMessage);

        const assistantErrorMessage: ChatMessage = {
          role: "assistant",
          content: `${t("aiPanel.error")}\n\n${errorMessage}`,
        };

        set((state) => ({
          chatMessages: [...state.chatMessages, assistantErrorMessage],
        }));
      } finally {
        set({ isAiPanelLoading: false, abortController: null });
        await get().actions.saveCurrentChatSession();
      }
    } else {
      const tools = getOpenRouterTools(aiChatMode, editingGroupId);
      const payload: Record<string, any> = {
        model: selectedAiModel || aiModels[0]?.id,
        messages: messagesToSend.map(
          ({ hidden, hiddenContent, attachedFiles, ...msg }) => {
            const fullContent = (hiddenContent || "") + (msg.content || "");
            return { ...msg, content: fullContent };
          }
        ),
        tools,
      };

      try {
        const endpointUrl = model.provider === "nvidia" 
          ? "https://integrate.api.nvidia.com/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";

        const response = await tauriFetch(
          endpointUrl,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${actualApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              ...payload, 
              stream: streamResponse,
              ...(streamResponse ? { stream_options: { include_usage: true } } : {})
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || response.statusText);
        }

        if (streamResponse) {
          await handleStreamingResponse(response, {
            getState: get,
            setState: set,
          });
        } else {
          const assistantMessage = await handleNonStreamingResponse(
            response,
            actualApiKey,
            model.provider === "openrouter"
          );
          set((state) => ({
            chatMessages: [...state.chatMessages, assistantMessage],
          }));
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("AI response aborted by user.");
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("OpenRouter API error:", errorMessage);

        const assistantErrorMessage: ChatMessage = {
          role: "assistant",
          content: `${t("aiPanel.error")}\n\n${errorMessage}`,
        };

        set((state) => ({
          chatMessages: [...state.chatMessages, assistantErrorMessage],
        }));
      } finally {
        set({ isAiPanelLoading: false });
        set({ abortController: null });
        await get().actions.saveCurrentChatSession();
      }
    }
  },

  stopAiResponse: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({
        abortController: null,
        isAiPanelLoading: false,
      });
    }
  },

  regenerateResponse: async (fromIndex: number) => {
    if (get().isAiPanelLoading) {
      get().actions.stopAiResponse();
    }
    const { chatMessages } = get();

    let lastUserMessageIndex = -1;
    for (let i = fromIndex - 1; i >= 0; i--) {
      if (chatMessages[i].role === "user" && !chatMessages[i].hidden) {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (lastUserMessageIndex === -1) {
      console.error(
        "Could not find a visible user message to regenerate from."
      );
      return;
    }

    const truncatedMessages = chatMessages.slice(0, lastUserMessageIndex + 1);

    set({ isAiPanelLoading: true, chatMessages: truncatedMessages });

    try {
      await get().actions.saveCurrentChatSession(truncatedMessages);
      await get().actions.fetchAiResponse();
    } catch (error) {
      console.error("Error during regeneration:", error);
      set({ isAiPanelLoading: false });
    }
  },

  _internal_editAndResubmit: async (
    newPrompt: string,
    fromIndex: number
  ) => {
    set({ editingMessageIndex: null });
    if (get().isAiPanelLoading) {
      get().actions.stopAiResponse();
    }

    const { chatMessages, aiAttachedFiles } = get();

    const truncatedMessages = chatMessages.slice(0, fromIndex);

    const hiddenContent = await _generateHiddenContent(get, aiAttachedFiles);

    const newUserMessage: ChatMessage = {
      role: "user",
      content: newPrompt,
      hiddenContent,
      attachedFiles: [...aiAttachedFiles],
    };

    const finalMessages = [...truncatedMessages, newUserMessage];

    set({
      isAiPanelLoading: true,
      chatMessages: finalMessages,
    });

    get().actions.clearAttachedFilesFromAi();

    await get().actions.saveCurrentChatSession(finalMessages);
    await get().actions.fetchAiResponse();
  },
});


================================================
FILE: src/store/actions/aiSessionActions.ts
================================================
// src/store/actions/aiSessionActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import {
  type ChatMessage,
  type AIChatSession,
  type AIChatSessionHeader,
} from "../types";
import { invoke } from "@tauri-apps/api/core";

export interface AiSessionActions {
  saveCurrentChatSession: (messagesOverride?: ChatMessage[]) => Promise<void>;
  createNewChatSession: () => void;
  loadChatSessions: () => Promise<void>;
  loadChatSession: (sessionId: string) => Promise<void>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  updateChatSessionTitle: (
    sessionId: string,
    newTitle: string
  ) => Promise<void>;
  deleteAllChatSessions: () => Promise<void>;
}

export const createAiSessionActions: StateCreator<
  AppState,
  [],
  [],
  AiSessionActions
> = (set, get) => ({
  createNewChatSession: () => {
    set({
      chatMessages: [],
      activeChatSessionId: null,
      activeChatSession: null,
    });
  },
  loadChatSessions: async () => {
    const { rootPath, activeProfile } = get();
    if (!rootPath || !activeProfile) return;
    try {
      const sessions = await invoke<AIChatSessionHeader[]>(
        "list_chat_sessions",
        { projectPath: rootPath, profileName: activeProfile }
      );
      set({ chatSessions: sessions });
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
      set({ chatSessions: [] });
    }
  },
  loadChatSession: async (sessionId: string) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath || !activeProfile) return;
    try {
      const session = await invoke<AIChatSession>("load_chat_session", {
        projectPath: rootPath,
        profileName: activeProfile,
        sessionId,
      });
      set({
        activeChatSession: session,
        activeChatSessionId: session.id,
        chatMessages: session.messages,
      });
    } catch (e) {
      console.error(`Failed to load chat session ${sessionId}:`, e);
    }
  },
  deleteChatSession: async (sessionId: string) => {
    const { rootPath, activeProfile, activeChatSessionId } = get();
    if (!rootPath || !activeProfile) return;
    await invoke("delete_chat_session", {
      projectPath: rootPath,
      profileName: activeProfile,
      sessionId,
    });
    set((state) => ({
      chatSessions: state.chatSessions.filter((s) => s.id !== sessionId),
    }));
    if (activeChatSessionId === sessionId) {
      get().actions.createNewChatSession();
    }
  },
  updateChatSessionTitle: async (sessionId: string, newTitle: string) => {
    const { rootPath, activeProfile } = get();
    if (!rootPath || !activeProfile) return;
    await invoke("update_chat_session_title", {
      projectPath: rootPath,
      profileName: activeProfile,
      sessionId,
      newTitle,
    });
    set((state) => ({
      chatSessions: state.chatSessions.map((s) =>
        s.id === sessionId ? { ...s, title: newTitle } : s
      ),
    }));
  },
  deleteAllChatSessions: async () => {
    const { rootPath, activeProfile } = get();
    if (!rootPath || !activeProfile) return;
    try {
      await invoke("delete_all_chat_sessions", {
        projectPath: rootPath,
        profileName: activeProfile,
      });
      set({ chatSessions: [] });
      get().actions.createNewChatSession();
    } catch (e) {
      console.error("Failed to delete all chat sessions:", e);
    }
  },
  saveCurrentChatSession: async (messagesOverride?: ChatMessage[]) => {
    const {
      rootPath,
      activeProfile,
      activeChatSession,
      chatMessages: currentMessages,
    } = get();
    if (rootPath && activeProfile && activeChatSession) {
      const messagesToSave = messagesOverride ?? currentMessages;

      // Find the last message with generationInfo to get the final session totals
      let totalTokens: number | undefined = undefined;
      let totalCost: number | undefined = undefined;

      // Vòng lặp chạy ngược từ cuối mảng
      for (let i = messagesToSave.length - 1; i >= 0; i--) {
        const msg = messagesToSave[i];
        if (msg.generationInfo) {
          // Lấy thông tin từ tin nhắn cuối cùng có generationInfo
          totalTokens =
            (msg.generationInfo.tokens_prompt || 0) +
            (msg.generationInfo.tokens_completion || 0);
          totalCost = msg.generationInfo.total_cost || 0;
          break; // Thoát ngay khi tìm thấy, vì chỉ cần tin cuối cùng
        }
      }

      const sessionToSave: AIChatSession = {
        ...activeChatSession,
        messages: messagesToSave,
        totalTokens:
          totalTokens !== undefined && totalTokens > 0
            ? totalTokens
            : undefined,
        totalCost:
          totalCost !== undefined && totalCost > 0 ? totalCost : undefined,
      };
      await invoke("save_chat_session", {
        projectPath: rootPath,
        profileName: activeProfile,
        session: sessionToSave,
      });
      // Keep the state in sync after saving
      set({
        activeChatSession: sessionToSave,
      });
    }
  },
});


================================================
FILE: src/store/appStore.ts
================================================
// src/store/appStore.ts
import { create } from "zustand";
import {
  type FileNode,
  type ProjectStats,
  type ScanProgress,
  type Group,
  type FileMetadata,
  type GitRepositoryInfo,
  type GitCommit,
  type GitStatus,
  type AiChatMode,
  type AIModel,
  type AIChatSessionHeader,
  type AIChatSession,
  type AttachedItem,
  type ChatMessage,
  type AiFileActions,
  type KiloModelInfo,
} from "./types";
import { initialState } from "./initialState";
import {
  createProjectActions,
  type ProjectActions,
} from "./actions/projectActions";
import { createGroupActions, type GroupActions } from "./actions/groupActions";
import {
  createProfileActions,
  type ProfileActions,
} from "./actions/profileActions";
import {
  createSettingsActions,
  type SettingsActions,
} from "./actions/settingsActions";
import { createUIActions, type UIActions } from "./actions/uiActions";
import { createGitActions, type GitActions } from "./actions/gitActions";
import {
  createAiSettingsActions,
  type AiSettingsActions,
} from "./actions/aiActions";
import {
  createAiChatActions,
  type AiChatActions,
} from "./actions/aiChatActions";
import {
  createAiSessionActions,
  type AiSessionActions,
} from "./actions/aiSessionActions";

import { createAiFileActions } from "./actions/aiFileActions";

export interface AppState {
  rootPath: string | null;
  selectedPath: string | null;
  allGroups: Map<string, Group[]>;
  groups: Group[]; // Derived state

  // Dữ liệu quét chung
  projectStats: ProjectStats | null;
  fileTree: FileNode | null;
  fileMetadataCache: Record<string, FileMetadata> | null;

  // State giao diện
  activeScene: "dashboard" | "settings"; // Deprecated by activeView
  editingGroupId: string | null;
  inlineEditingGroup: {
    mode: "create" | "rename";
    profileName: string;
    groupId?: string;
  } | null;
  isScanning: boolean;
  isRescanning: boolean;
  scanProgress: ScanProgress;
  isUpdatingGroupId: string | null;
  tempSelectedPaths: Set<string> | null;
  isGroupEditorPanelVisible: boolean;
  isEditorPanelVisible: boolean;
  activeEditorFile: string | null;
  activeEditorFileContent: string | null;
  isEditorLoading: boolean;
  activeEditorFileExclusions: [number, number][] | null;

  // Dữ liệu riêng của hồ sơ active
  syncEnabled: boolean;
  syncPath: string | null;
  customIgnorePatterns: string[];
  isWatchingFiles: boolean;
  exportUseFullTree: boolean;
  exportOnlyTree: boolean;
  exportWithLineNumbers: boolean;
  exportWithoutComments: boolean;
  exportRemoveDebugLogs: boolean;
  exportSuperCompressed: boolean;
  exportClaudeMode: boolean;
  exportDummyLogic: boolean;
  alwaysApplyText: string | null;
  appendIdePrompt: boolean;
  appendGroupPrompt: boolean;
  appendKiloPrompt: boolean;
  exportExcludeExtensions: string[];
  gitExportModeIsContext: boolean;

  // Quản lý hồ sơ
  profiles: string[];
  activeProfile: string;
  isSidebarVisible: boolean;
  recentPaths: string[];
  nonAnalyzableExtensions: string[];
  nonAnalyzableFolders: string[];

  // Git Panel
  isGitPanelVisible: boolean;
  gitRepoInfo: GitRepositoryInfo | null;
  gitStatus: GitStatus | null;
  gitCommits: GitCommit[];
  gitLogState: "idle" | "loading_repo" | "loading_commits" | "error";
  gitCurrentPage: number;
  hasMoreCommits: boolean;
  originalGitBranch: string | null; // <-- THÊM STATE MỚI
  gitBranches: string[];

  // Kilo Panel
  isKiloPanelVisible: boolean;
  isKiloServerRunning: boolean;
  kiloLogs: string[];
  isKiloInstalled: boolean | null;
  selectedKiloModel: string;
  kiloAvailableModels: KiloModelInfo[];
  kiloTaskStatus: "idle" | "running" | "success" | "error";
  kiloPort: number;
  patchPort: number;
  discordWebhookUrl: string;

  // Patch Panel
  isPatchPanelVisible: boolean;
  isPatchServerRunning: boolean;
  patchLogs: string[];
  patchTasks: import("./types").PatchTaskUI[];
  patchTaskStatus: "idle" | "running" | "success" | "error";

  // AI Panel
  isAiPanelVisible: boolean;
  aiChatMode: AiChatMode;
  openRouterApiKey: string;
  googleApiKey: string;
  nvidiaApiKey: string;
  allAvailableModels: AIModel[];
  aiModels: AIModel[];
  chatMessages: ChatMessage[];
  isAiPanelLoading: boolean;
  chatSessions: AIChatSessionHeader[];
  activeChatSessionId: string | null;
  abortController: AbortController | null;
  activeChatSession: AIChatSession | null;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  geminiThinkingLevel: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
  systemPrompt: string;
  streamResponse: boolean;
  selectedAiModel: string;
  subAgentModel: string;
  subAgentEnabled: boolean;
  subAgentMaxRetries: number;
  editingMessageIndex: number | null;
  aiAttachedFiles: AttachedItem[];

  actions: ProjectActions &
    GroupActions &
    ProfileActions &
    SettingsActions &
    UIActions &
    GitActions &
    AiSettingsActions &
    AiChatActions &
    AiSessionActions &
    AiFileActions;
}

export const useAppStore = create<AppState>()((set, get, store) => ({
  ...initialState,
  actions: {
    ...createProjectActions(set, get, store),
    ...createGroupActions(set, get, store),
    ...createProfileActions(set, get, store),
    ...createSettingsActions(set, get, store),
    ...createUIActions(set, get, store),
    ...createGitActions(set, get, store),
    ...createAiSettingsActions(set, get, store),
    ...createAiChatActions(set, get, store),
    ...createAiSessionActions(set, get, store),
    ...createAiFileActions(set, get, store),
  },
}));

export const useAppActions = () => useAppStore((state) => state.actions);


================================================
FILE: src/store/types.ts
================================================
// src/store/types.ts

export interface CachedProjectData {
  stats: ProjectStats | null;
  file_tree: FileNode | null;
  groups: Group[];
  file_metadata_cache: Record<string, FileMetadata>;
  sync_enabled?: boolean | null;
  sync_path?: string | null;
  data_hash?: string | null;
  custom_ignore_patterns?: string[]; // <-- Sửa thành snake_case
  is_watching_files?: boolean | null; // <-- THÊM TRƯỜNG MỚI
  export_use_full_tree?: boolean | null; // <-- THÊM TRƯỜNG MỚI NÀY
  export_only_tree?: boolean | null;
  export_with_line_numbers?: boolean | null; // <-- THÊM TRƯỜNG MỚI
  export_without_comments?: boolean | null; // <-- THÊM TRƯỜNG MỚI
  export_remove_debug_logs?: boolean | null; // <-- THÊM TRƯỜNG MỚI
  export_super_compressed?: boolean | null;
  export_claude_mode?: boolean | null;
  export_dummy_logic?: boolean | null;
  always_apply_text?: string | null;
  append_ide_prompt?: boolean | null;
  append_group_prompt?: boolean | null;
  append_kilo_prompt?: boolean | null;
  export_exclude_extensions?: string[];
  git_export_mode_is_context?: boolean | null;
}

export interface FileNode {
  name: string;
  path: string;
  children?: FileNode[] | null;
}

export interface GroupStats {
  total_files: number;
  total_dirs: number;
  total_size: number;
  token_count: number;
}

export interface FileMetadata {
  size: number;
  mtime: number;
  token_count: number;
  excluded_ranges?: [number, number][]; // <-- THÊM TRƯỜNG MỚI
}

export interface ProjectStats {
  total_files: number;
  total_dirs: number;
  total_size: number;
  total_tokens: number;
}

export interface ScanProgress {
  currentFile: string | null;
  currentPhase: "scanning" | "analyzing";
}

export interface Group {
  id: string;
  name: string;
  paths: string[];
  stats: GroupStats;
  tokenLimit?: number; // <-- THÊM TRƯỜNG NÀY
}

export interface AIGroupUpdateResult {
  updatedGroup: Group;
  finalExpandedFiles: string[];
}

export interface ScanCompletePayload {
  projectData: CachedProjectData;
  isFirstScan: boolean;
}

export type AiChatMode = "ask" | "context" | "mc";

export interface AIModel {
  provider: "openrouter" | "google" | "nvidia";
  id: string;
  name: string;
  context_length: number | null;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export interface AppSettings {
  recentPaths: string[];
  nonAnalyzableExtensions?: string[];
  nonAnalyzableFolders?: string[];
  openRouterApiKey?: string;
  aiModels?: string[];
  googleApiKey?: string;
  nvidiaApiKey?: string;
  streamResponse?: boolean;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  geminiThinkingLevel?: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
  selectedKiloModel?: string;
  subAgentModel?: string;
  subAgentEnabled?: boolean;
  subAgentMaxRetries?: number;
  kiloPort?: number;
  patchPort?: number;
  discordWebhookUrl?: string;
}

export interface GitRepositoryInfo {
  isRepository: boolean;
  currentBranch: string | null;
  remoteUrl: string | null;
  currentSha: string | null;
  mainBranchHeadSha: string | null;
}

export interface GitCommit {
  sha: string;
  author: string;
  date: string;
  message: string;
}

export interface GitStatus {
  files: Record<string, string>; // path -> status code
}

export type GitLogState = "idle" | "loading_repo" | "loading_commits" | "error";

export interface GenerationInfo {
  tokens_prompt: number;
  tokens_completion: number;
  total_cost: number;
}

export interface AttachedItem {
  id: string; // file path, folder path, or group ID
  type: "file" | "folder" | "group";
  name: string; // display name
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | null; // Allow null content for tool calls
  thoughts?: string; // Reasoning content from AI
  attachedFiles?: AttachedItem[]; // Files attached to this specific message
  hiddenContent?: string;
  generationInfo?: GenerationInfo;
  tool_calls?: ToolCall[]; // Add tool_calls
  hidden?: boolean; // For hidden user messages
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
  status?: "pending" | "success" | "error" | "partial"; // To track execution status for UI
  result?: string; // Store result text for terminal UI
  detailed_results?: Array<{
    status: "success" | "error";
    message: string;
  }>;
}

export interface PatchOpUI {
  id: string;
  file: string;
  opType: 'modify' | 'create' | 'delete' | 'rename' | 'mkdir' | 'command';
  status: 'pending' | 'success' | 'error';
  message: string;
  subAgentLogs?: string[];
}

export interface PatchTaskUI {
  id: string;
  timestamp: number;
  status: 'idle' | 'running' | 'success' | 'error';
  operations: PatchOpUI[];
}

export interface AIChatSessionHeader {
  id: string;
  title: string;
  createdAt: string; // ISO string from backend
}

export interface AIChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
  totalTokens?: number;
  totalCost?: number;
}

export interface KiloModelInfo {
  id: string;
  label: string;
}

export interface AiFileActions {
  attachItemToAi: (item: AttachedItem) => void;
  detachItemFromAi: (itemId: string) => void;
  clearAttachedFilesFromAi: () => void;
}

export interface AppState {
  rootPath: string | null;
  selectedPath: string | null;
  allGroups: Map<string, Group[]>;
  groups: Group[]; // Derived state

  // Dữ liệu quét chung
  projectStats: ProjectStats | null;
  fileTree: FileNode | null;
  fileMetadataCache: Record<string, FileMetadata> | null;

  // State giao diện
  activeScene: "dashboard" | "settings"; // Deprecated by activeView
  editingGroupId: string | null;
  inlineEditingGroup: {
    mode: "create" | "rename";
    profileName: string;
    groupId?: string;
  } | null;
  isScanning: boolean;
  isRescanning: boolean;
  scanProgress: ScanProgress;
  isUpdatingGroupId: string | null;
  tempSelectedPaths: Set<string> | null;
  isGroupEditorPanelVisible: boolean;
  isEditorPanelVisible: boolean;
  activeEditorFile: string | null;
  activeEditorFileContent: string | null;
  isEditorLoading: boolean;
  activeEditorFileExclusions: [number, number][] | null;

  // Dữ liệu riêng của hồ sơ active
  syncEnabled: boolean;
  syncPath: string | null;
  customIgnorePatterns: string[];
  isWatchingFiles: boolean;
  exportUseFullTree: boolean;
  exportOnlyTree: boolean;
  exportWithLineNumbers: boolean;
  exportWithoutComments: boolean;
  exportRemoveDebugLogs: boolean;
  exportSuperCompressed: boolean;
  exportClaudeMode: boolean;
  exportDummyLogic: boolean;
  alwaysApplyText: string | null;
  appendIdePrompt: boolean;
  appendGroupPrompt: boolean;
  appendKiloPrompt: boolean;
  exportExcludeExtensions: string[];
  gitExportModeIsContext: boolean;

  // Quản lý hồ sơ
  profiles: string[];
  activeProfile: string;
  isSidebarVisible: boolean;
  recentPaths: string[];
  nonAnalyzableExtensions: string[];
  nonAnalyzableFolders: string[];

  // Git Panel
  isGitPanelVisible: boolean;
  gitRepoInfo: GitRepositoryInfo | null;
  gitStatus: GitStatus | null;
  gitCommits: GitCommit[];
  gitLogState: "idle" | "loading_repo" | "loading_commits" | "error";
  gitCurrentPage: number;
  hasMoreCommits: boolean;
  originalGitBranch: string | null; // <-- THÊM STATE MỚI
  gitBranches: string[];

  // Kilo Panel
  isKiloPanelVisible: boolean;
  isKiloServerRunning: boolean;
  kiloLogs: string[];
  isKiloInstalled: boolean | null;
  selectedKiloModel: string;
  kiloAvailableModels: KiloModelInfo[];
  kiloTaskStatus: "idle" | "running" | "success" | "error";

  // Patch Panel
  isPatchPanelVisible: boolean;
  isPatchServerRunning: boolean;
  patchLogs: string[];
  patchTasks: PatchTaskUI[];
  patchTaskStatus: "idle" | "running" | "success" | "error";

  // AI Panel
  isAiPanelVisible: boolean;
  aiChatMode: AiChatMode;
  openRouterApiKey: string;
  googleApiKey: string;
  nvidiaApiKey: string;
  allAvailableModels: AIModel[];
  aiModels: AIModel[];
  chatMessages: ChatMessage[];
  isAiPanelLoading: boolean;
  chatSessions: AIChatSessionHeader[];
  activeChatSessionId: string | null;
  abortController: AbortController | null;
  activeChatSession: AIChatSession | null;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  geminiThinkingLevel: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
  systemPrompt: string;
  streamResponse: boolean;
  selectedAiModel: string;
  subAgentModel: string;
  subAgentEnabled: boolean;
  subAgentMaxRetries: number;
  editingMessageIndex: number | null;
  aiAttachedFiles: AttachedItem[];
  kiloPort: number;
  patchPort: number;
  discordWebhookUrl: string;
}


