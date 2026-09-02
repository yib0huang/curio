import { Composer } from "./components/Composer";
import { Header } from "./components/Header";
import { MessageList } from "./components/MessageList";
import { PageContext } from "./components/PageContext";
import { SettingsDialog } from "./components/SettingsDialog";
import { useCurioController } from "./hooks/useCurioController";

/** 组合侧边栏页面，不直接承载浏览器或模型协议细节。 */
export function App() {
  const controller = useCurioController();
  const hasConversation = controller.messages.length > 0 || controller.sending;

  return (
    <>
      <main className="app">
        <Header
          pageStatus={controller.pageStatus}
          onRefresh={() => void controller.refreshPage()}
          onOpenSettings={() => void controller.openSettings()}
        />
        <PageContext
          page={controller.page}
          hasConversation={hasConversation}
          onAsk={(question) => void controller.submitQuestion(question)}
        />
        <MessageList messages={controller.messages} pending={controller.sending} />
        <Composer
          error={controller.error}
          disabled={controller.sending}
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
