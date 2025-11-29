fn main() {
    // Handle Windows resource embedding
    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "windows" {
        // Use winres to embed icon (works without windres)
        let mut res = winres::WindowsResource::new();
        res.set_icon("icons/icon.ico");
        res.set("ProductName", "PortKiller");
        res.set("FileDescription", "Port Process Killer Utility");
        res.set("LegalCopyright", "MIT License");
        
        if let Err(e) = res.compile() {
            eprintln!("Warning: Failed to embed Windows resources: {}", e);
            // Continue without embedded resources
        }
        
        println!("cargo:rerun-if-env-changed=TAURI_CONFIG");
        println!("cargo:rerun-if-changed=tauri.conf.json");
        println!("cargo:rerun-if-changed=icons/icon.ico");
        println!("cargo:rustc-cfg=desktop");
    } else {
        tauri_build::build()
    }
}
