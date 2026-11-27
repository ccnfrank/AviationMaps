use std::sync::Mutex;

use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

// Libera de novo a pasta lembrada de uma execução anterior. O escopo do fs que o diálogo concede
// vale só enquanto o app está aberto; sem isto, a última pasta não poderia ser lida ao reabrir.
#[tauri::command]
fn allow_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())
}

// Pasta que o macOS entregou ao app (arrastada para o ícone no Dock, ou "Abrir com"). Fica guardada
// até a janela pedir, porque a entrega pode chegar antes de a página estar pronta.
#[derive(Default)]
struct OpenedFolder(Mutex<Option<String>>);

// Devolve a pasta guardada e a esvazia: cada entrega é lida uma vez, por quem pedir primeiro.
#[tauri::command]
fn take_opened_folder(state: tauri::State<OpenedFolder>) -> Option<String> {
    state.0.lock().ok()?.take()
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(OpenedFolder::default())
        .invoke_handler(tauri::generate_handler![allow_folder, take_opened_folder])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erro ao iniciar o Map Reader");

    app.run(|handle, event| match event {
        // Arrastar uma pasta para o ícone do app entrega o caminho aqui. Só pastas: o Info.plist
        // declara só elas, e um item que não seja pasta é ignorado.
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Opened { urls } => {
            // O macOS manda o caminho com a barra final ("…/Carta/"); ela sai para o caminho ficar igual ao do diálogo.
            let folder = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .find(|path| path.is_dir())
                .and_then(|path| {
                    path.to_str()
                        .map(|text| text.trim_end_matches('/'))
                        .filter(|text| !text.is_empty())
                        .map(str::to_owned)
                });
            if let Some(path) = folder {
                if let Ok(mut slot) = handle.state::<OpenedFolder>().0.lock() {
                    *slot = Some(path);
                }
                let _ = handle.emit("folder-opened", ());
            }
        }
        _ => {}
    });
}
