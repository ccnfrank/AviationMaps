import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Folder, LayoutGrid, List, Search as SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { filterFiles } from "../lib/filterFiles";
import { formatSize } from "../lib/format";
import { listDir, parentDir } from "../lib/browseDir";
import { ROOT_NAME } from "../lib/groupFiles";
import { searchAll, splitHighlight } from "../lib/searchFiles";
import Thumb from "./Thumb";

// Quantas miniaturas aparecem de cada vez na grade; o total continua contado.
const MAX_TILES = 120;

// Todos os mapas, na ordem das pastas, para mostrar sem texto digitado. Mesmo formato dos resultados.
function browseAll(folders, limit) {
  let total = 0;
  const items = [];
  folders.forEach((folder, folderIndex) => {
    for (const entry of folder.files) {
      total++;
      if (items.length < limit) items.push({ folderIndex, folder: folder.name, entry });
    }
  });
  return { total, items };
}

// Busca dinâmica nos mapas de todas as pastas. O painel abaixo do campo mostra:
// - com o campo vazio: as pastas e subpastas; clicar numa abre o nível dela (as subpastas dentro,
//   e os mapas que estão diretamente nela). Os mapas de subpastas só aparecem ao abrir a subpasta;
// - com texto, na lista: os mapas que casam, agrupados por subpasta;
// - na grade: miniaturas (todos os mapas sem texto, ou os que casam).
// `view` ("grid" ou "list") e `onViewChange` são controlados por quem usa.
// `docked` é a coluna lateral da pasta carregada: o painel fica sempre aberto, os botões de
// visualização ficam ao lado do campo, e a grade sem texto mostra as miniaturas de todos os mapas.
export default function Search({ folders, onPreview, view = "grid", onViewChange, docked = false }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Nível aberto sem texto: { folderIndex, dir }, dir "" é a raiz da pasta, "dia2/sul" uma subpasta.
  const [nav, setNav] = useState(null);
  const inputRef = useRef(null);
  // Adiar o valor deixa a digitação fluida enquanto a lista recalcula.
  const deferred = useDeferredValue(query);
  const results = useMemo(() => (deferred.trim()
    ? searchAll(folders, deferred, MAX_TILES)
    : browseAll(folders, MAX_TILES)), [folders, deferred]);
  // Grupos por subpasta, com todos os mapas que casam (a lista não tem limite de miniaturas).
  const rows = useMemo(() => folders
    .map((folder, folderIndex) => ({ folderIndex, folder, items: filterFiles(folder.files, deferred, "all") }))
    .filter((row) => row.items.length > 0), [folders, deferred]);
  // Aberto ao focar: com pastas carregadas, o painel já mostra a lista; sem pastas, só com texto.
  // Na coluna lateral o painel fica sempre aberto enquanto houver pastas.
  const showing = docked ? folders.length > 0 : open && (query.trim() !== "" || folders.length > 0);

  // "/" foca a busca, como em editores; não age quando já há campo ou janela aberta.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.target.closest?.("input, textarea, [contenteditable]")) return;
      // Dentro de uma janela aberta só age o campo que está nela (a coluna da visualização).
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog && !dialog.contains(inputRef.current)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const choose = (item) => {
    setOpen(false);
    setQuery("");
    setNav(null);
    onPreview(item.entry);
  };

  const changeView = (next) => {
    setNav(null);
    onViewChange?.(next);
  };

  const onKeyDown = (e) => {
    // Enter abre o primeiro mapa só quando há texto digitado, para não abrir nada por engano.
    if (e.key === "Enter" && query.trim() && results.items[0]) {
      e.preventDefault();
      choose(results.items[0]);
    } else if (e.key === "Escape") {
      if (query) {
        setQuery("");
        // Com texto, o Esc só limpa a busca e não fecha a janela de visualização onde o campo está.
        e.stopPropagation();
      }
      setOpen(false);
      if (!query && !docked) e.currentTarget.blur();
    }
  };

  const field = (
    <div className="search__field">
      <SearchIcon className="search__icon" strokeWidth={1.8} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        aria-label={t("search.label")}
        aria-expanded={showing}
        aria-controls="search-live"
        placeholder={t("search.placeholder")}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setNav(null); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <kbd className="search__key" aria-hidden="true">/</kbd>
    </div>
  );

  if (docked) {
    return (
      <div className="search search--docked" role="search">
        <div className="search__bar">
          {field}
          <ViewToggle view={view} onChange={changeView} />
        </div>
        {showing && (
          <SearchPanel
            docked
            folders={folders}
            query={deferred}
            results={results}
            rows={rows}
            view={view}
            onViewChange={changeView}
            nav={nav}
            onNavigate={setNav}
            onChoose={choose}
          />
        )}
      </div>
    );
  }

  return (
    <div className="search" role="search">
      {field}
      {showing && (
        <SearchPanel
          folders={folders}
          query={deferred}
          results={results}
          rows={rows}
          view={view}
          onViewChange={changeView}
          nav={nav}
          onNavigate={setNav}
          onChoose={choose}
        />
      )}
    </div>
  );
}

