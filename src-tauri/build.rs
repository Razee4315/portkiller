fn main() {
    // Always run the Tauri build script — in v2 it processes capabilities and
    // generates schemas, even on Windows.
    tauri_build::build();
}
