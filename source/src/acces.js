/* ---------- Connexion par code (6 chiffres) ---------- */
function points(n,total){var h='<div class="pin-pts">';for(var i=0;i<total;i++)h+='<i class="'+(i<n?"on":"")+'"></i>';return h+'</div>'}
function clavier(act,eff,ret,libRet){
  var h='<div class="clavier">';[1,2,3,4,5,6,7,8,9].forEach(function(n){h+='<button data-act="'+act+'" data-v="'+n+'">'+n+'</button>'});
  return h+'<button class="fn" data-act="'+ret+'">'+libRet+'</button><button data-act="'+act+'" data-v="0">0</button><button class="fn" data-act="'+eff+'">Effacer</button></div>';
}
function enteteFerme(){var R=D.reglages;return '<div class="photo" style="background-image:url('+PHOTO+')"><div class="t"><h1>'+esc((EQUIPE&&EQUIPE.ferme)||R.ferme)+'</h1><p>'+esc((EQUIPE&&EQUIPE.lieu)||R.lieu)+'</p></div></div>'}
function vueConnexion(){
  var eq=(EQUIPE&&EQUIPE.equipe)||[],h=enteteFerme()+'<div class="connexion">';
  if(V.msgConnexion)h+='<div class="bandeau" style="margin-bottom:12px">'+esc(V.msgConnexion)+'</div>';
  var u=eq.find(function(x){return x.id===V.choixUser});
  if(!u){
    if(!EQUIPE){
      h+=navigator.onLine===false?'<div class="bandeau">Pas de réseau. La première connexion sur ce téléphone demande du réseau.</div><button class="btn" style="margin-top:14px" data-act="reessayer">Réessayer</button>'
        :'<p class="aide" style="text-align:center;margin-top:24px">Connexion au serveur de la ferme…</p><button class="btn sec" style="margin-top:14px" data-act="reessayer">Réessayer</button>';
      return h+boutonInstaller()+'</div>';
    }
    h+='<h2 style="margin-top:6px">Qui êtes-vous ?</h2><div class="users">';
    eq.forEach(function(x){h+='<button data-act="choixUser" data-v="'+x.id+'"><span class="avatar">'+esc(initiales(x.nom))+'</span><span><b>'+esc(x.nom)+'</b><small>'+(x.role==="dg"?"Directeur général":ROLES[ROLE_APP[x.role]])+'</small></span></button>'});
    return h+'</div><p class="aide" style="text-align:center">Votre nom n\'est pas là ? Seul le DG peut vous ajouter.</p>'+boutonInstaller()+'<p class="version">Version '+VERSION_APP+'</p></div>';
  }
  h+='<h2 style="margin-top:6px;text-align:center">Bonjour '+esc(prenom(u.nom))+'</h2><p class="aide" style="text-align:center">Tapez votre code secret (6 chiffres)</p>'+points(V.pin.length,6);
  h+='<p class="pin-msg" role="status">'+(V.attente?"Vérification…":V.erreurPin?'<span class="rouge">'+esc(V.erreurPin)+'</span>':"&nbsp;")+'</p>';
  return h+clavier("pin","pinEff","pinRetour","Retour")+'</div>';
}
/* Le DG remplace son code de départ avant tout le reste */
function vueNouveauCode(){
  var e2=(V.nc1||"").length===6,cur=e2?(V.nc2||""):(V.nc1||"");
  var h=enteteFerme()+'<div class="connexion"><h2 style="margin-top:6px;text-align:center">'+(e2?"Confirmez votre code":"Choisissez votre code secret")+'</h2>';
  h+='<p class="aide" style="text-align:center">'+(e2?"Tapez le même code une deuxième fois.":"Le code de départ doit être remplacé. Choisissez 6 chiffres que vous seul connaissez.")+'</p>'+points(cur.length,6);
  h+='<p class="pin-msg" role="status">'+(V.attente?"Enregistrement…":V.erreurPin?'<span class="rouge">'+esc(V.erreurPin)+'</span>':"&nbsp;")+'</p>';
  return h+clavier("nc","ncEff","ncRetour",e2?"Recommencer":"Sortir")+'</div>';
}
function codeFaible(c){return /^(\d)\1{5}$/.test(c)||c==="123456"||c==="654321"}
function codeAuHasard(){
  var c="";do{var a=new Uint32Array(1);(window.crypto||window.msCrypto).getRandomValues(a);c=String(a[0]%1000000);while(c.length<6)c="0"+c}while(codeFaible(c));return c;
}
function codeLisible(c){return String(c).replace(/^(\d{3})(\d{3})$/,"$1 $2")}

