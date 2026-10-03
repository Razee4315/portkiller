#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use serde::Serialize;
use std::collections::HashSet;
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::sync::Mutex;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WebviewWindow,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use windows::Win32::Foundation::{
    CloseHandle, ERROR_ACCESS_DENIED, ERROR_INVALID_PARAMETER, HANDLE,
};
use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
use windows::Win32::System::Threading::{
    GetCurrentProcess, OpenProcess, OpenProcessToken, TerminateProcess, PROCESS_TERMINATE,
};

// Hide the console window of helper processes (taskkill, reg, powershell).
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// Passed by the "start with Windows" registry entry so a login launch stays in
// the tray instead of popping the window open.
const HIDDEN_FLAG: &str = "--hidden";

// Passed to the elevated instance spawned by `restart_as_admin`. It waits a
// moment before starting so the unelevated instance has released the
// single-instance lock and the global hotkey.
const RELAUNCH_FLAG: &str = "--relaunch";

const DEFAULT_HOTKEY: &str = "Alt+P";

const AUTOSTART_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const AUTOSTART_VALUE: &str = "PortKiller";

// Reusable sysinfo instance — creating a fresh System on every poll is the
// single biggest CPU cost in the old code path.
struct AppData {
    system: Mutex<System>,
    is_admin: bool,
    start_hidden: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct PortInfo {
    pub pid: u32,
    pub port: u16,
    pub protocol: String,
    pub process_name: String,
    pub process_path: String,
    pub command_line: String,
    pub is_protected: bool,
    pub local_address: String,
}

#[derive(Serialize, Clone)]
pub struct AppState {
    pub ports: Vec<PortInfo>,
    pub is_admin: bool,
}

// Machine-readable kill outcome. The frontend owns the wording, so nothing
// here depends on the (localized) text that Windows tools print.
#[derive(Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum KillCode {
    Ok,
    Protected,
    Gone,
    Stale,
    Denied,
    Failed,
}

#[derive(Serialize, Clone)]
pub struct KillResult {
    pub code: KillCode,
    pub process_name: String,
    pub detail: String,
}

#[derive(Serialize, Clone)]
pub struct ProcessDetails {
    pub pid: u32,
    pub name: String,
    pub path: String,
    pub memory_bytes: u64,
    pub cpu_percent: f32,
    pub children: Vec<u32>,
}

const PROTECTED_PROCESSES: &[&str] = &[
    "system",
    "svchost.exe",
    "csrss.exe",
    "explorer.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "smss.exe",
    "dwm.exe",
    "taskmgr.exe",
];

const PROTECTED_PIDS: &[u32] = &[0, 4];

fn is_protected_process(pid: u32, name: &str) -> bool {
    if PROTECTED_PIDS.contains(&pid) {
        return true;
    }
    let name_lower = name.to_lowercase();
    PROTECTED_PROCESSES.iter().any(|&p| name_lower == p)
}

// The port list only needs each process's name, path and command line. CPU,
// memory and disk counters are skipped: they are the expensive part of a full
// refresh and nothing in the list shows them.
fn list_refresh_kind() -> ProcessRefreshKind {
    ProcessRefreshKind::new()
        .with_exe(UpdateKind::OnlyIfNotSet)
        .with_cmd(UpdateKind::OnlyIfNotSet)
}

fn lock_system(data: &AppData) -> std::sync::MutexGuard<'_, System> {
    // A poisoned lock only means another command panicked mid-refresh; the
    // process table is still usable.
    data.system
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn get_process_info(system: &System, pid: u32) -> (String, String, String) {
    let sys_pid = Pid::from_u32(pid);
    if let Some(process) = system.process(sys_pid) {
        let name = process.name().to_string_lossy().to_string();
        let path = process
            .exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let command_line = process
            .cmd()
            .iter()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(" ");
        (name, path, command_line)
    } else {
        ("Unknown".to_string(), String::new(), String::new())
    }
}

// Detect process elevation via the Win32 token API. Avoids the ~100 ms cost of
// shelling `net session` on the critical startup path.
fn is_running_as_admin() -> bool {
    unsafe {
        let mut token: HANDLE = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
        let mut returned = 0u32;
        let result = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            size,
            &mut returned,
        );
        let _ = CloseHandle(token);

        result.is_ok() && elevation.TokenIsElevated != 0
    }
}

