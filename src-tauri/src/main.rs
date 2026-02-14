#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::os::windows::process::CommandExt;
use sysinfo::{Pid, System, ProcessRefreshKind, RefreshKind, ProcessesToUpdate};
use tauri::{
    CustomMenuItem, GlobalShortcutManager, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, Window, AppHandle,
};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PortInfo {
    pub pid: u32,
    pub port: u16,
    pub protocol: String,
    pub process_name: String,
    pub process_path: String,
    pub is_protected: bool,
    pub local_address: String,
}

#[derive(Serialize, Clone)]
pub struct AppState {
    pub ports: Vec<PortInfo>,
    pub last_updated: u64,
    pub is_admin: bool,
}

#[derive(Serialize, Clone)]
pub struct KillResult {
    pub success: bool,
    pub message: String,
    pub port: u16,
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

fn get_process_info(system: &System, pid: u32) -> (String, String) {
    let sys_pid = Pid::from_u32(pid);
    if let Some(process) = system.process(sys_pid) {
        let name = process.name().to_string_lossy().to_string();
        let path = process
            .exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        (name, path)
    } else {
        ("Unknown".to_string(), String::new())
    }
}

fn is_running_as_admin() -> bool {
    use std::process::Command;
    let output = Command::new("net")
        .args(["session"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();
    
    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

#[tauri::command]
fn get_listening_ports() -> Result<AppState, String> {
    // Use targeted refresh for better performance
    let mut system = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything())
    );
    system.refresh_processes(ProcessesToUpdate::All);

    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;

    let sockets = get_sockets_info(af_flags, proto_flags).map_err(|e| e.to_string())?;

    let mut ports: Vec<PortInfo> = Vec::new();
    let mut seen: HashSet<(u16, u32)> = HashSet::new();

    for socket in sockets {
        let (protocol, local_port, local_addr) = match &socket.protocol_socket_info {
            ProtocolSocketInfo::Tcp(tcp) => {
                if tcp.state != netstat2::TcpState::Listen {
                    continue;
                }
                ("TCP".to_string(), tcp.local_port, tcp.local_addr.to_string())
            }
            ProtocolSocketInfo::Udp(udp) => {
                ("UDP".to_string(), udp.local_port, udp.local_addr.to_string())
            }
        };

        for pid in &socket.associated_pids {
            let pid_u32 = *pid;
            if seen.contains(&(local_port, pid_u32)) {
                continue;
            }
            seen.insert((local_port, pid_u32));

            let (process_name, process_path) = get_process_info(&system, pid_u32);
            let is_protected = is_protected_process(pid_u32, &process_name);

            ports.push(PortInfo {
                pid: pid_u32,
                port: local_port,
                protocol: protocol.clone(),
                process_name,
                process_path,
                is_protected,
                local_address: local_addr.clone(),
            });
        }
    }

    ports.sort_by(|a, b| a.port.cmp(&b.port));

    let last_updated = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    Ok(AppState {
        ports,
        last_updated,
        is_admin: is_running_as_admin(),
    })
}

#[tauri::command]
fn get_process_details(pid: u32) -> Result<ProcessDetails, String> {
    let mut system = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything())
    );
    system.refresh_processes(ProcessesToUpdate::All);

    let sys_pid = Pid::from_u32(pid);
    
    if let Some(process) = system.process(sys_pid) {
        let name = process.name().to_string_lossy().to_string();
        let path = process.exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let memory_bytes = process.memory();
        let cpu_percent = process.cpu_usage();
        
        // Find child processes
        let children: Vec<u32> = system.processes()
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

#[tauri::command]
fn open_task_manager() -> Result<(), String> {
    use std::process::Command;
    
    Command::new("taskmgr.exe")
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn kill_process(pid: u32, port: u16, process_name: String) -> KillResult {
    if is_protected_process(pid, &process_name) {
        return KillResult {
            success: false,
            message: format!("Cannot kill protected system process: {}", process_name),
            port,
        };
    }

    // First try Windows API
    let api_result = unsafe {
        let handle: Result<HANDLE, _> = OpenProcess(PROCESS_TERMINATE, false, pid);

        match handle {
            Ok(h) => {
                if h.is_invalid() {
                    false
                } else {
                    let result = TerminateProcess(h, 1);
                    let _ = CloseHandle(h);
                    result.is_ok()
                }
            }
            Err(_) => false,
        }
    };

    if api_result {
        return KillResult {
            success: true,
            message: format!("Port {} freed (killed {})", port, process_name),
            port,
        };
    }

    // Fallback: use taskkill command (works better for services)
    use std::process::Command;
    let taskkill_result = Command::new("taskkill")
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .args(["/F", "/PID", &pid.to_string()])
        .output();

    match taskkill_result {
        Ok(output) => {
            if output.status.success() {
                KillResult {
                    success: true,
                    message: format!("Port {} freed (killed {})", port, process_name),
                    port,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                if stderr.contains("Access is denied") || stderr.contains("not found") {
                    KillResult {
                        success: false,
                        message: "Access denied. Restart as Administrator.".to_string(),
                        port,
                    }
                } else {
                    KillResult {
                        success: false,
                        message: format!("Failed to kill process: {}", stderr.trim()),
                        port,
                    }
                }
            }
        }
        Err(e) => KillResult {
            success: false,
            message: format!("Failed to execute taskkill: {}", e),
            port,
        },
    }
}

#[tauri::command]
fn restart_as_admin(app_handle: AppHandle) -> Result<(), String> {
    use std::process::Command;
    use std::os::windows::process::CommandExt;
    
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    
    // Use ShellExecuteW via PowerShell to properly elevate
    let result = Command::new("powershell")
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - hide PowerShell window
        .args([
            "-WindowStyle", "Hidden",
            "-Command",
            &format!(
                "Start-Process -FilePath '{}' -Verb RunAs",
                exe.to_string_lossy().replace("'", "''")
            ),
        ])
        .spawn();
    
    match result {
        Ok(_) => {
            // Exit current instance after spawning elevated one
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                app_handle.exit(0);
            });
            Ok(())
        }
        Err(e) => Err(format!("Failed to restart as admin: {}", e)),
    }
}

#[tauri::command]
fn hide_main_window(window: Window) {
    let _ = window.hide();
}

fn show_window(window: &Window) {
    let _ = window.show();
    let _ = window.center();
    let _ = window.set_focus();
}

fn toggle_window(window: &Window) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        show_window(window);
    }
}

fn create_tray_menu() -> SystemTrayMenu {
    let show = CustomMenuItem::new("show".to_string(), "Show (Alt+P)");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    
    SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit)
}

fn main() {
    let tray = SystemTray::new().with_menu(create_tray_menu());

    tauri::Builder::default()
        .system_tray(tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    toggle_window(&window);
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        show_window(&window);
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            let window_clone = window.clone();

            // Register global hotkey Alt+P
            app.global_shortcut_manager()
                .register("Alt+P", move || {
                    toggle_window(&window_clone);
                })
                .expect("Failed to register global shortcut");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_listening_ports,
            get_process_details,
            open_task_manager,
            kill_process,
            restart_as_admin,
            hide_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