/* ---------- Équipe (réservé au DG) ---------- */
function vueEquipe(){
  var h='<div class="dg-note">'+IC.salaires+'<span><b>Vous seul gérez l\'équipe.</b> Vous ajoutez les personnes, vous leur donnez leur code et vous pouvez bloquer quelqu\'un à tout moment : il est sorti de l\'application tout de suite, même si son téléphone est ouvert.</span></div>';
  h+='<div class="bloc"><ul class="hist equipe">';
  D.users.slice().sort(function(a,b){var o={proprio:0,com:1,gest:2};return o[a.role]-o[b.role]}).forEach(function(u){var dg=u.role==="proprio";
    h+='<li class="'+(u.bloque?"bloque":"")+'"><span class="avatar">'+esc(initiales(u.nom))+'</span><span class="x"><b>'+esc(u.nom)+'</b><small>'+(dg?"Directeur général · gère l'équipe":ROLES[u.role])+(u.bloque?' · <span class="rouge">bloqué</span>':' · actif')+'</small>';
    h+='<span class="eq-btns"><button class="btn sec petit" data-act="ouvrir" data-v="codeUser" data-id="'+u.id+'">'+(dg?"Changer mon code":"Changer le code")+'</button>';
    if(!dg)h+=(u.bloque?'<button class="btn vert petit" data-act="bloquer" data-id="'+u.id+'">Débloquer</button>':'<button class="btn dang petit" data-act="bloquer" data-id="'+u.id+'">Bloquer</button>')+'<button class="btn sec petit" data-act="supprUser" data-id="'+u.id+'">Retirer</button>';
    h+='</span></span></li>'});
  /* Le formulaire garde ce qui est déjà tapé (nom, rôle, code) même quand l'écran se met à jour */
  var lire=function(sel){var e=document.querySelector(sel);return e?e.value:null};
  if(V.viderAjout){V.viderAjout=false;V.codePropose=null}
  else{var dn=lire("#uNom"),dp=lire("#uPin"),dr=lire('form[data-f="user"] input[name="role"]');if(dn!==null){V.ajNom=dn;V.ajRole=dr||"com";if(dp)V.codePropose=dp}}
  if(!V.codePropose)V.codePropose=codeAuHasard();
  var nomA=V.viderNom?"":(V.ajNom||""),roleA=V.ajRole||"com";if(V.viderNom){V.viderNom=false;V.ajNom="";V.ajRole="com";roleA="com"}
  h+='</ul></div><h3>Ajouter une personne</h3><form class="bloc" data-f="user"><div class="champ"><label for="uNom">Nom</label><input id="uNom" name="nom" required minlength="2" maxlength="40" autocomplete="off" placeholder="Ex. : Laye" value="'+esc(nomA)+'"></div><div class="champ"><span class="etiq">Rôle</span><div class="chips" data-groupe="role">';
  [["com","Commercial"],["gest","Technicien"]].forEach(function(r){h+='<button type="button" class="chip '+(r[0]===roleA?"on":"")+'" data-act="chipForm" data-v="'+r[0]+'">'+r[1]+'</button>'});
  h+='</div><input type="hidden" name="role" value="'+roleA+'"></div><div class="champ"><label for="uPin">Son code secret (6 chiffres)</label><input id="uPin" name="pin" inputmode="numeric" maxlength="6" required autocomplete="off" value="'+esc(V.codePropose)+'" style="font-size:26px;letter-spacing:6px"><span class="hint">Ce code ne change pas tant que vous n\'avez pas touché « Ajouter ». Notez-le et donnez-le en main propre.</span></div><button class="btn">Ajouter</button></form>';
  if(navigator.onLine===false)h+='<p class="aide">Il faut du réseau pour ajouter, bloquer ou changer un code.</p>';
  return h;
}
function actionEquipe(action,corps,msgOk,apres){
  if(!estDG())return toast("Réservé au DG");
  toast("Envoi…");
  return fonction(action,corps,true).then(function(j){
    return Promise.all([recharger(),chargerEquipe()]).then(function(){if(apres)apres(j);else toast(msgOk);rendre()});
  },function(e){toast(e&&e.message||"Action impossible")});
}

/* ---------- Saisie d'un jour passé (DG seulement, signalée « après coup ») ---------- */
function ligneDate(){
  var F=V.F;if(!estDG()||!F||/^(achat|versement|encaisser)$/.test(F.type))return bandeauDate();
  if(!F.changerDate)return bandeauDate()+'<p class="aide" style="margin:-6px 0 12px"><button class="lien" data-act="changerDate">Saisir pour un jour passé</button></p>';
  return '<div class="champ"><label for="jourPasse">Jour de la saisie</label><input id="jourPasse" type="date" data-k="date" value="'+esc(F.date)+'" max="'+auj()+'" min="'+decal(auj(),-120)+'"><span class="hint">Une saisie faite après coup est marquée comme telle dans le journal.</span></div>';
}

/* ---------- Rappels de vaccins chez le technicien ---------- */
function rappelsVaccins(d){
  var L=D.vaccins.filter(function(v){return v.rappel&&!v.fait}).map(function(v){return {v:v,j:Math.round((new Date(v.rappel+"T12:00:00")-new Date(d+"T12:00:00"))/864e5)}}).filter(function(x){return x.j<=3}).sort(function(a,b){return a.j-b.j});
  if(!L.length)return "";
  return L.map(function(x){var v=x.v,ret=x.j<0;
    return '<div class="alerte '+(ret?"":"info")+'"><b>'+(ret?"Rappel de vaccin en retard":"Rappel de vaccin "+(x.j===0?"aujourd'hui":"dans "+x.j+" jour"+(x.j>1?"s":"")))+' :</b> '+esc(v.vaccin)+' ('+esc(comp(v.comp).court)+'), prévu le '+dateCourte(v.rappel)+'. <button class="btn vert petit" style="margin-top:8px" data-act="rappelFait" data-id="'+v.id+'" data-d="'+v.date+'">Rappel fait</button></div>'}).join("");
}
