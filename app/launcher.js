(() => {
  const native = window.launcherNative, $ = id => document.getElementById(id);
  // Mesmo visual do app (2.1.5): fundo e cores do tema escolhido e o ícone do Pipoquinha escolhido.
  // Só lê as preferências; o launcher nunca grava perfil ou configuração.
  let settings = {}; try { settings = JSON.parse(localStorage.getItem('resenha.settings') || '{}') || {}; } catch {}
  try {
    const v = window.themePreview?.(settings.theme || 'system') || {}, root = document.documentElement.style;
    const map = { 'bg-rail': '--bg', 'text-hi': '--fg', muted: '--muted', link: '--accent', 'g-edge': '--edge', 'g-fill': '--fill', 'g-fill-2': '--fill-2', blurple: '--blurple' };
    for (const [k, css] of Object.entries(map)) if (v[k]) root.setProperty(css, v[k]);
    if (v.wall) root.setProperty('--wall', v.wall);
    const light = window.THEMES?.[settings.theme]?.light || (settings.theme === 'system' && !matchMedia('(prefers-color-scheme: dark)').matches) || settings.theme === 'arcLight';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
  } catch {}
  try { $('mascot').innerHTML = window.PIPOCA.pipocaSVG(settings.appIcon || 'quentinha', 76); } catch {}
  const descriptions = {
    checking: ['Verificando atualizações…', 'Buscando as novidades do Resenha'],
    opening: ['Tudo pronto. Entrando na resenha…', 'Abrindo o Resenha'],
    downloading: ['Baixando atualização', 'Preparando as novidades para você'],
    verifying: ['Conferindo atualização…', 'Conferindo a integridade do arquivo'],
    extracting: ['Preparando atualização…', 'Extraindo os arquivos da nova versão'],
    applying: ['Atualizando o Resenha…', 'Aguarde um instante para concluir.'],
    unavailable: ['Não foi possível verificar agora', 'Você pode abrir a versão instalada e tentar depois.'],
    error: ['Não conseguimos atualizar agora', 'Tente novamente ou baixe a nova versão pelo site.'],
    recovery: ['A atualização anterior não foi concluída', 'Abra a versão instalada para continuar.'],
    manual: ['Nova versão disponível', 'Baixe a nova versão pelo site para continuar.']
  };
  // Animações: o texto troca com um deslize quando a fase muda e a porcentagem conta até o valor novo.
  let lastPhase = null, shownPercent = 0, tween = 0;
  function swapText() { const c = document.querySelector?.('.status-copy'); if (!c) return; c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap'); }
  const raf = globalThis.requestAnimationFrame, caf = globalThis.cancelAnimationFrame || (() => {});
  function countTo(target) {
    caf(tween); if (!raf) { shownPercent = target; $('percent').textContent = target + '%'; return; } const from = shownPercent, t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 450), v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))); shownPercent = v; $('percent').textContent = v + '%'; if (k < 1) tween = raf(step); };
    tween = raf(step);
  }
  function render(state) {
    const phase = state.phase || 'checking', message = descriptions[phase] || descriptions.checking;
    if (phase !== lastPhase) { if (lastPhase) swapText(); lastPhase = phase; }
    const error = ['unavailable', 'error', 'recovery', 'manual'].includes(phase);
    document.body.dataset.phase = phase; document.body.dataset.error = String(error);
    $('launcher-status').textContent = message[0]; $('description').textContent = phase === 'downloading' && state.info?.version ? 'Transferindo o pacote ' + state.info.version : message[1];
    if (phase === 'unavailable' && state.required) $('description').textContent = 'Uma atualização já foi encontrada. Tente novamente para continuar.';
    if (phase === 'unavailable' && state.skipped) { $('launcher-status').textContent = 'Não foi possível atualizar agora'; $('description').textContent = 'Você pode continuar usando esta versão' + (state.offerDownload ? ' ou baixar a nova pelo site.' : '.'); }
    $('version').textContent = state.version ? 'Versão instalada ' + state.version : '';
    $('channel').textContent = state.info?.version ? 'Nova versão: ' + state.info.version : state.channel === 'preview' ? 'Canal de previews' : 'Canal estável';
    const determined = phase === 'downloading' && Number(state.totalBytes) > 0;
    const percent = Math.max(0, Math.min(100, Number(state.percent) || 0));
    $('progress').hidden = error || phase === 'opening'; $('progress').classList.toggle('indeterminate', !determined);
    $('progress').setAttribute('aria-label', phase === 'downloading' ? 'Download da atualização' : message[0]);
    if (determined) { $('progress').setAttribute('aria-valuemin', '0'); $('progress').setAttribute('aria-valuemax', '100'); $('progress').setAttribute('aria-valuenow', String(percent)); }
    else $('progress').removeAttribute('aria-valuenow');
    $('fill').style.width = determined ? percent + '%' : '';
    const mb = bytes => (bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    $('bytes').textContent = phase === 'downloading' && Number(state.downloadedBytes) >= 0 ? mb(state.downloadedBytes) + ' MB' + (determined ? ' de ' + mb(state.totalBytes) + ' MB' : '') : '';
    if (determined) countTo(percent); else { caf(tween); shownPercent = 0; $('percent').textContent = ''; }
    $('open').hidden = !state.canOpen || phase === 'opening'; $('open').textContent = 'Abrir Resenha';
    $('download').hidden = !(state.required && ['error', 'manual'].includes(phase)) && !(phase === 'unavailable' && state.offerDownload);
    $('retry').hidden = !['unavailable', 'error', 'recovery'].includes(phase);
    $('close').disabled = phase === 'applying'; $('close').title = phase === 'applying' ? 'Aguarde a conclusão desta etapa' : 'Fechar janela';
    $('details').hidden = !error || !state.error; $('error').textContent = state.error || '';
  }
  $('open').onclick = () => native.action('open'); $('retry').onclick = () => native.action('retry'); $('close').onclick = () => native.action('close');
  $('download').onclick = () => native.action('download');
  const unsubscribe = native.onState(render); window.addEventListener('beforeunload', unsubscribe, { once: true });
  native.ready().then(state => { if (state) render(state); }).catch(error => render({ phase: 'error', error: error.message }));
})();