// Commands that scan sockets, refresh processes or wait on a helper process
// are marked `async` so Tauri runs them on its thread pool. Plain commands run
// on the main thread, where they would stall window dragging and input.
#[tauri::command(async)]
fn get_listening_ports(data: State<AppData>) -> Result<AppState, String> {
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;

    let sockets = get_sockets_info(af_flags, proto_flags).map_err(|e| e.to_string())?;

    let mut system = lock_system(&data);
    system.refresh_processes_specifics(ProcessesToUpdate::All, list_refresh_kind());

    let mut ports: Vec<PortInfo> = Vec::new();
    let mut seen: HashSet<(u16, u32)> = HashSet::new();

    for socket in sockets {
        let (protocol, local_port, local_addr) = match &socket.protocol_socket_info {
            ProtocolSocketInfo::Tcp(tcp) => {
                if tcp.state != netstat2::TcpState::Listen {
                    continue;
                }
                (
                    "TCP".to_string(),
                    tcp.local_port,
                    tcp.local_addr.to_string(),
                )
            }
            ProtocolSocketInfo::Udp(udp) => (
                "UDP".to_string(),
                udp.local_port,
                udp.local_addr.to_string(),
            ),
        };

        for pid in &socket.associated_pids {
            let pid_u32 = *pid;
            if !seen.insert((local_port, pid_u32)) {
                continue;
            }

            let (process_name, process_path, command_line) = get_process_info(&system, pid_u32);
            let is_protected = is_protected_process(pid_u32, &process_name);

            ports.push(PortInfo {
                pid: pid_u32,
                port: local_port,
                protocol: protocol.clone(),
                process_name,
                process_path,
                command_line,
                is_protected,
                local_address: local_addr.clone(),
            });
        }
    }

    ports.sort_by_key(|p| p.port);

    Ok(AppState {
        ports,
        is_admin: data.is_admin,
    })
}

#[tauri::command(async)]
fn get_process_details(pid: u32, data: State<AppData>) -> Result<ProcessDetails, String> {
    let mut system = lock_system(&data);
    let sys_pid = Pid::from_u32(pid);
    // Only refresh the target PID, and only the counters this panel shows.
    // The main poll (`get_listening_ports`) keeps the rest of the snapshot
    // fresh enough for the children-discovery scan below.
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[sys_pid]),
        ProcessRefreshKind::new().with_memory().with_cpu(),
    );

    if let Some(process) = system.process(sys_pid) {
        let name = process.name().to_string_lossy().to_string();
        let path = process
            .exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let memory_bytes = process.memory();
        let cpu_percent = process.cpu_usage();

        let children: Vec<u32> = system
            .processes()
            .iter()
            .filter_map(|(child_pid, child_proc)| {
                if child_proc.parent() == Some(sys_pid) {
                    Some(child_pid.as_u32())
                } else {
                    None
                }
            })
            .collect();

        Ok(ProcessDetails {
            pid,
            name,
            path,
            memory_bytes,
            cpu_percent,
            children,
        })
    } else {
        Err(format!("Process {} not found", pid))
    }
}

