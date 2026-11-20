export function filterFiles(files, query, type) {
  const q = query.trim().toLowerCase();
  return files.filter(
    (f) => (type === "all" || f.type === type) && (!q || f.relPath.toLowerCase().includes(q)),
  );
}
