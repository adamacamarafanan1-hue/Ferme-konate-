/* ---------- Installation sur le téléphone, fonctionnement sans réseau, rappels sonores ---------- */
var INSTALL=null;
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();INSTALL=e;if(!moi())rendre();else majBandeaux()});
window.addEventListener("appinstalled",function(){INSTALL=null;toast("Application installée");majBandeaux()});
function boutonInstaller(){return INSTALL?'<button class="btn sec" style="margin-top:16px" data-act="installer">'+IC.telephone+' Installer l\'application sur ce téléphone</button>':''}
function installer(){if(!INSTALL)return;INSTALL.prompt();INSTALL.userChoice.then(function(){INSTALL=null;rendre()},function(){})}
/* Mises à jour : le téléphone vérifie la nouvelle version à chaque ouverture et se recharge tout seul */
var VERSION_APP="2026.11.17-1";
if("serviceWorker" in navigator&&location.protocol!=="file:"){window.addEventListener("load",function(){
  var avait=!!navigator.serviceWorker.controller,recharge=false;
  navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(function(reg){
    reg.update().catch(function(){});
    document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")reg.update().catch(function(){})});
  }).catch(function(){});
  navigator.serviceWorker.addEventListener("controllerchange",function(){if(avait&&!recharge&&!V.F){recharge=true;location.reload()}});
})}

/* Son : il faut un premier toucher de l'écran pour que le téléphone accepte de jouer un son */
var AUDIO=null;
function debloquerSon(){try{AUDIO=AUDIO||new (window.AudioContext||window.webkitAudioContext)();if(AUDIO.state==="suspended")AUDIO.resume()}catch(e){}}
document.addEventListener("pointerdown",debloquerSon,{passive:true});
function sonner(fois,aigu){
  if(!AUDIO)return;try{var t=AUDIO.currentTime+0.05;
  for(var i=0;i<fois;i++){var o=AUDIO.createOscillator(),g=AUDIO.createGain();o.type="sine";o.frequency.value=aigu?1046:784;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.5,t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+0.32);
    o.connect(g);g.connect(AUDIO.destination);o.start(t);o.stop(t+0.34);t+=0.45}}catch(e){}
}
function notifier(titre,texte,fois,aigu){
  sonner(fois||3,aigu);try{if(navigator.vibrate)navigator.vibrate([300,150,300,150,300])}catch(e){}
  toast(titre+" — "+texte);
  try{if(window.Notification&&Notification.permission==="granted"&&navigator.serviceWorker)navigator.serviceWorker.ready.then(function(r){r.showNotification(titre,{body:texte,icon:"icone-192.png",badge:"icone-badge.png",tag:titre,renotify:true,vibrate:[300,150,300]})})}catch(e){}
}
/* À l'heure de chaque ramassage (commercial), puis 30 min après si rien n'est saisi (commercial et DG) */
function verifierRappels(){
  var u=moi();if(!u||u.role==="gest"||!D)return;
  var d=auj(),m=maintenantMin(),cle="fermeKonate.rappels."+d,fait=lireLS(cle,{}),change=false;
  RAMS.forEach(function(r){
    var hr=heureRam(r);if(!hr)return;var h=minutesDe(hr),manque=D.reglages.comps.filter(function(c){return !ramSaisi(c.id,d,r)});
    if(!manque.length)return;
    if(u.role==="com"&&m>=h&&m<h+15&&!fait["h"+r]){fait["h"+r]=1;change=true;notifier("Ramassage "+r+" · "+heureRamFr(r),"C'est l'heure du ramassage. Saisissez les alvéoles de chaque bâtiment.",3)}
    var lim=h+n0(D.reglages.margeRam);
    if(m>=lim&&m<lim+90&&!fait["r"+r]){fait["r"+r]=1;change=true;notifier("Ramassage "+r+" en retard",manque.map(function(c){return c.court}).join(" et ")+" : rien n'est saisi.",5,true)}
  });
  if(change)ecrireLS(cle,fait);
}
setInterval(verifierRappels,30000);
function bandeauxTelephone(){
  var u=moi(),h="";if(!u)return "";
  if(u.role!=="gest"&&window.Notification&&Notification.permission==="default"&&!lireLS("fermeKonate.notifPlusTard",false))
    h+='<div class="bandeau b-action">'+IC.alerte+'<span>Recevoir un son et une notification à l\'heure de chaque ramassage et en cas de retard.</span><span class="b-btns"><button class="btn petit" data-act="notif">Activer</button><button class="btn sec petit" data-act="notifNon">Plus tard</button></span></div>';
  if(INSTALL)h+='<div class="bandeau b-action">'+IC.telephone+'<span>Installez l\'application : elle s\'ouvre comme les autres, même sans réseau.</span><span class="b-btns"><button class="btn petit" data-act="installer">Installer</button></span></div>';
  var M=typeof mesEnvois==="function"?mesEnvois().filter(function(o){return o.k!=="up"}):[];
  if(M.length){var nv=M.filter(function(o){return o.l==="ventes"}).length;
    h+='<div class="bandeau b-refus">'+IC.alerte+'<span><b>'+M.length+' saisie'+(M.length>1?"s":"")+' pas encore envoyée'+(M.length>1?"s":"")+'</b>'+(nv?' (dont '+nv+' vente'+(nv>1?"s":"")+')':'')+'. Le DG ne les voit pas encore. Gardez l\'application ouverte avec du réseau.</span><span class="b-btns"><button class="btn petit" data-act="envoyerMaint">Envoyer maintenant</button></span></div>'}
  if(ETAT.rejets.length)h+='<div class="bandeau b-refus">'+IC.alerte+'<span><b>Saisie non acceptée.</b> '+esc(ETAT.rejets[ETAT.rejets.length-1])+'</span><span class="b-btns"><button class="btn sec petit" data-act="okRejet">J\'ai compris</button></span></div>';
  return h;
}
function majBandeaux(){var b=document.getElementById("bandeaux");if(b)b.innerHTML=bandeauxTelephone()}
function demanderNotif(){
  debloquerSon();sonner(1);
  if(!window.Notification)return toast("Les notifications ne sont pas possibles sur ce téléphone. Le son marche quand l'application est ouverte.");
  Notification.requestPermission().then(function(p){toast(p==="granted"?"Rappels activés":"Rappels sonores seulement quand l'application est ouverte");majBandeaux()});
}
IC.telephone='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>';
