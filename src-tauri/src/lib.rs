// greet 是 Tauri 示例命令，当前仅用于验证前后端命令桥接是否可用。
#[tauri::command]
fn greet(name: &str) -> String {
    // 将前端传入的名称拼入返回字符串，不修改后端状态。
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Builder 注册桌面端插件和命令处理器，最后把生成的 Tauri 上下文交给运行时。
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
