// 发布版 Windows 应用使用 GUI 子系统启动，避免额外创建控制台窗口。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 主进程只负责转交到共享库入口，保持桌面启动逻辑集中在 lib.rs 中维护。
    recipe_designer_lib::run()
}
