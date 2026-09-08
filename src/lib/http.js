/** fetch con timeout y reintentos. Sin dependencias. */
export async function traer(url, { timeout = 15000, intentos = 3, headers = {}, texto = false } = {}) {
  let ultimoError;
  for (let i = 1; i <= intentos; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'user-agent': 'dolar-alertas/1.0 (+github actions)', accept: texto ? 'text/html,*/*' : 'application/json', ...headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      return texto ? await res.text() : await res.json();
    } catch (e) {
      ultimoError = e;
      if (i < intentos) await new Promise((r) => setTimeout(r, 800 * i));
    } finally {
      clearTimeout(t);
    }
  }
  throw ultimoError;
}
