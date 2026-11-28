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

// NOTAM e ROTAER da AISWEB (DECEA), a fonte oficial no Brasil. A API pede a ApiKey e a ApiPass, que cada
// pessoa pede ao DECEA: elas vêm da janela e não ficam no código. A busca sai daqui, como o METAR (CORS).
// O host é o aisweb.decea.mil.br: o www.aisweb.aer.mil.br, usado por clientes antigos, não respondeu.
const AISWEB_API: &str = "https://aisweb.decea.mil.br/api/";

// Erro que a página reconhece: a AISWEB recusou a ApiKey ou a ApiPass.
const INVALID_CREDENTIALS: &str = "INVALID_CREDENTIALS";

// Credencial só com letras, números e hífen, para nada mudar a URL. Vazia ou longa demais, recusada.
fn valid_credential(text: &str) -> bool {
    !text.is_empty() && text.len() <= 64 && text.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

// Só as duas áreas que o app usa: NOTAM e ROTAER.
fn valid_aisweb_area(area: &str) -> bool {
    matches!(area, "notam" | "rotaer")
}

// Corpo da resposta em XML. Vazio quando não há dado (HTTP 204). A AISWEB responde 200 mesmo com credencial
// errada, então o aviso é procurado no texto, em trechos sem acento para não depender da codificação.
async fn aisweb_query(area: &str, icao: &str, api_key: &str, api_pass: &str) -> Result<String, String> {
    if !valid_aisweb_area(area) {
        return Err("área inválida".into());
    }
    if !valid_icao(icao) {
        return Err("código ICAO inválido".into());
    }
    if !valid_credential(api_key) || !valid_credential(api_pass) {
        return Err(INVALID_CREDENTIALS.into());
    }
    let url = format!(
        "{}?apiKey={}&apiPass={}&area={}&IcaoCode={}",
        AISWEB_API,
        api_key,
        api_pass,
        area,
        icao.to_ascii_uppercase()
    );
    let client = reqwest::Client::builder()
        .user_agent("MapReader/1.0 (app desktop)")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.without_url().to_string())?;
    // O erro do reqwest traz a URL, e a URL leva a ApiKey e a ApiPass: o erro sai sem a URL.
    let response = client.get(url).send().await.map_err(|e| e.without_url().to_string())?;
    if response.status() == reqwest::StatusCode::NO_CONTENT {
        return Ok(String::new());
    }
    let body = response
        .error_for_status()
        .map_err(|e| e.without_url().to_string())?
        .text()
        .await
        .map_err(|e| e.without_url().to_string())?;
    if body.contains("Informe uma chave") || body.contains("Erro nos parametros") {
        return Err(INVALID_CREDENTIALS.into());
    }
    Ok(body)
}

#[tauri::command]
async fn fetch_aisweb(area: String, icao: String, api_key: String, api_pass: String) -> Result<String, String> {
    aisweb_query(&area, &icao, &api_key, &api_pass).await
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(OpenedFolder::default())
        .invoke_handler(tauri::generate_handler![allow_folder, take_opened_folder, fetch_metar, fetch_taf, fetch_aisweb])
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

    #[test]
    fn credencial_so_aceita_letras_numeros_e_hifen() {
        assert!(valid_credential("1234567890"));
        assert!(valid_credential("abcd-ef12"));
        assert!(!valid_credential(""));
        assert!(!valid_credential("abc&apiPass=x"));
        assert!(!valid_credential("abc def"));
        assert!(!valid_credential(&"a".repeat(65)));
    }

    #[test]
    fn area_so_aceita_notam_e_rotaer() {
        assert!(valid_aisweb_area("notam"));
        assert!(valid_aisweb_area("rotaer"));
        assert!(!valid_aisweb_area("met"));
        assert!(!valid_aisweb_area("notam&apiKey=x"));
    }

    // Consulta a AISWEB de verdade, com as credenciais de quem roda (nunca no código).
    // Rodar com: AISWEB_API_KEY=... AISWEB_API_PASS=... cargo test -- --ignored
    #[test]
    #[ignore]
    fn consulta_notam_e_rotaer_da_aisweb_ao_vivo() {
        let key = std::env::var("AISWEB_API_KEY").expect("defina AISWEB_API_KEY");
        let pass = std::env::var("AISWEB_API_PASS").expect("defina AISWEB_API_PASS");
        let rotaer = tauri::async_runtime::block_on(aisweb_query("rotaer", "SBSP", &key, &pass)).unwrap();
        assert!(rotaer.contains("AeroCode"));
        let notam = tauri::async_runtime::block_on(aisweb_query("notam", "SBSP", &key, &pass)).unwrap();
        assert!(notam.contains("notam"));
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
