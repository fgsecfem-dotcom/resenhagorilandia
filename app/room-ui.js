// Presentation only. Room, command, media and persistence protocols stay in client.js.
export function boundedPosition(x, y, width, height, viewportWidth, viewportHeight) {
  return { x: Math.max(12, Math.min(x, Math.max(12, viewportWidth - width - 12))), y: Math.max(12, Math.min(y, Math.max(12, viewportHeight - height - 12))) };
}

// Fit the received picture inside the stage without cropping or stretching it.
export function fitLiveFrame(sourceWidth, sourceHeight, width, height) {
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) return null;
  const ratio = [sourceWidth, sourceHeight].every(n => Number.isFinite(n) && n > 0) ? sourceWidth / sourceHeight : 16 / 9;
  const w = Math.min(width, height * ratio);
  return { width: w, height: w / ratio };
}

export function installLiveFrame(tile) {
  let video = null, parent = null, disposed = false;
  const resize = new ResizeObserver(refresh);
  function refresh() {
    if (disposed) return;
    const nextVideo = tile.querySelector('video');
    if (video !== nextVideo) {
      if (video) for (const event of ['loadedmetadata', 'resize']) video.removeEventListener(event, refresh);
      video = nextVideo;
      if (video) for (const event of ['loadedmetadata', 'resize']) video.addEventListener(event, refresh);
    }
    const nextParent = tile.parentElement?.classList.contains('focus-main') ? tile.parentElement : null;
    if (parent !== nextParent) { resize.disconnect(); parent = nextParent; if (parent) resize.observe(parent); }
    if (!parent || !video) { tile.style.width = ''; tile.style.height = ''; return; }
    if (document.fullscreenElement === tile) return;
    const style = getComputedStyle(tile);
    const bx = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const by = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const fit = fitLiveFrame(video.videoWidth, video.videoHeight, parent.clientWidth - bx, parent.clientHeight - by);
    if (fit) { tile.style.width = (fit.width + bx) + 'px'; tile.style.height = (fit.height + by) + 'px'; }
  }
  document.addEventListener('fullscreenchange', refresh);
  tile.refreshFrame = refresh;
  tile.disposeFrame = () => {
    disposed = true; resize.disconnect(); document.removeEventListener('fullscreenchange', refresh);
    if (video) for (const event of ['loadedmetadata', 'resize']) video.removeEventListener(event, refresh);
    delete tile.refreshFrame; delete tile.disposeFrame;
  };
  refresh();
}