// Alternância grade/lista. Fica no cabeçalho do painel flutuante, ou ao lado do campo na coluna lateral.
function ViewToggle({ view, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="search-live__views" role="group" aria-label={t("search.views")}>
      <button
        type="button"
        className="search-live__view"
        aria-pressed={view === "grid"}
        aria-label={t("search.gridView")}
        title={t("search.gridView")}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="search-live__view"
        aria-pressed={view === "list"}
        aria-label={t("search.listView")}
        title={t("search.listView")}
        onClick={() => onChange("list")}
      >
        <List strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}

// Painel flutuante, logo abaixo do campo (ou, na coluna lateral, a área abaixo do campo).
// Não tira o foco do campo: é isso que deixa a busca ao vivo.
// Sem texto: pastas e subpastas (linhas na lista, cartões na grade); clicar abre o nível dela,
// com o botão de voltar, nos dois modos. Com texto: os mapas que casam.
// Na coluna lateral, sem texto e em grade, mostra as miniaturas de todos os mapas.
function SearchPanel({ docked = false, folders, query, results, rows, view, onViewChange, nav, onNavigate, onChoose }) {
  const { t } = useTranslation();
  const { total, items } = results;
  const idle = query.trim() === "";
  // Na coluna lateral, a grade sem texto já traz os mapas: não há cartões de pasta nela.
  const mapsGrid = docked && idle && view !== "list";
  const subfolders = rows.filter((row) => row.folder.name !== ROOT_NAME);
  // Nível aberto (sem texto). A guarda cobre uma pasta que deixou de existir desde a última abertura.
  const folder = idle && nav && folders[nav.folderIndex] ? folders[nav.folderIndex] : null;
  const level = folder ? listDir(folder.files, nav.dir) : null;
  const levelTitle = folder ? [folder.name, ...nav.dir.split("/").filter(Boolean)].join(" / ") : "";
  const levelTotal = level ? level.maps.length + level.subdirs.reduce((sum, s) => sum + s.count, 0) : 0;

  let countText;
  if (level) {
    countText = t("search.maps", { count: levelTotal });
  } else if (idle && !mapsGrid) {
    countText = subfolders.length === 0 ? t("search.noFolders") : t("search.folders", { count: subfolders.length });
  } else if (total === 0) {
    countText = t("search.noResults");
  } else if (view === "list") {
    countText = t("search.count", { count: total });
  } else {
    countText = `${t("search.count", { count: total })}${total > items.length ? t("search.showing", { count: items.length }) : ""}`;
  }

  // Voltar sobe um nível; na raiz da pasta, volta à lista de pastas (nav null).
  const goBack = () => {
    if (!nav) return;
    onNavigate(nav.dir ? { folderIndex: nav.folderIndex, dir: parentDir(nav.dir) } : null);
  };

  const fileRow = (entry, label, key) => (
    <button key={key} type="button" className="search-file" onClick={() => onChoose({ entry })} title={entry.relPath}>
      <span className="search-file__name">{label}</span>
      <span className="search-file__size">{formatSize(entry.size)}</span>
    </button>
  );

  const folderRow = (key, name, count, onClick) => (
    <button key={key} type="button" className="search-folder" onClick={onClick}>
      <Folder className="search-folder__icon" strokeWidth={1.8} aria-hidden="true" />
      <span className="search-folder__name">{name}</span>
      <span className="search-folder__count">{t("search.maps", { count })}</span>
    </button>
  );

  const folderTile = (key, name, count, onClick) => (
    <button key={key} type="button" className="search-live__tile search-live__tile--folder" onClick={onClick} title={name}>
      <span className="search-live__thumb search-live__thumb--folder">
        <Folder strokeWidth={1.4} aria-hidden="true" />
      </span>
      <span className="search-live__name">{name}</span>
      <span className="search-live__folder">{t("search.maps", { count })}</span>
    </button>
  );

  const mapTile = (item) => (
    <button
      key={`${item.folderIndex}:${item.entry.relPath}`}
      type="button"
      className="search-live__tile"
      onClick={() => onChoose(item)}
      title={item.entry.relPath}
    >
      <span className="search-live__thumb">
        <Thumb entry={item.entry} />
      </span>
      <span className="search-live__name">
        {splitHighlight(item.entry.name, query).map((part, k) =>
          part.hit ? <mark key={k}>{part.text}</mark> : <span key={k}>{part.text}</span>,
        )}
      </span>
      <span className="search-live__folder">{item.entry.relPath.includes("/") ? `${item.folder} / ${item.entry.relPath.slice(0, item.entry.relPath.lastIndexOf("/"))}` : item.folder}</span>
    </button>
  );

  let body;
  if (level) {
    const folderIndex = nav.folderIndex;
    const openSub = (sub) => () => onNavigate({ folderIndex, dir: sub.path });
    body = view === "list" ? (
      <div className="search-live__list">
        <div className="search-group__title">
          <Folder className="search-group__icon" strokeWidth={1.8} aria-hidden="true" />
          <span className="search-group__name">{levelTitle}</span>
        </div>
        {level.subdirs.map((sub) => folderRow(sub.path, sub.name, sub.count, openSub(sub)))}
        {level.maps.map((entry) => fileRow(entry, entry.name, entry.relPath))}
      </div>
    ) : (
      <div className="search-live__grid">
        {level.subdirs.map((sub) => folderTile(sub.path, sub.name, sub.count, openSub(sub)))}
        {level.maps.map((entry) => mapTile({ folderIndex, folder: folder.name, entry }))}
      </div>
    );
  } else if (idle && !mapsGrid) {
    const openRoot = (row) => () => onNavigate({ folderIndex: row.folderIndex, dir: "" });
    body = view === "list" ? (
      <div className="search-live__list">
        {subfolders.map((row) => folderRow(row.folderIndex, row.folder.name, row.items.length, openRoot(row)))}
      </div>
    ) : (
      <div className="search-live__grid">
        {subfolders.map((row) => folderTile(row.folderIndex, row.folder.name, row.items.length, openRoot(row)))}
      </div>
    );
  } else if (view === "list") {
    body = (
      <div className="search-live__list">
        {rows.map((row) => (
          <section key={row.folderIndex} className="search-group" aria-label={row.folder.name}>
            <div className="search-group__title">
              {row.folder.name !== ROOT_NAME && <Folder className="search-group__icon" strokeWidth={1.8} aria-hidden="true" />}
              <span className="search-group__name">{row.folder.name}</span>
              <span className="search-group__count">{row.items.length}</span>
            </div>
            {row.items.map((entry) => fileRow(
              entry,
              splitHighlight(entry.name, query).map((part, k) =>
                part.hit ? <mark key={k}>{part.text}</mark> : <span key={k}>{part.text}</span>,
              ),
              `${row.folderIndex}:${entry.relPath}`,
            ))}
          </section>
        ))}
      </div>
    );
  } else {
    body = <div className="search-live__grid">{items.map(mapTile)}</div>;
  }

  return (
    <div
      id="search-live"
      className={docked ? "search-live search-live--docked" : "search-live"}
      role="region"
      aria-label={t("search.region")}
      onMouseDown={docked ? undefined : (e) => e.preventDefault()}
    >
      <div className="search-live__head">
        {level && (
          <button type="button" className="search-live__back" onClick={goBack}>
            <ArrowLeft strokeWidth={2} aria-hidden="true" />
            {t("search.back")}
          </button>
        )}
        <div className="search-live__count">{countText}</div>
        {!docked && <ViewToggle view={view} onChange={onViewChange} />}
      </div>
      {body}
    </div>
  );
}
