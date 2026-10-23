// Web-only adaptation. Desktop capture and playback paths are not changed here.
export function initMobile(R) {
 const {S,V,settings}=R, $=s=>document.querySelector(s);
 const toolbar=document.createElement('div');toolbar.id='mobile-tools';
 toolbar.innerHTML='<p id="mobile-hint"></p><div class="mobile-actions"><button id="web-unlock">Ativar / retomar áudio</button><button id="web-mic-device">Microfone</button><button id="web-diagnostic">Diagnóstico</button></div><small id="web-quality" aria-live="polite">Entre em um canal para ouvir e assistir.</small>';
 $('#call').insertBefore(toolbar,$('#call-stage'));
 const hint=$('#mobile-hint');
 hint.textContent=R.WEB_VOICE?'Use fone. Deixe a tela ligada: bloquear ou trocar de app pode pausar a call.':'Modo sem microfone. Para falar, abra o link HTTPS do anfitrião e configure o certificado local.';
 const controls=document.createElement('details');controls.id='mobile-participants';controls.innerHTML='<summary>Pessoas, volumes e lives</summary><div id="web-people"></div>';
 $('#sidebar').appendChild(controls);
 const livebar=document.createElement('div');livebar.id='mobile-live';$('#call').appendChild(livebar);
 // 1.6: the composer has its own send button (#btn-send) on every platform.
 const vv=window.visualViewport;
 function resize(){document.documentElement.style.setProperty('--web-height',`${vv?.height||innerHeight}px`);document.documentElement.style.setProperty('--web-top',`${vv?.offsetTop||0}px`);}
 vv?.addEventListener('resize',resize);vv?.addEventListener('scroll',resize);window.addEventListener('resize',resize);resize();
 let wake=null,wakeBusy=false,wakeWanted=false,recovering=false,interrupted=false;
 async function updateWake(force=false){
  const wanted=V.joined&&!document.hidden;
  if(!wanted){wakeWanted=false;if(wake){await wake.release().catch(()=>{});wake=null;}return;}
  if(wake||wakeBusy||(!force&&wakeWanted)||!navigator.wakeLock)return;
  wakeWanted=true;wakeBusy=true;
  try {wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>{wake=null;});if(!V.joined||document.hidden){await wake.release();wake=null;}}
  catch{}finally{wakeBusy=false;}
 }
 async function resumeAudio(){
  if(recovering)return;recovering=true;
  try {
   await R.ensureAudio();
   if(V.ctx?.state!=='running') await V.ctx.resume();
   if(V.joined&&R.WEB_VOICE&&(!V.raw||V.raw.getAudioTracks().some(t=>t.readyState==='ended'))){await R.openMic();R.setMuted(V.muted,true);}
   for(const p of V.peers.values())if(['failed','disconnected'].includes(p.pc.iceConnectionState))p.pc.restartIce();
   interrupted=V.ctx?.state!=='running'||V.raw?.getAudioTracks().some(t=>t.muted||t.readyState==='ended');
   if(interrupted)R.toast('Toque novamente para liberar o áudio.');
   await updateWake(true);
  }catch(e){interrupted=true;R.toast('Áudio interrompido: toque para retomar. '+e.message,'err');}finally{recovering=false;}
 }
 $('#web-unlock').onclick=resumeAudio;
 document.addEventListener('click',e=>{
  if(e.target.closest('#text-channels [data-ch]')&&!e.target.closest('[data-edit]'))$('#main').dataset.mobilePane='chat';
  if(e.target.closest('#voice-channels [data-vch]')&&!e.target.closest('[data-edit]'))$('#main').dataset.mobilePane='call';
 });
 $('#web-mic-device').disabled=!R.WEB_VOICE;
 $('#web-mic-device').onclick=async()=>{
  try {if(!V.joined){R.toast('Entre em um canal de voz primeiro.');return;}
   const devices=await navigator.mediaDevices.enumerateDevices();
   const select=document.createElement('select');select.setAttribute('aria-label','Escolher microfone');
   const def=document.createElement('option');def.value='default';def.textContent='Microfone padrão';select.appendChild(def);
   for(const d of devices.filter(d=>d.kind==='audioinput'&&d.deviceId!=='default')){const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||'Microfone';select.appendChild(o);}
   select.value=settings.inputDevice;select.onchange=async()=>{settings.inputDevice=select.value;R.saveSettings();try{await R.openMic();R.setMuted(V.muted,true);}catch(e){R.toast('Não foi possível trocar o microfone: '+e.message,'err');}};
   $('#web-device-select')?.remove();select.id='web-device-select';toolbar.appendChild(select);select.focus();
  }catch(e){R.toast(e.message,'err');}
 };
 document.addEventListener('visibilitychange',()=>{updateWake(true);if(!document.hidden&&V.joined)resumeAudio();});
 navigator.mediaDevices?.addEventListener?.('devicechange',()=>{if(V.joined)resumeAudio();});
 window.addEventListener('online',()=>{if(V.joined)resumeAudio();});
 const watchedTracks=new WeakSet();
 let lastPeople='',lastLive='';
 function button(text,fn){const b=document.createElement('button');b.textContent=text;b.onclick=fn;return b;}
 function slider(label,value,onchange){const wrap=document.createElement('label');wrap.textContent=label;const range=document.createElement('input');range.type='range';range.min=0;range.max=200;range.value=value;range.setAttribute('aria-label',label);const out=document.createElement('output');out.textContent=value+'%';range.oninput=()=>{out.textContent=range.value+'%';onchange(+range.value)};wrap.append(range,out);return wrap;}
 function people(){
  const users=[...S.users.values()].filter(u=>u.voiceChannel===V.channel&&u.id!==S.myId);
  const signature=JSON.stringify([V.channel,users.map(u=>[u.id,u.name,u.sharing,u.muted,u.deafened]),[...V.watching]]);
  if(signature===lastPeople)return;lastPeople=signature;
  const root=$('#web-people');root.replaceChildren();
  for(const u of users){const row=document.createElement('div');row.className='web-person';const title=document.createElement('strong');title.textContent=u.name+(u.deafened?' · sem áudio':u.muted?' · mutado':'');row.appendChild(title);
   row.appendChild(slider('Volume de '+u.name,settings.userVolumes[u.name]??100,v=>{settings.userVolumes[u.name]=v;R.saveSettings();R.applyUserVolume(u.id)}));
   if(u.id!=='dj-resenha')row.appendChild(button('Mensagem privada',()=>R.openDM(u.id)));
   if(u.sharing)row.appendChild(button(V.watching.has(u.id)?'Sair da transmissão':'Entrar na transmissão',()=>{R.setWatching(u.id,!V.watching.has(u.id));$('#main').dataset.mobilePane='call';}));
   root.appendChild(row);
  }
 }
 async function fullscreen(video){
  if(!video)return R.toast('Aguardando o vídeo da live.');
  try{if(video.parentElement.parentElement.requestFullscreen)await video.parentElement.parentElement.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else R.toast('Tela cheia indisponível; gire o celular para ampliar.');}
  catch{try{if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else R.toast('Tela cheia indisponível neste navegador.');}catch{R.toast('Não foi possível entrar em tela cheia.');}}
 }
 function lives(){
  const sig=JSON.stringify([...V.watching]);if(sig===lastLive)return;lastLive=sig;livebar.replaceChildren();
  for(const [uid] of V.watching){const u=S.users.get(uid);if(!u)continue;const row=document.createElement('div');row.className='web-live-controls';
   row.appendChild(slider('Som da live de '+u.name,settings.streamVolumes[u.name]??100,v=>{settings.streamVolumes[u.name]=v;R.saveSettings();R.applyUserVolume(uid)}));
   const video=()=>[...document.querySelectorAll('.tile')].find(t=>t.dataset.key==='screen:'+uid)?.querySelector('video');
   row.appendChild(button('Tela cheia',()=>fullscreen(video())));
   const pip=button('Picture-in-Picture',async()=>{try{const v=video();if(v?.requestPictureInPicture)await v.requestPictureInPicture();else if(v?.webkitSetPresentationMode)v.webkitSetPresentationMode('picture-in-picture');else R.toast('Picture-in-Picture indisponível.');}catch{R.toast('Picture-in-Picture não disponível para esta live.');}});row.appendChild(pip);
   row.appendChild(button('Sair da live',()=>R.setWatching(uid,false)));livebar.appendChild(row);
  }
 }
 let samples=[],previous=new Map(),sampling=false;
 async function sample(){
  if(sampling||document.hidden||!V.joined)return;sampling=true;
  try{const media=[];let peerIndex=0;
   for(const p of V.peers.values()){const i=peerIndex++,stats=await p.pc.getStats();media.push({peer:i,type:'state',connection:p.pc.connectionState,ice:p.pc.iceConnectionState});
    stats.forEach(s=>{if(s.type==='inbound-rtp'&&(s.kind==='audio'||s.kind==='video')){
     const old=previous.get(p.uid+':'+s.id);const row={peer:i,type:s.type,kind:s.kind,packetsLost:s.packetsLost,jitter:s.jitter,framesPerSecond:s.framesPerSecond,framesDecoded:s.framesDecoded,framesDropped:s.framesDropped,totalDecodeTime:s.totalDecodeTime};
     if(old&&s.packetsReceived>=old.received){const lost=Math.max(0,(s.packetsLost||0)-old.lost),received=s.packetsReceived-old.received;row.intervalLossPercent=lost+received?100*lost/(lost+received):null;}
     previous.set(p.uid+':'+s.id,{received:s.packetsReceived,lost:s.packetsLost||0});media.push(row);
    }if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated)media.push({peer:i,type:'connection',rtt:s.currentRoundTripTime});});
   }
   samples.push({at:Date.now(),context:V.ctx?.state,muted:V.muted,deafened:V.deafened,media});if(samples.length>120)samples.shift();
   const video=media.find(x=>x.kind==='video'),rtt=media.find(x=>x.type==='connection')?.rtt;
   $('#web-quality').textContent=`${V.peers.size} conexões · RTT ${rtt==null?'—':Math.round(rtt*1000)+' ms'}${video?' · vídeo '+(video.framesPerSecond??'—')+' fps · perda '+(video.intervalLossPercent==null?'—':video.intervalLossPercent.toFixed(1)+'%'):''}`;
  }catch{}finally{sampling=false;}
 }
 $('#web-diagnostic').onclick=()=>{const blob=new Blob([JSON.stringify({version:S.serverVersion||'1.4.0-preview.11',client:'web',secureContext:window.isSecureContext,userAgent:navigator.userAgent,samples},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='resenha-mobile-desempenho.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 setInterval(()=>{
  people();lives();updateWake();
  for(const b of document.querySelectorAll('[data-mobile-pane]'))b.classList.toggle('active',b.dataset.mobilePane===$('#main').dataset.mobilePane);
  for(const el of document.querySelectorAll('.channel,.vu,.ou'))if(!el.dataset.webKeyboard){el.dataset.webKeyboard='1';el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.target===el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el.click();}});}

  if(!V.joined){previous.clear();$('#web-quality').textContent='Fora do canal · entre para ouvir e assistir.';return;}
  for(const t of V.raw?.getAudioTracks()||[])if(!watchedTracks.has(t)){watchedTracks.add(t);t.addEventListener('ended',()=>{interrupted=true;});t.addEventListener('mute',()=>{interrupted=true;});t.addEventListener('unmute',()=>{interrupted=false;});}
  const stopped=interrupted||V.ctx?.state!=='running'||V.raw?.getAudioTracks().some(t=>t.muted||t.readyState==='ended');
  $('#web-unlock').textContent=stopped?'Áudio interrompido · toque para retomar':'Retomar áudio';
 },1000);
 setInterval(sample,3000);
 window.addEventListener('pagehide',()=>{wake?.release().catch(()=>{});});
}