export function createRoomUI({ icon, openDM, contacts, onDMVisible, onResize, liveVolume, setLiveVolume }) {
  const $ = (s, r = document) => r.querySelector(s);
  const main = $('#main'), chat = $('#chat');
  document.body.classList.add('layout-next');
  main.dataset.rightOpen = 'false'; chat.dataset.view = 'chat';
  const nav = document.createElement('nav'); nav.className = 'right-nav'; nav.setAttribute('aria-label', 'Conversa');
  nav.innerHTML = `<button data-right="chat" aria-pressed="true">Chat</button><button data-right="dm" aria-pressed="false">DMs <span class="dm-count hidden"></span></button><button class="right-close" title="Fechar painel" aria-label="Fechar painel">${icon('x',18)}</button>`;
  chat.prepend(nav);
  const dmHost = document.createElement('div'); dmHost.className = 'right-dm';
  dmHost.innerHTML = '<div class="dm-contacts"></div><div class="dm-view-host"></div>';
  chat.append(dmHost);
  const sidebarButton = document.createElement('button'); sidebarButton.id = 'sidebar-toggle'; sidebarButton.className = 'icon-btn';
  sidebarButton.setAttribute('aria-controls','channels'); sidebarButton.setAttribute('aria-expanded','true'); sidebarButton.setAttribute('aria-label','Recolher canais e pessoas'); sidebarButton.title='Recolher canais e pessoas'; sidebarButton.textContent='‹';
  $('.side-brand').append(sidebarButton);
  sidebarButton.onclick=()=>{
    const compact=main.dataset.sidebarCompact!=='true'; main.dataset.sidebarCompact=String(compact);
    sidebarButton.setAttribute('aria-expanded',String(!compact));sidebarButton.setAttribute('aria-label',compact?'Expandir canais e pessoas':'Recolher canais e pessoas');sidebarButton.title=sidebarButton.getAttribute('aria-label');sidebarButton.textContent=compact?'›':'‹';onResize();
  };
  const peopleButton=document.createElement('button');peopleButton.id='participants-toggle';peopleButton.className='participants-toggle hidden';peopleButton.setAttribute('aria-expanded','true');
  $('#call-stage').after(peopleButton);
  let peopleHidden=false;
  peopleButton.onclick=()=>{peopleHidden=!peopleHidden;main.dataset.peopleHidden=String(peopleHidden);peopleButton.setAttribute('aria-expanded',String(!peopleHidden));updatePeople();onResize();
    const strip=$('.focus-strip');let done=false;const settle=()=>{if(done)return;done=true;onResize();document.querySelectorAll('.tile.is-screen').forEach(tile=>tile.refreshFrame?.());};strip?.addEventListener('transitionend',e=>{if(e.target===strip&&e.propertyName==='height')settle();},{once:false});setTimeout(settle,520);};
  function updatePeople(){const strip=$('.focus-strip');peopleButton.classList.toggle('hidden',!strip);peopleButton.textContent=(peopleHidden?'Mostrar participantes':'Ocultar participantes')+(strip?' · '+strip.children.length:'');}
  const stageObserver=new MutationObserver(()=>{updatePeople();document.querySelectorAll('.tile.is-screen').forEach(tile=>tile.refreshFrame?.());});stageObserver.observe($('#call-stage'),{childList:true,subtree:true});
  function open(view='chat'){
    main.dataset.rightOpen='true';chat.dataset.view=view;
    nav.querySelectorAll('[data-right]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.right===view)));
    if(view==='dm')onDMVisible();onResize();
  }
  function close(){main.dataset.rightOpen='false';onResize();}
  nav.querySelectorAll('[data-right]').forEach(b=>b.onclick=()=>open(b.dataset.right));$('.right-close',nav).onclick=close;
  function isDMVisible(){return main.dataset.rightOpen==='true'&&chat.dataset.view==='dm'&&!main.classList.contains('hidden');}
  function updateUnread(unread){
    const count=$('.dm-count',nav); count.textContent=String(unread.size);count.classList.toggle('hidden',!unread.size);
    $('[data-right="dm"]',nav).setAttribute('aria-label',unread.size?`DMs, ${unread.size} conversas não lidas`:'DMs');
    // Also visible with the right panel closed.
    const shortcut=$('#sidebar-dms');if(shortcut){shortcut.title=unread.size?`Mensagens privadas · ${unread.size} conversas não lidas`:'Mensagens privadas';shortcut.setAttribute('aria-label',shortcut.title);$('.dm-count',shortcut).textContent=unread.size||'';$('.dm-count',shortcut).classList.toggle('hidden',!unread.size);}
    const list=$('.dm-contacts',dmHost);list.replaceChildren();
    for(const u of contacts()){
      const b=document.createElement('button');b.className='dm-contact';b.textContent=u.name+(unread.has(u.id)?' · Nova':'');b.onclick=()=>openDM(u.id);list.append(b);
    }
    if(!list.children.length)list.textContent='Seus amigos aparecem aqui enquanto estiverem na sala.';
  }
  const dmShortcut=document.createElement('button');dmShortcut.id='sidebar-dms';dmShortcut.className='friend-row';dmShortcut.innerHTML=`${icon('chat',20)}<span class="side-dm-label">Mensagens privadas</span><span class="dm-count hidden"></span>`;dmShortcut.onclick=()=>open('dm');$('#friends-list').before(dmShortcut);
  function dmModal(html,{onClose}={}){
    const el=document.createElement('section');el.className='dm-view';el.innerHTML=html;
    const host=$('.dm-view-host',dmHost);host.replaceChildren(el);dmHost.classList.add('has-conversation');open('dm');
    let closed=false;
    const close=()=>{if(closed)return;closed=true;el.remove();dmHost.classList.remove('has-conversation');onClose?.();};
    el.querySelectorAll('[data-close]').forEach(b=>{b.onclick=close;b.setAttribute('aria-label','Voltar às conversas privadas');});
    return {el,close};
  }
  const floatingState={position:null,draft:''};
  function floatingModal(html,{onClose}={}){
    const el=document.createElement('section');el.className='floating-dj modal dj-modal';el.setAttribute('role','dialog');el.setAttribute('aria-modal','false');el.setAttribute('aria-label','DJ Resenha');el.innerHTML=html;document.body.append(el);
    const header=$('header',el);header.tabIndex=0;header.title='Arraste para mover · setas ajustam · Home restaura';header.setAttribute('aria-label',header.title);
    let drag=null,positioned=false,closed=false;
    const place=(x,y)=>{const r=el.getBoundingClientRect(),p=boundedPosition(x,y,r.width,r.height,innerWidth,innerHeight);Object.assign(el.style,{left:p.x+'px',top:p.y+'px',right:'auto',bottom:'auto'});positioned=true;};
    const reset=()=>{for(const k of ['left','top','right','bottom'])el.style[k]='';positioned=false;};
    const resetButton=document.createElement('button');resetButton.className='icon-btn';resetButton.innerHTML=icon('maximize',16);resetButton.title='Restaurar posição do DJ';resetButton.setAttribute('aria-label',resetButton.title);resetButton.onclick=()=>{floatingState.position=null;reset();};header.insertBefore(resetButton,$('[data-close]',header));
    if($('#dj-in',el))$('#dj-in',el).value=floatingState.draft;
    if(floatingState.position)place(floatingState.position.x,floatingState.position.y);
    const release=e=>{if(drag?.id!==e.pointerId)return;drag=null;delete el.dataset.dragging;if(header.hasPointerCapture(e.pointerId))header.releasePointerCapture(e.pointerId);};
    header.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,input,a'))return;e.preventDefault();const r=el.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};header.setPointerCapture(e.pointerId);el.dataset.dragging='true';header.focus();});
    header.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)place(e.clientX-drag.x,e.clientY-drag.y);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(type,release);
    const resize=()=>{if(positioned){const r=el.getBoundingClientRect();place(r.left,r.top);}};window.addEventListener('resize',resize);
    const contentResize=new ResizeObserver(resize);contentResize.observe(el);
    const previous=document.activeElement;
    const close=()=>{if(closed)return;closed=true;const r=el.getBoundingClientRect();floatingState.position=positioned?{x:r.left,y:r.top}:null;floatingState.draft=$('#dj-in',el)?.value||'';const restore=el.contains(document.activeElement);window.removeEventListener('resize',resize);contentResize.disconnect();el.remove();onClose?.();if(previous?.isConnected&&restore)previous.focus();};
    el.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
    el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();return;}if(e.target!==header)return;if(e.key==='Home'){e.preventDefault();reset();return;}const n=e.shiftKey?40:16,d={ArrowLeft:[-n,0],ArrowRight:[n,0],ArrowUp:[0,-n],ArrowDown:[0,n]}[e.key];if(d){e.preventDefault();const r=el.getBoundingClientRect();place(r.left+d[0],r.top+d[1]);}});
    return {el,close};
  }
  // Side names remain discoverable when compact; never expand on hover.
  const titles=new MutationObserver(()=>{
    $('#channels').querySelectorAll('.channel,.vu,.ou,.friend-row').forEach(el=>{el.title=el.textContent.trim();});
  });titles.observe($('#channels'),{childList:true,subtree:true});
  function updateLive(tile,u,self,watching,people=[]){
    if(!tile.refreshFrame)installLiveFrame(tile);
    queueMicrotask(()=>tile.refreshFrame?.());
    let meta=$('.live-meta',tile);
    if(!meta){meta=document.createElement('div');meta.className='live-meta';meta.innerHTML='<button class="live-back" title="Sair da tela cheia">'+icon('chevronLeft',18)+'<span>Voltar à sala</span></button><div class="live-identity"><span class="live-initial"></span><div class="live-who"><strong></strong><span class="live-sub"></span></div><span class="live-badge">AO VIVO</span></div><div class="live-people" aria-label="Pessoas na call"></div>';tile.append(meta);$('.live-back',meta).onclick=e=>{e.stopPropagation();document.exitFullscreen().catch(()=>{});};}
    meta.classList.toggle('hidden',!watching);$('.live-initial',meta).textContent=(u.name||'?').slice(0,1).toUpperCase();$('.live-initial',meta).style.backgroundColor=u.color||'';$('strong',meta).textContent=self?'Sua tela':u.name;
    $('.live-sub',meta).textContent=[$('#call-title').textContent,$('#call-count').textContent].filter(Boolean).join(' · ');
    // Faces of the call: rebuilt only when the list changes; speaking state is toggled by refreshSpeaking().
    const strip=$('.live-people',meta),sig=people.map(p=>[p.id,p.name,p.color,p.avatar?1:0,p.muted?1:0].join(':')).join('|');
    if(strip.dataset.sig!==sig){strip.dataset.sig=sig;strip.replaceChildren(...people.map(p=>{const card=document.createElement('div');card.className='live-person';card.dataset.uid=p.id;const face=document.createElement('span');face.className='live-face';if(p.avatar)face.style.backgroundImage=`url("${p.avatar}")`;else{face.style.backgroundColor=p.color||'';face.textContent=(p.name||'?').slice(0,1).toUpperCase();}const name=document.createElement('span');name.className='live-person-name';name.textContent=p.name;if(p.muted)name.prepend(Object.assign(document.createElement('span'),{className:'live-muted',innerHTML:icon('micOff',12)}));card.append(face,name);return card;}));}
    const tools=$('.tile-tools',tile);if(!watching)return;
    // Controls may be kept between renders: add each extra element once and refresh its text.
    const mic=$('[data-live-mic]',tools);if(mic){const label=$('.live-mic-name',mic)||mic.appendChild(Object.assign(document.createElement('span'),{className:'live-mic-name'}));label.textContent=$('#up-name').textContent;}
    const name=$('.streamer-name',tools)||tools.insertBefore(Object.assign(document.createElement('span'),{className:'streamer-name'}),tools.firstChild);name.textContent=u.name;
    if(!self&&!$('.live-volume',tools)){const volume=document.createElement('label');volume.className='live-volume';volume.innerHTML=icon('volume',16)+'<input type="range" min="0" max="200" step="1" aria-label="Volume da transmissão"><output></output>';const input=$('input',volume),output=$('output',volume);input.value=liveVolume(u);output.textContent=input.value+'%';const fill=()=>volume.style.setProperty('--p',(input.value/2)+'%');fill();input.oninput=()=>{output.textContent=input.value+'%';fill();setLiveVolume(u,Number(input.value));};volume.addEventListener('pointerdown',e=>e.stopPropagation());volume.addEventListener('click',e=>e.stopPropagation());tools.insertBefore(volume,$('[data-stop]',tools));}
  }
  return {open,close,isDMVisible,dmModal,floatingModal,updateUnread,updatePeople,updateLive,reset(){close();},dispose(){stageObserver.disconnect();titles.disconnect();}};
}