// Task Manager's manifest asks for elevation, so a direct spawn fails for a
// standard token. `start` goes through the shell, which shows the UAC prompt.
#[tauri::command(async)]
fn open_task_manager() -> Result<(), String> {
    Command::new("cmd")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/C", "start", "", "taskmgr.exe"])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// Open Explorer with the given file selected.
#[tauri::command(async)]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    let target = std::path::Path::new(&path);
    if !target.is_absolute() || !target.exists() {
        return Err("That path no longer exists".to_string());
    }
    Command::new("explorer")
        .args(["/select,", &path])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

enum TerminateError {
    Denied,
    Gone,
    Other(String),
}

fn classify_win32(error: &windows::core::Error) -> TerminateError {
    if error.code() == ERROR_ACCESS_DENIED.to_hresult() {
        TerminateError::Denied
    } else if error.code() == ERROR_INVALID_PARAMETER.to_hresult() {
        // OpenProcess reports an unknown PID as an invalid parameter.
        TerminateError::Gone
    } else {
        TerminateError::Other(error.message())
    }
}

fn terminate(pid: u32) -> Result<(), TerminateError> {
    unsafe {
        match OpenProcess(PROCESS_TERMINATE, false, pid) {
            Ok(handle) => {
                let result = TerminateProcess(handle, 1);
                let _ = CloseHandle(handle);
                result.map_err(|e| classify_win32(&e))
            }
            Err(e) => Err(classify_win32(&e)),
        }
    }
}

// taskkill reaches some service processes that a plain TerminateProcess
// cannot, and `/T` takes the whole process tree down with the parent.
fn taskkill(pid: u32, tree: bool) -> Result<(), TerminateError> {
    let mut command = Command::new("taskkill");
    command.creation_flags(CREATE_NO_WINDOW).arg("/F");
    if tree {
        command.arg("/T");
    }
    command.args(["/PID", &pid.to_string()]);

    match command.output() {
        Ok(output) if output.status.success() => Ok(()),
        // Exit codes, not stderr text: the text is localized.
        Ok(output) => Err(match output.status.code() {
            Some(128) => TerminateError::Gone,
            Some(1) => TerminateError::Denied,
            _ => TerminateError::Other(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        }),
        Err(e) => Err(TerminateError::Other(e.to_string())),
    }
}

// True when `pid` still holds a socket on `port`. Guards against acting on a
// stale row: the process may have exited, and Windows reuses PIDs.
fn pid_owns_port(pid: u32, port: u16) -> bool {
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;

    match get_sockets_info(af_flags, proto_flags) {
        Ok(sockets) => sockets.iter().any(|socket| {
            let local_port = match &socket.protocol_socket_info {
                ProtocolSocketInfo::Tcp(tcp) => tcp.local_port,
                ProtocolSocketInfo::Udp(udp) => udp.local_port,
            };
            local_port == port && socket.associated_pids.contains(&pid)
        }),
        // If the socket table cannot be read, do not block the kill on it.
        Err(_) => true,
    }
}

fn kill_result(code: KillCode, process_name: &str, detail: &str) -> KillResult {
    KillResult {
        code,
        process_name: process_name.to_string(),
        detail: detail.to_string(),
    }
}

#[tauri::command(async)]
fn kill_process(pid: u32, port: u16, tree: bool, data: State<AppData>) -> KillResult {
    // Look the process up here rather than trusting what the UI last saw.
    let sys_pid = Pid::from_u32(pid);
    let mut system = lock_system(&data);
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&[sys_pid]), list_refresh_kind());
    let current_name = system
        .process(sys_pid)
        .map(|p| p.name().to_string_lossy().to_string());
    // Release the lock before the (slow) socket scan and kill below.
    drop(system);

    let Some(process_name) = current_name else {
        return kill_result(KillCode::Gone, "", "");
    };

    if is_protected_process(pid, &process_name) {
        return kill_result(KillCode::Protected, &process_name, "");
    }

    if !pid_owns_port(pid, port) {
        return kill_result(KillCode::Stale, &process_name, "");
    }

    let outcome = if tree {
        taskkill(pid, true)
    } else {
        match terminate(pid) {
            Err(TerminateError::Denied) => taskkill(pid, false),
            other => other,
        }
    };

    match outcome {
        Ok(()) => kill_result(KillCode::Ok, &process_name, ""),
        Err(TerminateError::Denied) => kill_result(KillCode::Denied, &process_name, ""),
        Err(TerminateError::Gone) => kill_result(KillCode::Gone, &process_name, ""),
        Err(TerminateError::Other(detail)) => kill_result(KillCode::Failed, &process_name, &detail),
    }
}

// Relaunch elevated. Blocks until the UAC prompt is answered so that a
// cancelled prompt leaves this instance running instead of quitting the app.
#[tauri::command(async)]
fn restart_as_admin(app_handle: AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let script = format!(
        "Start-Process -FilePath '{}' -ArgumentList '{}' -Verb RunAs",
        exe.to_string_lossy().replace('\'', "''"),
        RELAUNCH_FLAG
    );

    let status = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
        .status()
        .map_err(|e| format!("Could not start PowerShell: {}", e))?;

    if !status.success() {
        return Err("Elevation was cancelled".to_string());
    }

    app_handle.exit(0);
    Ok(())
}

