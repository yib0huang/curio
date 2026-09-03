import { Composer } from "./components/Composer";
import { MessageList } from "./components/MessageList";
import { SettingsDialog } from "./components/SettingsDialog";
import { useCurioController } from "./hooks/useCurioController";

/** 组合侧边栏页面，不直接承载浏览器或模型协议细节。 */
export function App() {
  const controller = useCurioController();

  return (
    <>
      <main className="app">
        <MessageList messages={controller.messages} />
        <Composer
          page={controller.page}
          pageStatus={controller.pageStatus}
          error={controller.error}
          disabled={controller.sending}
          onRefresh={() => void controller.refreshPage()}
          onOpenSettings={() => void controller.openSettings()}
          onSubmit={controller.submitQuestion}
        />
      </main>
      <SettingsDialog
        open={controller.settingsOpen}
        settings={controller.settings}
        onClose={controller.closeSettings}
        onSave={controller.saveSettings}
      />
    </>
  );
}
