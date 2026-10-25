import AppKit
import WebKit
import UniformTypeIdentifiers

final class AdminApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    let smoke = CommandLine.arguments.contains("--smoke-test")
    var smokeStage = 0

    func applicationDidFinishLaunching(_ notification: Notification) {
        let configuration = WKWebViewConfiguration()
        if smoke { configuration.websiteDataStore = .nonPersistent() }
        configuration.userContentController.add(self, name: "saveFile")
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "ByteStore Admin"
        window.backgroundColor = BrandTheme.background
        window.minSize = NSSize(width: 900, height: 640)
        window.contentView = web
        window.center()
        window.makeKeyAndOrderFront(nil)
        makeMenu()
        let folder = Bundle.main.resourceURL!.appendingPathComponent("Web")
        web.loadFileURL(folder.appendingPathComponent("admin.html"), allowingReadAccessTo: folder)
        NSApp.activate(ignoringOtherApps: true)
        if smoke {
            DispatchQueue.main.asyncAfter(deadline: .now() + 90) { self.finishTest("FAIL: timeout", code: 1) }
        }
    }

    func makeMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        menu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(withTitle: "О ByteStore Admin", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Скрыть ByteStore Admin", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Завершить ByteStore Admin", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let fileItem = NSMenuItem()
        fileItem.submenu = NSMenu(title: "Файл")
        fileItem.submenu?.addItem(withTitle: "Экспорт данных…", action: #selector(backup), keyEquivalent: "s")
        fileItem.submenu?.addItem(withTitle: "Открыть магазин", action: #selector(openStore), keyEquivalent: "o")
        fileItem.submenu?.addItem(withTitle: "Обновить данные", action: #selector(refresh), keyEquivalent: "r")
        fileItem.submenu?.addItem(withTitle: "Выйти из учётной записи", action: #selector(logout), keyEquivalent: "l")
        menu.addItem(fileItem)
        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Правка")
        editItem.submenu = edit
        for (title, selector, key) in [("Отменить", "undo:", "z"), ("Вырезать", "cut:", "x"), ("Копировать", "copy:", "c"), ("Вставить", "paste:", "v"), ("Выбрать всё", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        menu.addItem(editItem)
        NSApp.mainMenu = menu
        for submenu in [appMenu, fileItem.submenu!] {
            for item in submenu.items where [#selector(about), #selector(backup), #selector(logout), #selector(openStore), #selector(refresh)].contains(item.action) { item.target = self }
        }
    }

    @objc func about() {
        alert("ByteStore Admin 0.2", "Приложение управления ByteStore. Товары, заказы и пользователи хранятся в общей базе PostgreSQL (Supabase). Для работы требуется интернет.")
    }
    @objc func backup() { web.evaluateJavaScript("window.desktopAdmin.backup()") }
    @objc func logout() { web.callAsyncJavaScript("if (BS.db.isAdmin()) { await BS.db.adminLogout(); BS.admin.init(); }", arguments: [:], in: nil, in: .page) { _ in } }
    @objc func openStore() { NSWorkspace.shared.open(URL(string: "https://stereofox08.github.io/Diplom/")!) }
    @objc func refresh() { web.callAsyncJavaScript("await BS.cloud.refresh(); BS.admin.init();", arguments: [:], in: nil, in: .page) { result in if case .failure(let error) = result { self.alert("Не удалось обновить данные", error.localizedDescription) } } }
    func alert(_ title: String, _ text: String) {
        let panel = NSAlert()
        panel.messageText = title
        panel.informativeText = text
        panel.runModal()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
              let body = message.body as? [String: String], let content = body["content"], let name = body["name"] else { return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = (name as NSString).lastPathComponent
        panel.beginSheetModal(for: window) { result in
            guard result == .OK, let url = panel.url else { return }
            do { try content.write(to: url, atomically: true, encoding: .utf8) }
            catch { self.alert("Не удалось сохранить файл", error.localizedDescription) }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL && url.lastPathComponent == "admin.html" { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated && ["https", "http"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["https", "http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        alert("ByteStore Admin", message); completionHandler()
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let panel = NSAlert(); panel.messageText = message
        panel.addButton(withTitle: "Подтвердить"); panel.addButton(withTitle: "Отмена")
        completionHandler(panel.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if smoke { finishTest("FAIL: \(error)", code: 1) }
        else { alert("Не удалось открыть админку", error.localizedDescription) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard smoke else { return }
        let credentialsPath = ProcessInfo.processInfo.environment["BYTESTORE_SMOKE_CREDENTIALS"] ?? "/tmp/bytestore-test-accounts.json"
        guard let credentialsData = try? Data(contentsOf: URL(fileURLWithPath: credentialsPath)),
              let credentials = try? JSONSerialization.jsonObject(with: credentialsData) as? [String: Any],
              let users = credentials["users"] as? [[String: Any]],
              let admin = users.first(where: { $0["admin"] as? Bool == true }),
              let email = admin["email"] as? String, let password = admin["password"] as? String else {
            finishTest("FAIL: test credentials unavailable", code: 1); return
        }
        let script: String
        if smokeStage == 0 {
            script = """
            await BS.db.ready;
            if (!BS.util.storage.available) throw Error('Persistent storage unavailable');
            if (!document.querySelector('[data-admin-login]')) throw Error('Login missing');
            const result = await BS.db.adminLogin(email, password);
            if (!result.ok) throw Error('Login failed');
            BS.admin.init();
            for (const panel of ['dashboard','products','images','categories','orders','reviews','users','promos','ai','log']) BS.admin.show(panel);
            if (!BS.cloud || BS.db.productsAll().length !== 60) throw Error('Shared catalogue missing');
            return 'saved';
            """
        } else {
            script = """
            await BS.db.ready;
            if (!BS.db.isAdmin()) throw Error('Session lost');
            await BS.cloud.refresh();
            await BS.db.adminLogout(); BS.admin.init();
            if (!document.querySelector('[data-admin-login]')) throw Error('Logout failed');
            return 'PASS: cloud login, shared catalogue, 10 panels, session after reload, logout';
            """
        }
        web.callAsyncJavaScript(script, arguments: ["email": email, "password": password], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                if self.smokeStage == 0 { self.smokeStage = 1; self.web.reload() }
                else { self.finishTest(String(describing: value), code: 0) }
            case .failure(let error): self.finishTest("FAIL: \(error)", code: 1)
            }
        }
    }
    func finishTest(_ result: String, code: Int32) {
        try? result.write(toFile: "/tmp/bytestore-admin-smoke.txt", atomically: true, encoding: .utf8)
        exit(code)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AdminApp()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