#[tauri::command]
fn set_tray_tooltip(app: AppHandle, text: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(text)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Called by the frontend once it has rendered and restored the saved window
// position. Showing the window from here, rather than at creation, avoids a
// flash of an empty transparent window at the default position.
#[tauri::command]
fn frontend_ready(window: WebviewWindow, data: State<AppData>) {
    if !data.start_hidden {
        show_window(&window);
    }
}

// Replace the global show/hide shortcut. The frontend stores the user's
// choice and applies it on every start.
#[tauri::command]
fn set_hotkey(app: AppHandle, accelerator: String) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister_all();
    shortcuts
        .register(accelerator.as_str())
        .map_err(|e| e.to_string())
}

#[tauri::command(async)]
fn get_autostart() -> bool {
    Command::new("reg")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["query", AUTOSTART_KEY, "/v", AUTOSTART_VALUE])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[tauri::command(async)]
fn set_autostart(enabled: bool) -> Result<(), String> {
    let mut command = Command::new("reg");
    command.creation_flags(CREATE_NO_WINDOW);

    if enabled {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let value = format!("\"{}\" {}", exe.display(), HIDDEN_FLAG);
        command.args([
            "add",
            AUTOSTART_KEY,
            "/v",
            AUTOSTART_VALUE,
            "/t",
            "REG_SZ",
            "/d",
            &value,
            "/f",
        ]);
    } else {
        command.args(["delete", AUTOSTART_KEY, "/v", AUTOSTART_VALUE, "/f"]);
    }

    let output = command.output().map_err(|e| e.to_string())?;
    // Deleting a value that is already absent fails; that is still "disabled".
    if output.status.success() || !enabled {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn show_window(window: &WebviewWindow) {
    // Don't re-center on every show — the frontend persists the user's last
    // position and we want to honor it.
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

// Hotkey behavior: hide only when the window is already in front. A window
// that is visible but buried behind other apps is brought forward instead.
fn toggle_window(window: &WebviewWindow) {
    let visible = window.is_visible().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);
    if visible && focused {
        let _ = window.hide();
    } else {
        show_window(window);
    }
}

fn handle_show(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        show_window(&w);
    }
}

fn handle_toggle(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        toggle_window(&w);
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == RELAUNCH_FLAG) {
        // Give the unelevated instance time to exit and release the
        // single-instance lock before this one asks for it.
        std::thread::sleep(std::time::Duration::from_millis(1500));
    }

    let app_data = AppData {
        system: Mutex::new(System::new()),
        is_admin: is_running_as_admin(),
        start_hidden: args.iter().any(|a| a == HIDDEN_FLAG),
    };

    tauri::Builder::default()
        // Must be the first plugin. A second launch exits immediately and
        // this callback runs in the instance that is already open.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            handle_show(app);
        }))
        .manage(app_data)
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // Only one shortcut is ever registered, so any press is
                    // the show/hide hotkey.
                    if event.state == ShortcutState::Pressed {
                        handle_toggle(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Auto-updater (reads a signed latest.json from GitHub Releases) and
            // the process plugin (relaunch after install). Desktop-only plugins,
            // so registered here behind cfg rather than in the chain above.
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }

            // Best-effort default hotkey. Another app may already own it; that
            // must not stop PortKiller from starting. The frontend re-applies
            // the user's saved shortcut and reports a failure in the UI.
            let _ = app.global_shortcut().register(DEFAULT_HOTKEY);

            let show_item = MenuItem::with_id(app, "show", "Show PortKiller", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Tray icon — reuse the default window icon embedded by tauri-build.
            let icon = app
                .default_window_icon()
                .ok_or("missing default window icon")?
                .clone();
            TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .tooltip("PortKiller")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => handle_show(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Clicking the tray takes focus away from the window first,
                    // so "toggle" could never hide it. Always bring it forward.
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        handle_show(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_listening_ports,
            get_process_details,
            open_task_manager,
            reveal_in_explorer,
            kill_process,
            restart_as_admin,
            set_tray_tooltip,
            frontend_ready,
            set_hotkey,
            get_autostart,
            set_autostart
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
