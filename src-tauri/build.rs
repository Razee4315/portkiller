fn main() {
    // Always run the Tauri build script — in v2 it processes capabilities and
    // generates schemas, even on Windows.
    tauri_build::build();

    // On Windows, additionally embed our app icon + version metadata via winres
    // so the .exe shows the right icon and product info in Explorer.
    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "windows" {
        let mut res = winres::WindowsResource::new();
        res.set_icon("icons/icon.ico");
        res.set("ProductName", "PortKiller");
        res.set("FileDescription", "Port Process Killer Utility");
        res.set("LegalCopyright", "MIT License");

        if let Err(e) = res.compile() {
            eprintln!("Warning: Failed to embed Windows resources: {}", e);
        }

        println!("cargo:rerun-if-changed=icons/icon.ico");
    }
}
