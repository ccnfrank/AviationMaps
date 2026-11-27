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

// METAR e TAF do aviationweather.gov (sem chave). A API não manda cabeçalho de CORS, então a busca sai
// daqui e a página recebe só o texto da resposta. O código ICAO é checado antes de entrar na URL.
const AWC_DATA: &str = "https://aviationweather.gov/api/data";

// Código ICAO: quatro letras ou números, nada que mude a URL.
fn valid_icao(code: &str) -> bool {
    code.len() == 4 && code.chars().all(|c| c.is_ascii_alphanumeric())
}

// Corpo da resposta em JSON (texto). Vazio quando a API não tem dado para o código (HTTP 204).
async fn fetch_report(kind: &str, icao: &str) -> Result<String, String> {
    if !valid_icao(icao) {
        return Err("código ICAO inválido".into());
    }
    let url = format!("{}/{}?ids={}&format=json", AWC_DATA, kind, icao.to_ascii_uppercase());
    let client = reqwest::Client::builder()
        .user_agent("MapReader/1.0 (app desktop)")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::NO_CONTENT {
        return Ok(String::new());
    }
    response
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_metar(icao: String) -> Result<String, String> {
    fetch_report("metar", &icao).await
}

#[tauri::command]
async fn fetch_taf(icao: String) -> Result<String, String> {
    fetch_report("taf", &icao).await
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(OpenedFolder::default())
        .invoke_handler(tauri::generate_handler![allow_folder, take_opened_folder, fetch_metar, fetch_taf])
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn icao_so_aceita_quatro_letras_ou_numeros() {
        assert!(valid_icao("SBSP"));
        assert!(valid_icao("K1G4"));
        assert!(!valid_icao("SBS"));
        assert!(!valid_icao("SBSPX"));
        assert!(!valid_icao("SB/P"));
        assert!(!valid_icao("SB?P"));
    }

    // Consulta a internet de verdade. Rodar com: cargo test -- --ignored
    #[test]
    #[ignore]
    fn consulta_metar_e_taf_ao_vivo() {
        let metar = tauri::async_runtime::block_on(fetch_report("metar", "SBSP")).unwrap();
        assert!(metar.contains("rawOb"));
        let taf = tauri::async_runtime::block_on(fetch_report("taf", "SBSP")).unwrap();
        assert!(taf.contains("rawTAF"));
        let vazio = tauri::async_runtime::block_on(fetch_report("metar", "ZZZZ")).unwrap();
        assert!(vazio.is_empty());
    }
}
