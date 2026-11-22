-- Resumos anônimos de desempenho enviados pelo app no fim de cada call.
CREATE TABLE IF NOT EXISTS perf (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  install TEXT NOT NULL,
  version TEXT NOT NULL,
  platform TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS perf_at ON perf (at);
