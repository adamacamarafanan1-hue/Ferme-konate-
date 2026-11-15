"use strict";


var PHOTO="ferme.jpg";
/* =====================================================================
   DONNÉES — base Supabase « ferme-konate », partagée en direct entre les téléphones.
   Chaque saisie est d'abord gardée sur le téléphone (file d'attente), puis envoyée
   dès qu'il y a du réseau. Les règles de sécurité sont dans la base : un rôle ne
   peut lire et écrire que ce qui le concerne, rien n'est jamais effacé.
   ===================================================================== */
var CFG={url:"https://tlufonmkkfqfajtmlhcn.supabase.co",cle:"sb_publishable_3-Vu_J92Z2CofA5S5IuK_A_5Ra2Ndlv"};
var CLE_CACHE="fermeKonate.sb.cache", CLE_OUT="fermeKonate.sb.attente", CLE_PROFIL="fermeKonate.sb.profil", CLE_EQUIPE="fermeKonate.sb.equipe", CLE_SESSION="fermeKonate.sb.profil";
var COMPS=[
  {id:"B1",court:"Bât. 1",nom:"Bâtiment 1"},
  {id:"B2",court:"Bât. 2",nom:"Bâtiment 2"}
];
function NR(){return D.reglages.comps.length*4}
/* Liste de l'application → table de la base */
var TABLES={comptages:"comptages_poules",mouv:"mouvements_poules",malades:"malades",vaccins:"vaccins",prod:"ramassages",ventes:"ventes",regl:"paiements_credits",dep:"depenses",alimIn:"achats_aliment",alimOut:"aliment_donne",vers:"versements"};
var LISTES=Object.keys(TABLES);
var LISTE_DE={};LISTES.forEach(function(l){LISTE_DE[TABLES[l]]=l});
var ROLES={proprio:"DG",gest:"Technicien",com:"Commercial"};
var ROLE_APP={dg:"proprio",technicien:"gest",commercial:"com"}, ROLE_BASE={proprio:"dg",gest:"technicien",com:"commercial"};
var CATS=[["Aliment","aliment"],["Vaccins et médicaments","vaccin"],["Salaires","salaires"],["Eau","eau"],["Électricité","eclair"],["Carburant et transport","carburant"],["Réparations","outil"],["Alvéoles vides","boite"],["Autre","note"]];
var SIGNES=["Diarrhée","Toux ou rhume","Ne mange pas","Reste couchée","Plumes arrachées","Boite","Yeux gonflés","Autre"];
var VACCINS=["Newcastle","Gumboro","Bronchite","Variole","Vitamines","Vermifuge","Antibiotique"];
var TYPES_MOUV={arrivee:"Arrivée de poules",mort:"Poules mortes",vente:"Poules vendues",reforme:"Poules réformées"};
var RAMS=[1,2,3,4];
function nomRam(r){return "Ramassage "+r}

function lireLS(k,def){try{var r=localStorage.getItem(k);return r?JSON.parse(r):def}catch(e){return def}}
function ecrireLS(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function oterLS(k){try{localStorage.removeItem(k)}catch(e){}}
function cloner(o){return JSON.parse(JSON.stringify(o))}
function etatVide(){var r={};LISTES.forEach(function(l){r[l]={}});return {rows:r,reg:null,bats:null,profils:[],charge:0}}
var STATE=lireLS(CLE_CACHE,null)||etatVide();
LISTES.forEach(function(l){if(!STATE.rows[l])STATE.rows[l]={}});
var OUT=lireLS(CLE_OUT,[]);
var PROFIL=lireLS(CLE_PROFIL,null);           /* la personne connectée sur ce téléphone */
var EQUIPE=lireLS(CLE_EQUIPE,null);           /* liste « Qui êtes-vous ? » */
var SB=null, CANAL=null, MODE="attente", ETAT={recu:false,refus:false,horsLigne:false,rejets:[]};
var D;

/* ---------- Conversion base ⇄ application ---------- */
function num(v){return v==null?0:Number(v)}
function hm(t){return String(t||"").slice(0,5)}
function versApp(l,b){
  var x={id:b.id,date:b.jour,t:Date.parse(b.saisi_tel||b.saisi_le)||0,parId:b.saisi_par,par:nomDe(b.saisi_par),apres:!!b.apres_coup,modifie:b.modifie_le||null};
  var k=D&&D.reglages?D.reglages.oeufsAlv:30;
  if(l==="comptages"){x.comp=b.batiment_id;x.n=num(b.nombre)}
  else if(l==="prod"){x.comp=b.batiment_id;x.r=num(b.numero);x.alv=num(b.alveoles);x.plus=num(b.oeufs_plus);x.casses=num(b.casses);x.oeufs=x.alv*k+x.plus+x.casses}
  else if(l==="mouv"){x.comp=b.batiment_id;x.type=b.type;x.n=num(b.nombre);x.note=b.note||""}
  else if(l==="malades"){x.comp=b.batiment_id;x.n=num(b.nombre);x.signes=b.signes||"";x.trait=b.traitement||""}
  else if(l==="vaccins"){x.comp=b.batiment_id||"TOUS";x.vaccin=b.produit;x.rappel=b.rappel||"";x.fait=!!b.rappel_fait}
  else if(l==="alimOut"){x.comp=b.batiment_id;x.sacs=num(b.sacs)}
  else if(l==="alimIn"){x.sacs=num(b.sacs);x.montant=num(b.montant);x.recu=b.recu_chemin||""}
  else if(l==="dep"){x.cat=b.categorie;x.montant=num(b.montant);x.note=b.detail||"";x.imprevu=!!b.imprevu;x.recu=b.recu_chemin||"";x.auto=b.achat_aliment_id||""}
  else if(l==="ventes"){x.client=b.client;x.alv=num(b.alveoles);x.prix=num(b.prix_alveole);x.paye=num(b.paye)}
  else if(l==="regl"){x.vente=b.vente_id;x.montant=num(b.montant)}
  else if(l==="vers"){x.cycle=num(b.cycle);x.montant=num(b.montant);x.recu=b.recu_chemin||""}
  return x;
}
function entier(v){return Math.max(0,Math.round(n0(v)))}
function versBase(l,r){
  var b={},a=function(k,v){if(v!==undefined)b[k]=v};
  if("comp" in r)a("batiment_id",l==="vaccins"&&r.comp==="TOUS"?null:r.comp);
  if(l==="comptages"){a("nombre",r.n==null?undefined:entier(r.n))}
  else if(l==="prod"){if("r" in r)a("numero",r.r);if("alv" in r)a("alveoles",entier(r.alv));if("plus" in r)a("oeufs_plus",entier(r.plus));if("casses" in r)a("casses",entier(r.casses))}
  else if(l==="mouv"){a("type",r.type);if("n" in r)a("nombre",entier(r.n));if("note" in r)a("note",r.note||null)}
  else if(l==="malades"){if("n" in r)a("nombre",entier(r.n));a("signes",r.signes);if("trait" in r)a("traitement",r.trait||null)}
  else if(l==="vaccins"){a("produit",r.vaccin);if("rappel" in r)a("rappel",r.rappel||null);if("fait" in r)a("rappel_fait",!!r.fait)}
  else if(l==="alimOut"){if("sacs" in r)a("sacs",n0(r.sacs))}
  else if(l==="alimIn"){if("sacs" in r)a("sacs",n0(r.sacs));if("montant" in r)a("montant",entier(r.montant));if("recu" in r)a("recu_chemin",r.recu||null)}
  else if(l==="dep"){a("categorie",r.cat);if("montant" in r)a("montant",entier(r.montant));if("note" in r)a("detail",(r.note||"").trim()||null);if("imprevu" in r)a("imprevu",!!r.imprevu);if("recu" in r)a("recu_chemin",r.recu||null);if("auto" in r)a("achat_aliment_id",r.auto||null)}
  else if(l==="ventes"){if("client" in r)a("client",String(r.client||"").trim());if("alv" in r)a("alveoles",entier(r.alv));if("prix" in r)a("prix_alveole",entier(r.prix));if("paye" in r)a("paye",entier(r.paye))}
  else if(l==="regl"){a("vente_id",r.vente);if("montant" in r)a("montant",entier(r.montant))}
  else if(l==="vers"){if("cycle" in r)a("cycle",r.cycle);if("montant" in r)a("montant",entier(r.montant));if("recu" in r)a("recu_chemin",r.recu||null)}
  return b;
}
function nomDe(id){var p=(STATE.profils||[]).find(function(x){return x.id===id});return p?p.nom:(PROFIL&&PROFIL.id===id?PROFIL.nom:"")}
function reglagesApp(){
  var g=STATE.reg||{},bats=(STATE.bats&&STATE.bats.length?STATE.bats.slice().sort(function(a,b){return a.ordre-b.ordre}).map(function(b){return {id:b.id,court:b.court,nom:b.nom}}):cloner(COMPS));
  return {ferme:g.ferme||"Ferme avicole de M. Konaté",lieu:g.lieu||"Kankan",prix:num(g.prix_alveole||47000),oeufsAlv:num(g.oeufs_par_alveole||30),objectif:num(g.objectif_alveoles==null?80:g.objectif_alveoles),
    seuilPonte:num(g.seuil_ponte==null?70:g.seuil_ponte),seuilMorts:num(g.seuil_morts==null?5:g.seuil_morts),seuilAliment:num(g.seuil_aliment==null?5:g.seuil_aliment),heureFin:18,
    heuresRam:(g.heures_ramassage||["08:00","12:00","14:00","18:00"]).map(hm),margeRam:num(g.marge_retard_min==null?30:g.marge_retard_min),comps:bats,debutCycles:g.debut_cycles||"",joursCycle:num(g.jours_cycle||15)};
}

/* ---------- File d'attente appliquée par-dessus les données reçues ---------- */
function appliquer(rows,op){
  if(op.k==="ins"){rows[op.l][op.id]=Object.assign({saisi_par:PROFIL&&PROFIL.id,saisi_le:new Date().toISOString(),annule:false,apres_coup:false},op.row,{id:op.id})}
  else if(op.k==="maj"){var r=rows[op.l][op.id];if(r)rows[op.l][op.id]=Object.assign({},r,op.patch)}
  else if(op.k==="rpc"&&op.f==="marquer_rappel_fait"){var v=rows.vaccins[op.args.p_id];if(v)rows.vaccins[op.args.p_id]=Object.assign({},v,{rappel_fait:true})}
}
function construireD(){
  var rows=STATE.rows;
  if(OUT.some(function(o){return o.k==="ins"||o.k==="maj"||o.k==="rpc"})){rows={};LISTES.forEach(function(l){rows[l]=Object.assign({},STATE.rows[l])});OUT.forEach(function(o){appliquer(rows,o)})}
  var reg=STATE.reg;OUT.forEach(function(o){if(o.k==="cfg")STATE.reg=Object.assign({},STATE.reg||{},o.patch)});
  var bats=STATE.bats;OUT.forEach(function(o){if(o.k==="bat"&&STATE.bats)STATE.bats=STATE.bats.map(function(b){return b.id===o.id?Object.assign({},b,{nom:o.nom}):b})});
  D={reglages:reglagesApp(),users:(STATE.profils||[]).filter(function(p){return !p.retire}).map(function(p){return {id:p.id,nom:p.nom,role:ROLE_APP[p.role]||"gest",bloque:!!p.bloque,codeAChanger:!!p.code_a_changer}})};
  STATE.reg=reg;STATE.bats=bats;
  LISTES.forEach(function(l){D[l]=[];var m=rows[l];for(var id in m){var b=m[id];if(b&&!b.annule)D[l].push(versApp(l,b))}});
}
function enCache(){
  if(ecrireLS(CLE_CACHE,STATE))return;
  /* Mémoire pleine : on ne garde sur le téléphone que les 90 derniers jours (tout reste dans la base) */
  var lim=decal(auj(),-90),S=cloner(STATE);LISTES.forEach(function(l){for(var id in S.rows[l])if(S.rows[l][id].jour<lim)delete S.rows[l][id]});ecrireLS(CLE_CACHE,S);
}
function sauverOut(){if(!ecrireLS(CLE_OUT,OUT)){
  /* Trop lourd : les photos en attente passent en petite taille */
  OUT.forEach(function(o){if(o.k==="up"&&o.petit){o.data=o.petit;delete o.petit}});ecrireLS(CLE_OUT,OUT)}}

function idBrut(l,id){if(STATE.rows[l]&&STATE.rows[l][id])return true;return OUT.some(function(o){return o.k==="ins"&&o.l===l&&o.id===id})}

/* Écrire une saisie : visible tout de suite, puis envoyée dès que possible.
   rec=null : la saisie est annulée (jamais effacée). rec._brut : simple correction d'un champ. */
function ecrire(date,l,id,rec){
  var u=moi();if(!u){toast("Reconnectez-vous");return false}
  var op;
  if(rec===null)op={k:"maj",l:l,id:id,patch:{annule:true}};
  else if(l==="vaccins"&&rec._brut&&rec.fait)op={k:"rpc",f:"marquer_rappel_fait",args:{p_id:id}};
  else if(idBrut(l,id)){var r=Object.assign({},rec);delete r._brut;delete r.date;op={k:"maj",l:l,id:id,patch:versBase(l,r)}}
  else op={k:"ins",l:l,id:id,row:Object.assign(versBase(l,rec),{id:id,jour:date||auj(),saisi_tel:new Date().toISOString()})};
  OUT.push(op);sauverOut();construireD();vider();
  return true;
}
function ecrireConfig(){
  var R=D.reglages;
  OUT.push({k:"cfg",patch:{ferme:R.ferme,lieu:R.lieu,prix_alveole:entier(R.prix),oeufs_par_alveole:Math.max(1,entier(R.oeufsAlv)),objectif_alveoles:entier(R.objectif),seuil_ponte:Math.min(100,entier(R.seuilPonte)),seuil_morts:entier(R.seuilMorts),seuil_aliment:entier(R.seuilAliment),marge_retard_min:entier(R.margeRam),heures_ramassage:R.heuresRam.map(function(h){return h.length===5?h+":00":h}),debut_cycles:R.debutCycles||null,jours_cycle:Math.max(1,entier(R.joursCycle))}});
  R.comps.forEach(function(c){var b=(STATE.bats||[]).find(function(x){return x.id===c.id});if(b&&b.nom!==c.nom)OUT.push({k:"bat",id:c.id,nom:c.nom})});
  sauverOut();construireD();vider();
}

/* ---------- Envoi de la file d'attente ---------- */
function Definitif(m){this.message=m;this.definitif=true}
function classer(err,res){
  /* Erreur réseau : on réessaiera. Refus de la base : on retire la saisie et on prévient. */
  var st=res&&res.status,c=err&&err.code||"";
  if(!st&&!c)return {reseau:true};
  if(st===401||/JWT|jwt/.test(err&&err.message||""))return {session:true};
  if(c==="23505")return {doublon:true,cle:/_pkey/.test(err.message||"")};
  if(c==="42501")return new Definitif("Refusé : votre rôle ne permet pas cette saisie.");
  if(c==="23514")return new Definitif("Refusé : une valeur n'est pas valable.");
  if(c==="23503")return new Definitif("Refusé : la saisie liée n'existe plus.");
  if(st>=500||st===0)return {reseau:true};
  return new Definitif("Refusé par la base ("+(err&&err.message||st)+").");
}
function requete(p){return Promise.resolve(p).then(function(r){if(r&&r.error){throw classer(r.error,r)}return r},function(e){throw e&&(e.definitif||e.reseau||e.session||e.doublon)?e:{reseau:true}})}
function envoyer(op){
  if(op.k==="ins")return requete(SB.from(TABLES[op.l]).insert(op.row).select()).then(function(r){return r.data&&r.data[0]},function(e){
    if(e.doublon&&e.cle)return null; /* déjà arrivée (réponse perdue) */
    if(e.doublon)throw new Definitif(op.l==="prod"?"Ce ramassage était déjà saisi sur un autre téléphone : votre saisie n'a pas été gardée.":"Cette saisie existait déjà pour ce jour.");
    throw e});
  if(op.k==="maj")return requete(SB.from(TABLES[op.l]).update(op.patch).eq("id",op.id).select()).then(function(r){
    if(!r.data||!r.data.length)throw new Definitif(op.patch.annule?"Annulation refusée : seul le DG peut annuler cette saisie.":"Correction refusée : seul le DG peut corriger une saisie d'un autre jour ou d'une autre personne.");
    return r.data[0]});
  if(op.k==="rpc")return requete(SB.rpc(op.f,op.args)).then(function(){return null});
  if(op.k==="cfg")return requete(SB.from("reglages").update(op.patch).eq("id",true).select()).then(function(r){if(r.data&&r.data[0])STATE.reg=r.data[0];return null});
  if(op.k==="bat")return requete(SB.from("batiments").update({nom:op.nom}).eq("id",op.id).select()).then(function(r){if(r.data&&r.data[0])STATE.bats=STATE.bats.map(function(b){return b.id===op.id?r.data[0]:b});return null});
  if(op.k==="up")return fetch(op.data).then(function(x){return x.blob()}).then(function(bl){
    return SB.storage.from("recus").upload(op.path,bl,{contentType:"image/jpeg",upsert:false})}).then(function(r){
    if(r&&r.error){var s=r.error.statusCode||r.error.status;if(String(s)==="409"||/exist/i.test(r.error.message||""))return null;if(String(s)==="403"||String(s)==="400")throw new Definitif("La photo du reçu a été refusée.");throw {reseau:true}}
    PHOTOS_LOCALES[op.path]=op.petit||op.data;return null},function(e){throw e&&e.definitif?e:{reseau:true}});
  return Promise.resolve(null);
}
var envoiEnCours=false;
function vider(){
  if(!SB||envoiEnCours||!OUT.length||!PROFIL){majStatut();return}
  envoiEnCours=true;
  (function suivant(){
    if(!OUT.length){envoiEnCours=false;ETAT.horsLigne=false;majStatut();rafraichir();return}
    var op=OUT[0];
    envoyer(op).then(function(ligne){
      OUT.shift();sauverOut();
      if(ligne&&op.l){STATE.rows[op.l][ligne.id]=ligne;if(ligne.annule)delete STATE.rows[op.l][ligne.id];enCache()}
      ETAT.horsLigne=false;suivant();
    },function(e){
      if(e&&e.definitif){
        OUT.shift();
        /* Si une photo est refusée, la saisie qui l'attend reste valable */
        sauverOut();ETAT.rejets.push(e.message);toast(e.message);construireD();suivant();return}
      envoiEnCours=false;
      if(e&&e.session){SB.auth.refreshSession().then(function(r){if(r.error&&/refresh|banned|invalid|not found/i.test(r.error.message||""))perteSession();else setTimeout(vider,2000)},function(){ETAT.horsLigne=true;majStatut()})}
      else ETAT.horsLigne=true;
      majStatut();
    });
  })();
}

/* ---------- Réception : chargement complet puis écoute en direct ---------- */
function toutLire(table){
  var tout=[],pas=1000;
  return (function page(de){
    return requete(SB.from(table).select("*").order("id").range(de,de+pas-1)).then(function(r){
      tout=tout.concat(r.data||[]);return (r.data||[]).length===pas?page(de+pas):tout});
  })(0);
}
var chargeEnCours=null;
function recharger(){
  if(!SB||!PROFIL)return Promise.resolve();
  if(chargeEnCours)return chargeEnCours;
  var listes=LISTES.slice();
  chargeEnCours=Promise.all([toutLire("profils"),toutLire("reglages"),toutLire("batiments")].concat(listes.map(function(l){return lireAutorise(TABLES[l])}))).then(function(res){
    STATE.profils=res[0];STATE.reg=res[1][0]||STATE.reg;STATE.bats=res[2].length?res[2]:STATE.bats;
    listes.forEach(function(l,i){var m={};(res[i+3]||[]).forEach(function(b){if(!b.annule)m[b.id]=b});STATE.rows[l]=m});
    STATE.charge=Date.now();enCache();ETAT.recu=true;ETAT.horsLigne=false;chargeEnCours=null;
    var p=STATE.profils.find(function(x){return x.id===PROFIL.id});
    if(!p||p.bloque||p.retire){perteSession(p&&(p.bloque||p.retire)?"Accès bloqué par le DG.":"");return}
    if(p.code_a_changer!==PROFIL.code_a_changer||p.nom!==PROFIL.nom){PROFIL=Object.assign({},PROFIL,{code_a_changer:!!p.code_a_changer,nom:p.nom});ecrireLS(CLE_PROFIL,PROFIL)}
    construireD();rafraichir();vider();
  },function(e){chargeEnCours=null;if(e&&e.session){SB.auth.refreshSession().then(function(r){if(r.error&&/refresh|banned|invalid|not found/i.test(r.error.message||""))perteSession()})}ETAT.horsLigne=true;majStatut()});
  return chargeEnCours;
}
/* Une table que le rôle ne peut pas lire renvoie simplement une liste vide */
function lireAutorise(t){return toutLire(t).catch(function(e){if(e&&e.reseau)throw e;return []})}
var tRaf=null;
function plusTard(){clearTimeout(tRaf);tRaf=setTimeout(function(){construireD();rafraichir()},250)}
function ecouterDirect(){
  if(!SB||CANAL)return;
  CANAL=SB.channel("ferme-direct").on("postgres_changes",{event:"*",schema:"public"},function(ev){
    var t=ev.table,b=ev.new;if(!b||!b.id&&t!=="reglages")return;
    if(t==="profils"){var L=(STATE.profils||[]).filter(function(x){return x.id!==b.id});L.push(b);STATE.profils=L;
      if(PROFIL&&b.id===PROFIL.id&&(b.bloque||b.retire))return perteSession("Accès bloqué par le DG.")}
    else if(t==="reglages")STATE.reg=b;
    else if(t==="batiments"&&STATE.bats)STATE.bats=STATE.bats.map(function(x){return x.id===b.id?b:x});
    else{var l=LISTE_DE[t];if(!l)return;if(b.annule)delete STATE.rows[l][b.id];else STATE.rows[l][b.id]=b}
    enCache();plusTard();
  }).subscribe(function(st){
    if(st==="SUBSCRIBED"){ETAT.direct=true;recharger()}
    else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT"||st==="CLOSED"){ETAT.direct=false;majStatut()}
  });
}
function arreterEcoute(){if(CANAL&&SB){try{SB.removeChannel(CANAL)}catch(e){}}CANAL=null}

/* ---------- Connexion par code (fonction « acces » du serveur) ---------- */
function fonction(action,corps,avecJeton){
  var pre=avecJeton&&SB?SB.auth.getSession():Promise.resolve({data:{session:null}});
  return pre.then(function(r){
    var h={"Content-Type":"application/json",apikey:CFG.cle},s=r&&r.data&&r.data.session;
    if(avecJeton){if(!s)throw {message:"Reconnectez-vous pour faire cette action."};h.Authorization="Bearer "+s.access_token}
    return fetch(CFG.url+"/functions/v1/acces",{method:"POST",headers:h,body:JSON.stringify(Object.assign({action:action},corps||{}))}).then(function(res){
      return res.json().catch(function(){return {}}).then(function(j){if(!res.ok){var e={message:j.erreur||"Erreur du serveur.",status:res.status,info:j};throw e}return j})},
      function(){throw {message:"Pas de réseau. Réessayez quand le téléphone est connecté.",reseau:true}});
  });
}
function chargerEquipe(){
  return fonction("liste").then(function(j){EQUIPE=j;ecrireLS(CLE_EQUIPE,j);if(!moi())rendre();return j},function(){if(!moi())rendre()});
}
function entrer(id,code){
  return fonction("entrer",{id:id,code:code}).then(function(j){
    return SB.auth.setSession({access_token:j.session.access_token,refresh_token:j.session.refresh_token}).then(function(r){
      if(r.error)throw {message:"Connexion impossible, réessayez."};
      if(PROFIL&&PROFIL.id!==j.profil.id){STATE=etatVide();enCache();OUT=[];sauverOut()}
      PROFIL={id:j.profil.id,nom:j.profil.nom,role:j.profil.role,code_a_changer:!!j.profil.code_a_changer};ecrireLS(CLE_PROFIL,PROFIL);
      construireD();ecouterDirect();return recharger();
    });
  });
}
function perteSession(msg){
  arreterEcoute();
  var garde=OUT.filter(function(o){return o.k==="up"}).length;
  PROFIL=null;oterLS(CLE_PROFIL);
  if(SB)SB.auth.signOut({scope:"local"}).catch(function(){});
  V.choixUser=null;V.pin="";V.F=null;V.page="accueil";
  if(msg)V.msgConnexion=msg;
  construireD();rendre();chargerEquipe();
}
function sortir(){
  if(OUT.length&&!confirm(OUT.length+" saisie(s) ne sont pas encore envoyées. Si vous sortez maintenant, elles resteront sur ce téléphone et partiront à la prochaine connexion de la même personne. Sortir quand même ?"))return;
  arreterEcoute();PROFIL=null;oterLS(CLE_PROFIL);if(SB)SB.auth.signOut({scope:"local"}).catch(function(){});
  V.choixUser=null;V.pin="";V.page="accueil";rendre();window.scrollTo(0,0);chargerEquipe();
}

/* ---------- Photos des reçus (stockage privé « recus ») ---------- */
var PHOTOS_LOCALES={}, URLS_RECUS={}, aDemander={}, tUrl=null;
var PIXEL="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
OUT.forEach(function(o){if(o.k==="up")PHOTOS_LOCALES[o.path]=o.petit||o.data});
function srcRecu(x){
  if(!x||!x.recu)return "";
  if(PHOTOS_LOCALES[x.recu])return PHOTOS_LOCALES[x.recu];
  var u=URLS_RECUS[x.recu];if(u&&u.fin>Date.now())return u.url;
  aDemander[x.recu]=1;clearTimeout(tUrl);tUrl=setTimeout(demanderUrls,60);
  return PIXEL;
}
function demanderUrls(){
  var L=Object.keys(aDemander);aDemander={};if(!L.length||!SB)return;
  SB.storage.from("recus").createSignedUrls(L,3600).then(function(r){
    var ok=false;(r.data||[]).forEach(function(x){if(x.signedUrl){URLS_RECUS[x.path]={url:x.signedUrl,fin:Date.now()+3300e3};ok=true}});
    if(ok)rafraichir();
  },function(){});
}
function lireDataUrl(blob){return new Promise(function(ok,ko){var f=new FileReader();f.onload=function(){ok(f.result)};f.onerror=ko;f.readAsDataURL(blob)})}
/* La photo part avant la saisie (même file d'attente) : sans réseau, elle attend sur le téléphone */
function envoyerPhoto(F,suite){
  var btn=document.querySelector("[data-act=valider]");if(btn){btn.disabled=true;btn.textContent="Préparation de la photo…"}
  var chemin=PROFIL.id+"/"+uid()+".jpg";
  lireDataUrl(F.photo.blob).then(function(grand){
    OUT.push({k:"up",path:chemin,data:grand,petit:F.photo.data});sauverOut();
    PHOTOS_LOCALES[chemin]=F.photo.data;F.recu={chemin:chemin};suite();
  },function(){F.recu=null;F.photo=null;toast("Photo illisible : saisie sans reçu");suite()});
}
function champsRecu(F){return F.recu&&F.recu.chemin?{recu:F.recu.chemin}:{}}

/* ---------- Démarrage ---------- */
function demarrerPartage(){
  if(!window.supabase||!window.supabase.createClient){MODE="local";construireD();rendre();return}
  SB=window.supabase.createClient(CFG.url,CFG.cle,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"fermeKonate.auth"},realtime:{params:{eventsPerSecond:5}}});
  MODE="partage";
  SB.auth.onAuthStateChange(function(ev,s){if(ev==="SIGNED_OUT"&&PROFIL){perteSession()}});
  if(PROFIL){
    SB.auth.getSession().then(function(r){
      if(r&&r.data&&r.data.session){ecouterDirect();recharger();vider()}
      else if(r&&r.error&&!/fetch|network/i.test(r.error.message||""))perteSession();
      else {ETAT.horsLigne=true;majStatut()}
    },function(){ETAT.horsLigne=true;majStatut()});
  } else chargerEquipe();
  rendre();
}
setInterval(function(){if(OUT.length)vider()},15000);
setInterval(function(){if(PROFIL&&document.visibilityState==="visible")recharger()},300000);
/* Rafraîchit l'écran chaque minute pour faire apparaître les retards à l'heure */
setInterval(function(){var a=document.activeElement;if(!V.F&&D&&moi()&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))rendreApp()},60000);
window.addEventListener("online",function(){ETAT.horsLigne=false;vider();if(PROFIL)recharger();else chargerEquipe()});
window.addEventListener("offline",function(){ETAT.horsLigne=true;majStatut()});
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&PROFIL&&Date.now()-(STATE.charge||0)>60000){recharger();vider()}});


/* ================== OUTILS ================== */
function uid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=Array.prototype.map.call(b,function(x){return (x+256).toString(16).slice(1)}).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)}
function iso(dt){var z=new Date(dt.getTime()-dt.getTimezoneOffset()*60000);return z.toISOString().slice(0,10)}
function auj(){return iso(new Date())}
function decal(d,n){var x=new Date(d+"T12:00:00");x.setDate(x.getDate()+n);return iso(x)}
function n0(v){v=Number(String(v==null?"":v).replace(/\s/g,"").replace(",","."));return isFinite(v)?v:0}
function nb(v){return (Math.round(n0(v)*10)/10).toLocaleString("fr-FR")}
function gnf(v){return nb(Math.round(n0(v)))+" GNF"}
function pct(v){return isFinite(v)?Math.round(v*100)+" %":"–"}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function dateFr(d){if(!d)return"";var x=new Date(d+"T12:00:00");return x.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}
function dateCourte(d){if(!d)return"";if(d===auj())return"aujourd'hui";if(d===decal(auj(),-1))return"hier";var x=new Date(d+"T12:00:00");return x.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}
function heure(t){if(!t)return"";var x=new Date(t);return x.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
function comp(id){var c=D.reglages.comps;for(var i=0;i<c.length;i++)if(c[i].id===id)return c[i];return {id:id,court:id==="TOUS"?"Tous":id,nom:id}}
function somme(a,f){var s=0;for(var i=0;i<a.length;i++)s+=n0(f(a[i]));return s}
function initiales(n){return String(n).replace(/\(.*?\)/g,"").split(/\s+/).filter(function(x){return /^[A-Za-zÀ-ÿ]/.test(x)}).slice(0,2).map(function(x){return x[0]}).join("").toUpperCase()}
function prenom(n){var p=String(n).split(/\s+/);return p[0]==="Monsieur"||p[0]==="Madame"?n:p[0]}
var tToast;
function toast(t){var o=document.querySelector(".toast");if(o)o.remove();clearTimeout(tToast);var e=document.createElement("div");e.className="toast";e.textContent=t;document.body.appendChild(e);tToast=setTimeout(function(){e.remove()},3000)}
function vibrer(){try{if(navigator.vibrate)navigator.vibrate(35)}catch(e){}}
function moi(){if(!PROFIL||!D)return null;var u=D.users.find(function(x){return x.id===PROFIL.id});if(u)return u.bloque?null:u;return {id:PROFIL.id,nom:PROFIL.nom,role:ROLE_APP[PROFIL.role]||"gest"}}
/* Seul le DG gère l'équipe et les réglages */
function estDG(){var u=moi();return !!u&&u.role==="proprio"}

/* ================== CALCULS ================== */
function dernierComptage(c,d){var best=null;D.comptages.forEach(function(k){if(k.comp===c&&k.date<=d&&(!best||k.date>best.date||(k.date===best.date&&k.t>best.t)))best=k});return best}
function effectif(c,d){
  var base=dernierComptage(c,d),n=0;
  if(base)n=n0(base.n);
  D.mouv.forEach(function(m){if(m.comp!==c||m.date>d)return;if(base&&(m.date<base.date||(m.date===base.date&&m.t<=base.t)))return;n+=(m.type==="arrivee"?1:-1)*n0(m.n)});
  return n;
}
function effectifTotal(d){return somme(D.reglages.comps,function(c){return effectif(c.id,d)})}
function prodDe(c,d,r){return D.prod.filter(function(p){return p.date===d&&(!c||p.comp===c)&&(!r||p.r===r)})}
function oeufsJour(c,d,r){return somme(prodDe(c,d,r),function(p){return p.oeufs})}
function cassesJour(c,d,r){return somme(prodDe(c,d,r),function(p){return p.casses})}
function alvDe(o,ca){return Math.floor(Math.max(0,o-ca)/D.reglages.oeufsAlv)}
function ramSaisi(c,d,r){return D.prod.some(function(p){return p.date===d&&p.comp===c&&p.r===r})}
function prodSaisie(c,d){return D.prod.some(function(p){return p.date===d&&p.comp===c})}
function recMort(c,d){var l=D.mouv.filter(function(m){return m.type==="mort"&&m.comp===c&&m.date===d});return l.length?{n:somme(l,function(m){return m.n})}:null}
function mortsSaisis(c,d){return D.mouv.some(function(m){return m.type==="mort"&&m.date===d&&m.comp===c})}
function recAlim(c,d){var l=D.alimOut.filter(function(a){return a.comp===c&&a.date===d});return l.length?{sacs:somme(l,function(a){return a.sacs})}:null}
/* Avant d'enregistrer, retire les anciennes saisies du même jour pour ne pas compter deux fois */
function remplacer(l,date,garder,filtre){D[l].filter(function(x){return x.date===date&&x.id!==garder&&filtre(x)}).forEach(function(x){ecrire(x.date,l,x.id,null)})}
function alimSaisi(c,d){return D.alimOut.some(function(a){return a.date===d&&a.comp===c})}
function alimJour(c,d){return somme(D.alimOut.filter(function(a){return a.date===d&&(!c||a.comp===c)}),function(a){return a.sacs})}
function ponte(c,d){var e=c?effectif(c,d):effectifTotal(d);return e>0?oeufsJour(c,d)/e:NaN}
function ponteMoy7(c,d){var t=0,k=0;for(var i=1;i<=7;i++){var j=decal(d,-i);if(prodSaisie(c,j)){var v=ponte(c,j);if(isFinite(v)){t+=v;k++}}}return k?t/k:NaN}
function morts(c,d){return somme(D.mouv.filter(function(m){return m.type==="mort"&&m.date===d&&(!c||m.comp===c)}),function(m){return m.n})}
function stockOeufs(d){
  var net=somme(D.prod.filter(function(p){return p.date<=d}),function(p){return n0(p.oeufs)-n0(p.casses)});
  return net-somme(D.ventes.filter(function(v){return v.date<=d}),function(v){return v.alv})*D.reglages.oeufsAlv;
}
function stockAlv(d){return Math.floor(Math.max(0,stockOeufs(d))/D.reglages.oeufsAlv)}
function venteTotal(v){return n0(v.alv)*n0(v.prix)}
function venteReste(v){return Math.max(0,venteTotal(v)-n0(v.paye)-somme(D.regl.filter(function(x){return x.vente===v.id}),function(x){return x.montant}))}
function encaisseJour(d){return somme(D.ventes.filter(function(v){return v.date===d}),function(v){return v.paye})+somme(D.regl.filter(function(r){return r.date===d}),function(r){return r.montant})}
function creditsTotal(){return somme(D.ventes,venteReste)}
function depJour(d){return somme(D.dep.filter(function(x){return x.date===d}),function(x){return x.montant})}
function stockAliment(d){return somme(D.alimIn.filter(function(a){return a.date<=d}),function(a){return a.sacs})-somme(D.alimOut.filter(function(a){return a.date<=d}),function(a){return a.sacs})}
function ramFaits(d){var f=0;D.reglages.comps.forEach(function(c){RAMS.forEach(function(r){if(ramSaisi(c.id,d,r))f++})});return f}
/* Un ramassage est signalé manquant si un ramassage suivant a déjà été saisi ailleurs, ou après l'heure de fin, ou pour un jour passé */
function minutesDe(hm){var p=String(hm||"0:0").split(":");return n0(p[0])*60+n0(p[1])}
function heureRam(r){return (D.reglages.heuresRam||[])[r-1]||""}
function heureRamFr(r){var h=heureRam(r);if(!h)return"";var p=h.split(":");return n0(p[0])+" h"+(p[1]&&p[1]!=="00"?" "+p[1]:"")}
function maintenantMin(){var x=new Date();return x.getHours()*60+x.getMinutes()}
/* En retard : l'heure du ramassage (plus le délai) est passée et rien n'est saisi */
function ramEnRetard(c,d,r){if(ramSaisi(c,d,r))return false;if(d<auj())return true;if(d>auj())return false;var h=heureRam(r);return !!h&&maintenantMin()>=minutesDe(h)+n0(D.reglages.margeRam)}
function ramManquants(d){
  var R=D.reglages,max=0,out=[];
  R.comps.forEach(function(c){RAMS.forEach(function(r){if(ramSaisi(c.id,d,r)&&r>max)max=r})});
  R.comps.forEach(function(c){RAMS.forEach(function(r){if(!ramSaisi(c.id,d,r)&&(ramEnRetard(c.id,d,r)||r<max))out.push({c:c,r:r})})});
  return out;
}
function tachesJour(d){var t=0,f=0;D.reglages.comps.forEach(function(c){RAMS.forEach(function(r){t++;if(ramSaisi(c.id,d,r))f++});t+=2;if(mortsSaisis(c.id,d))f++;if(alimSaisi(c.id,d))f++});return {total:t,faites:f}}

function alertes(d){
  var R=D.reglages,out=[];
  if(!D.comptages.length)out.push({k:"info",t:"<b>Nombre de poules à saisir.</b> Dans l\'onglet Technicien, touchez « Modifier » sur chaque bâtiment."});
  var mq=ramManquants(d);if(mq.length)out.push({k:"alerte",t:"<b>"+mq.length+" ramassage"+(mq.length>1?"s":"")+" en retard :</b> "+mq.map(function(x){return x.c.court+" ramassage "+x.r}).join(", ")+"."});
  R.comps.forEach(function(c){
    var e=effectif(c.id,d);
    if(ramSaisi(c.id,d,4)&&e>0){
      var p=ponte(c.id,d),m=ponteMoy7(c.id,d);
      if(p*100<R.seuilPonte)out.push({k:"alerte",t:"<b>"+c.court+" : ponte faible ("+pct(p)+").</b> Le seuil fixé est de "+R.seuilPonte+" %."});
      else if(isFinite(m)&&p<m-0.10)out.push({k:"alerte",t:"<b>"+c.court+" : ponte en baisse.</b> "+pct(p)+" aujourd'hui contre "+pct(m)+" en moyenne sur 7 jours."});
    }
    var mo=morts(c.id,d);if(mo>=R.seuilMorts)out.push({k:"alerte",t:"<b>"+c.court+" : "+nb(mo)+" poules mortes.</b> Prévenir le vétérinaire."});
    if(e<0)out.push({k:"alerte",t:"<b>"+c.court+" : nombre de poules négatif.</b> Corrigez le nombre de poules."});
  });
  var s=stockOeufs(d);if(s<0)out.push({k:"alerte",t:"<b>Écart de stock :</b> "+nb(-s)+" œufs vendus de plus que ceux ramassés. À vérifier avec le commercial."});
  D.malades.filter(function(m){return m.date===d}).forEach(function(m){out.push({k:"alerte",t:"<b>"+nb(m.n)+" poule"+(m.n>1?"s":"")+" malade"+(m.n>1?"s":"")+" dans "+comp(m.comp).court+" :</b> "+esc(m.signes)+"."})});
  D.vaccins.forEach(function(v){if(v.rappel&&!v.fait){var j=Math.round((new Date(v.rappel+"T12:00:00")-new Date(d+"T12:00:00"))/864e5);
    var bt=' <button class="btn vert petit" style="margin-top:8px" data-act="rappelFait" data-id="'+v.id+'" data-d="'+v.date+'">Rappel fait</button>';
    if(j<0)out.push({k:"alerte",t:"<b>Vaccin en retard :</b> "+esc(v.vaccin)+" ("+esc(comp(v.comp).court)+"), prévu le "+dateCourte(v.rappel)+"."+bt});
    else if(j<=3)out.push({k:"info",t:"<b>Vaccin à faire "+(j===0?"aujourd'hui":"dans "+j+" jour"+(j>1?"s":""))+" :</b> "+esc(v.vaccin)+" ("+esc(comp(v.comp).court)+")."+bt})}});
  if((D.alimIn.length||D.alimOut.length)&&stockAliment(d)<=R.seuilAliment)out.push({k:"alerte",t:"<b>Il reste peu d'aliment :</b> "+nb(stockAliment(d))+" sacs."});
  return out;
}

/* ================== RAPPORTS ================== */
function rapportSoir(d){
  var R=D.reglages,L=[];
  L.push("*"+R.ferme+"*");L.push("Rapport du "+dateFr(d));L.push("");
  L.push(resumePhrases({deb:d,fin:d,mois:false,lib:dateFr(d)}).join(" "));L.push("");L.push("*Les chiffres en détail*");L.push("");L.push("*Alvéoles par bâtiment*");
  R.comps.forEach(function(c){var o=oeufsJour(c.id,d),ca=cassesJour(c.id,d),m=morts(c.id,d);
    L.push(c.court+" ("+nb(effectif(c.id,d))+" poules) : "+nb(alvDe(o,ca))+" alvéoles, ponte "+pct(ponte(c.id,d))+(m?", "+nb(m)+" mortes":""));
    L.push("   Ramassages : "+RAMS.map(function(r){return ramSaisi(c.id,d,r)?nb(alvDe(oeufsJour(c.id,d,r),cassesJour(c.id,d,r))):"–"}).join(" / ")+" alvéoles")});
  var o=oeufsJour(null,d),ca=cassesJour(null,d);
  L.push("Total : "+nb(alvDe(o,ca))+" alvéoles = "+gnf(alvDe(o,ca)*n0(R.prix))+", "+nb(effectifTotal(d))+" poules");
  var mqR=ramManquants(d);L.push("Ramassages faits : "+ramFaits(d)+" sur "+(R.comps.length*4)+(mqR.length?" (manquants : "+mqR.map(function(x){return x.c.court+" n°"+x.r}).join(", ")+")":""));
  L.push("");L.push("*Ventes et caisse*");
  var vs=D.ventes.filter(function(v){return v.date===d});
  L.push("Alvéoles vendues : "+nb(somme(vs,function(v){return v.alv})));
  L.push("Montant des ventes : "+gnf(somme(vs,venteTotal)));
  L.push("Argent encaissé : "+gnf(encaisseJour(d)));
  L.push("Crédits clients : "+gnf(creditsTotal()));
  L.push("");L.push("*Dépenses* : "+gnf(depJour(d)));
  D.dep.filter(function(x){return x.date===d}).forEach(function(x){L.push("- "+x.cat+(x.imprevu?" (imprévu)":"")+" : "+gnf(x.montant)+(x.note?" – "+x.note:""))});
  L.push("");L.push("*Stock* : "+nb(stockAlv(d))+" alvéoles"+(D.alimIn.length?" ; aliment : "+nb(stockAliment(d))+" sacs":""));
  var a=alertes(d).filter(function(x){return x.k==="alerte"});
  if(a.length){L.push("");L.push("*Alertes*");a.forEach(function(x){L.push("- "+x.t.replace(/<button[\s\S]*?<\/button>/g,"").replace(/<[^>]+>/g,"").trim())})}
  return L.join("\n");
}
function bilanMois(m){
  var R=D.reglages,jours=[],d=m+"-01";
  while(d.slice(0,7)===m){jours.push(d);d=decal(d,1)}
  var dans=function(x){return x.date.slice(0,7)===m};
  var prod=D.prod.filter(dans),ventes=D.ventes.filter(dans),dep=D.dep.filter(dans),mouv=D.mouv.filter(dans);
  var oeufs=somme(prod,function(p){return p.oeufs}),casses=somme(prod,function(p){return p.casses});
  var tauxs=jours.filter(function(j){return D.prod.some(function(p){return p.date===j})}).map(function(j){return ponte(null,j)}).filter(isFinite);
  var enc=somme(ventes,function(v){return v.paye})+somme(D.regl.filter(dans),function(r){return r.montant});
  var parCat={};dep.forEach(function(x){parCat[x.cat]=(parCat[x.cat]||0)+n0(x.montant)});
  var totDep=somme(dep,function(x){return x.montant});
  return {jours:jours,parJour:jours.map(function(j){return oeufsJour(null,j)}),oeufs:oeufs,casses:casses,alv:alvDe(oeufs,casses),
    taux:tauxs.length?somme(tauxs,function(t){return t})/tauxs.length:NaN,alvVendues:somme(ventes,function(v){return v.alv}),ventes:somme(ventes,venteTotal),enc:enc,
    parCat:parCat,dep:totDep,imprevus:somme(dep.filter(function(x){return x.imprevu}),function(x){return x.montant}),
    morts:somme(mouv.filter(function(x){return x.type==="mort"}),function(x){return x.n}),benef:enc-totDep};
}

/* ================== ICÔNES ================== */
var ICO={
  reglages:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  sortie:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  fermer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  retour:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
};

/* ================== ÉTAT DE L'ÉCRAN ================== */
var V={page:"accueil",vueProprio:"ferme",date:auj(),mois:auj().slice(0,7),sousReglages:"equipe",choixUser:null,pin:"",F:null,toutDirect:false,toutesAlertes:false,mesOuvert:false,periode:"jour",details:false,menuP:"alv",ouvertP:undefined,jourOuvert:null,cycleOuvert:null};

function statutHtml(){
  if(MODE==="local")return '<span class="statut"><span class="point"></span>Données sur ce téléphone</span>';
  if(MODE==="attente")return '<span class="statut"><span class="point"></span>Connexion…</span>';
  if(!ETAT.recu&&!STATE.charge)return '<span class="statut"><span class="point orange"></span>Connexion…</span>';
  if(OUT.length)return '<span class="statut"><span class="point orange"></span>'+OUT.length+' saisie'+(OUT.length>1?"s":"")+' en attente de réseau</span>';
  if(ETAT.horsLigne)return '<span class="statut"><span class="point orange"></span>Pas de réseau</span>';
  return '<span class="statut"><span class="point vert"></span>En direct</span>';
}
function majStatut(){var s=document.getElementById("statut");if(s)s.innerHTML=statutHtml();majBandeaux()}

/* ================== RENDU ================== */
function rafraichir(){if(!moi()){if(!V.F)rendre();return}rendreApp();if(V.F&&/^(rapport|bilan|tab|d[A-Z]\w*)$/.test(V.F.type))rendreFeuille()}
function rendre(){rendreApp();rendreFeuille()}
function rendreApp(){
  var app=document.getElementById("app"),u=moi(),y=window.scrollY;
  if(!u){app.innerHTML=vueConnexion();return}
  if(PROFIL&&PROFIL.code_a_changer&&u.role==="proprio"){app.innerHTML=vueNouveauCode();return}
  var corps;
  if(V.page==="reglages"&&u.role==="proprio")corps=vueReglages();
  else if(u.role==="proprio"){var vp=V.vueProprio;corps='<div class="vue-choix" role="tablist">'+[["ferme","Ma ferme"],["com","Écran du commercial"],["gest","Écran du technicien"]].map(function(x){return '<button role="tab" data-act="vueP" data-v="'+x[0]+'" class="'+(vp===x[0]?"on":"")+'">'+x[1]+'</button>'}).join("")+'</div>'+(vp!=="ferme"?'<div class="bandeau-vue">'+IC.salaires+'<span>Vous voyez ce que voit votre '+(vp==="com"?"commercial":"technicien")+'. Vous pouvez aussi saisir à sa place. <button class="lien" data-act="vueP" data-v="ferme">Revenir à ma ferme</button></span></div>':'')+(vp==="com"?vueCommercial(true):vp==="gest"?vueGestion(true):vueFerme())}
  else if(u.role==="gest")corps=vueGestion();
  else corps=vueCommercial();
  var h='<header class="barre"><div class="in"><h1>'+esc(D.reglages.ferme)+'<small>'+esc(u.nom)+' · '+ROLES[u.role]+'</small><span id="statut">'+statutHtml()+'</span></h1>';
  if(u.role==="proprio"&&V.page!=="reglages")h+='<button class="ico" data-act="page" data-v="reglages" aria-label="Réglages">'+ICO.reglages+'</button>';
  h+='<button class="ico" data-act="sortir" aria-label="Changer d\'utilisateur">'+ICO.sortie+'</button></div></header>';
  h+='<main class="wrap" style="padding-bottom:40px"><div id="bandeaux">'+bandeauxTelephone()+'</div>'+corps+'</main>';
  app.innerHTML=h;window.scrollTo(0,y);
}

/* ---------- Aides communes ---------- */
function icone(nom,cls){return '<span class="ic-rond c-'+cls+'">'+IC[nom]+'</span>'}
function bandeauDate(){var x=new Date();return '<div class="date-auto">'+IC.calendrier+'<span><b>'+dateFr(auj())+' '+x.getFullYear()+'</b><small>'+dNum(auj())+' · les saisies sont datées automatiquement</small></span></div>'}
function carteAction(a){
  if(!a)return '';
  if(a.fini)return '<div class="action-ok"><span>'+IC.ok+'</span><div><b>'+a.titre+'</b><small>'+a.sous+'</small></div></div>';
  return '<button class="action-suivante'+(a.retard?" retard":"")+'" data-act="ouvrir" data-v="'+a.type+'" data-c="'+(a.comp||"")+'"'+(a.r?' data-r="'+a.r+'"':'')+'><span class="e">'+IC[a.ic]+'</span><span class="x"><small>'+(a.retard?"En retard · à faire maintenant":"À faire maintenant")+'</small><b>'+a.titre+'</b><small>'+a.sous+'</small></span><span class="fl">›</span></button>';
}
var GUIDES={
  com:[["oeuf","prod","Après chaque tournée, touchez la grande case en haut : elle ouvre le bon ramassage du bon bâtiment."],["ventes","arg","Saisissez chaque vente et chaque dépense tout de suite, avec la photo du reçu."],["horloge","alerte","Une case rouge qui clignote est un ramassage en retard."]],
  proprio:[["note","prod","En haut : ce qui s'est passé aujourd'hui. Touchez « Écouter » pour l'entendre."],["alerte","alerte","Les lignes avec un point rouge sont les problèmes à regarder en premier."],["liste","arg","En dessous, 5 familles de cartes. Touchez une carte pour voir le détail du mois juste en dessous."]],
  gest:[["poule","elev","Comptez les poules de chaque bâtiment et touchez « Modifier » pour entrer le nombre exact."],["mortes","sante","Chaque jour, saisissez les mortes et l'aliment de chaque bâtiment."],["malade","sante","Une poule malade ? Signalez-la tout de suite : le propriétaire est prévenu."]]
};
function guide(u){
  var g=GUIDES[u.role];if(!g||lireLS("fermeKonate.guide."+u.id,false))return '';
  return '<div class="guide"><b>Comment ça marche</b><ol>'+g.map(function(x){return '<li>'+icone(x[0],x[1])+'<span>'+x[2]+'</span></li>'}).join("")+'</ol><button class="btn petit" data-act="guideVu">J\'ai compris</button></div>';
}
function enTeteStaff(u){return '<div class="salut">Bonjour '+esc(prenom(u.nom))+'</div>'+bandeauDate()+guide(u)}
function mesSaisies(u,d){
  var L=toutesSaisies().filter(function(it){return it.x.par===u.nom&&it.x.date===d});
  if(!L.length)return '';
  return '<button class="repli" data-act="mesSaisies" aria-expanded="'+(V.mesOuvert?"true":"false")+'"><span>'+IC.liste+' Mes saisies d\'aujourd\'hui ('+L.length+')</span><span>'+(V.mesOuvert?"▲":"▼")+'</span></button>'+(V.mesOuvert?'<p class="aide">Une erreur ? Touchez « Annuler ».</p>'+listeSaisies(L,true):'');
}
function chip3(items){return '<div class="resume-ligne">'+items.map(function(x){return '<span>'+icone(x[0],x[1])+'<span><b>'+x[2]+'</b><small>'+x[3]+'</small></span></span>'}).join("")+'</div>'}

/* ---------- Espace du TECHNICIEN ---------- */
function tachesGestion(d){var t=0,f=0;D.reglages.comps.forEach(function(c){t+=2;if(mortsSaisis(c.id,d))f++;if(alimSaisi(c.id,d))f++});return {total:t,faites:f}}
function actionTechnicien(d){
  var cs=D.reglages.comps,i;
  for(i=0;i<cs.length;i++)if(!D.comptages.some(function(z){return z.comp===cs[i].id}))return {type:"poules",comp:cs[i].id,ic:"poule",titre:"Compter les poules de "+cs[i].court,sous:"Nombre exact de poules du bâtiment"};
  for(i=0;i<cs.length;i++)if(!mortsSaisis(cs[i].id,d))return {type:"morts",comp:cs[i].id,ic:"mortes",titre:"Poules mortes · "+cs[i].court,sous:"Même s'il n'y en a aucune"};
  for(i=0;i<cs.length;i++)if(!alimSaisi(cs[i].id,d))return {type:"aliment",comp:cs[i].id,ic:"aliment",titre:"Aliment donné · "+cs[i].court,sous:"Nombre de sacs donnés aujourd'hui"};
  return {fini:true,titre:"Tout est saisi pour aujourd'hui",sous:"Mortes et aliment des "+cs.length+" bâtiments"};
}

/* ===== Nombre exact de poules par compartiment : enregistré, visible, modifiable, réinitialisable ===== */
function comptagesDe(c){return D.comptages.filter(function(k){return k.comp===c}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(b.t||0)-(a.t||0)})}
function panneauPoules(){
  var d=auj(),h='<p class="aide">Le nombre enregistré reste affiché jusqu\'à ce que vous le changiez ou le réinitialisiez.</p>';
  batiments().forEach(function(bt){
    bt.comps.forEach(function(c){
      var L=comptagesDe(c.id),k=L[0],eff=effectif(c.id,d);
      h+='<div class="carte-poules"><div class="cp-tete"><span class="badge">'+c.court+'</span><b>'+esc(c.nom)+'</b></div>';
      if(k){
        h+='<div class="cp-nb"><span>'+nb(k.n)+'</span><small>poules enregistrées</small></div>';
        h+='<p class="cp-info">Enregistré le '+dateHeure(k)+(k.par?' par '+esc(k.par):'')+'</p>';
        if(eff!==n0(k.n))h+='<p class="cp-info">Aujourd\'hui, après les mortes et les sorties : <b>'+nb(eff)+' poules</b></p>';
        if(L.length>1)h+='<p class="cp-hist">Anciens nombres : '+L.slice(1,4).map(function(x){return '<b>'+nb(x.n)+'</b> ('+dateCourte(x.date)+')'}).join(" · ")+'</p>';
      }else h+='<div class="cp-nb vide"><span>–</span><small>aucun nombre enregistré</small></div>';
      h+='<div class="duo"><button class="btn" data-act="ouvrir" data-v="poules" data-c="'+c.id+'">'+(k?"Changer le nombre":"Enregistrer le nombre")+'</button>'+(k?'<button class="btn sec" data-act="resetComp" data-v="'+c.id+'">Réinitialiser</button>':'<span></span>')+'</div></div>';
    });
  });
  return h;
}

function vueGestion(pourProprio){
  var d=auj(),u=moi(),t=tachesGestion(d),R=D.reglages,h='';
  h+=pourProprio?bandeauDate():enTeteStaff(u);
  var og=V.ongletTech||"jour";
  h+='<div class="vue-choix" role="tablist" style="margin-top:12px"><button role="tab" data-act="ongletTech" data-v="jour" class="'+(og==="jour"?"on":"")+'">Ma journée</button><button role="tab" data-act="ongletTech" data-v="poules" class="'+(og==="poules"?"on":"")+'">Poules par bâtiment</button></div>';
  if(og==="poules")return h+panneauPoules()+(pourProprio?'':mesSaisies(u,d));
  h+=carteAction(actionTechnicien(d))+rappelsVaccins(d);
  h+=chip3([["poule","elev",nb(effectifTotal(d)),"poules"],["ok","elev",t.faites+"/"+t.total,"saisies"],["mortes","sante",nb(morts(null,d)),"mortes"]]);
  h+='<h2 class="sec-titre c-elev">Bâtiments</h2><div class="grille-comp">';
  R.comps.forEach(function(c){
    var mal=somme(D.malades.filter(function(m){return m.date===d&&m.comp===c.id}),function(m){return m.n}),fm=mortsSaisis(c.id,d),fa=alimSaisi(c.id,d);
    h+='<div class="mini-comp"><div class="mc-tete"><span class="badge">'+c.court+'</span><button class="mc-poules" data-act="ouvrir" data-v="poules" data-c="'+c.id+'"><b>'+nb(effectif(c.id,d))+'</b> poules <u>Modifier</u></button></div>';
    if(mal)h+='<div class="mc-mal">'+IC.malade+' '+nb(mal)+' malade'+(mal>1?"s":"")+'</div>';
    h+='<div class="mc-taches"><button class="mc-t '+(fm?"fait":"")+'" data-act="ouvrir" data-v="morts" data-c="'+c.id+'">'+IC.mortes+(fm?"✓ "+nb(morts(c.id,d))+" mortes":"Mortes")+'</button><button class="mc-t '+(fa?"fait":"")+'" data-act="ouvrir" data-v="aliment" data-c="'+c.id+'">'+IC.aliment+(fa?"✓ "+nb(alimJour(c.id,d))+" sacs":"Aliment")+'</button></div></div>';
  });
  h+='</div><h2 class="sec-titre c-sante">Signaler</h2><div class="tuiles">';
  [["malade","malade","sante","Poule malade"],["vaccin","vaccin","sante","Vaccin donné"],["mouv","poule","elev","Arrivée ou sortie de poules"]].forEach(function(x){h+='<button class="tuile" data-act="ouvrir" data-v="'+x[0]+'">'+icone(x[1],x[2])+'<span>'+x[3]+'</span></button>'});
  h+='</div>';
  if(!pourProprio)h+=mesSaisies(u,d);
  return h;
}

/* ---------- Espace du COMMERCIAL ---------- */
function actionCommercial(d){
  var cs=D.reglages.comps;
  for(var ri=0;ri<RAMS.length;ri++){var r=RAMS[ri];
    for(var i=0;i<cs.length;i++)if(!ramSaisi(cs[i].id,d,r)){var hr=heureRam(r);
      return {type:"oeufs",comp:cs[i].id,r:r,ic:"oeuf",retard:ramEnRetard(cs[i].id,d,r),titre:"Ramassage "+r+" · "+cs[i].court,sous:cs[i].nom+(hr?" · prévu à "+heureRamFr(r):"")};}
  }
  return {fini:true,titre:"Les "+(cs.length*4)+" ramassages sont faits",sous:"Bravo pour aujourd'hui"};
}
function vueCommercial(pourProprio){
  var d=auj(),u=moi(),R=D.reglages,h='';
  h+=pourProprio?bandeauDate():enTeteStaff(u);
  h+=carteAction(actionCommercial(d));
  var rf=ramFaits(d),rt=R.comps.length*4,o=oeufsJour(null,d),ca=cassesJour(null,d);
  h+=chip3([["horloge","prod",rf+"/"+rt,"ramassages"],["oeuf","prod",nb(alvDe(o,ca)),"alvéoles"],["stock","prod",nb(stockAlv(d)),"en stock"]]);
  h+='<h2 class="sec-titre c-prod">Ramassages du jour</h2><div class="bloc grille-ram"><div class="gr-tete"><span></span>'+RAMS.map(function(r){return '<span>R'+r+'</span>'}).join("")+'</div>';
  batiments().forEach(function(bt){
   bt.comps.forEach(function(c){
    var kp=comptagesDe(c.id)[0];
    var dr=dernierRam(c.id,d),bp=dr?bilanPonte(c.id,d,dr):null;
    h+='<div class="gr-comp-l"><b class="gr-nom">'+esc(c.nom)+'</b> : '+(kp?'<b>'+nb(kp.n)+' poules</b>':'<span class="rouge">nombre de poules non enregistré</span>')+(bp&&bp.poules?'<br><span class="ont">'+nb(bp.ont)+' ont pondu</span> · <span class="pas">'+nb(bp.pas)+' pas encore</span> <small>(après R'+dr+')</small>':'')+'</div>';
    h+='<div class="gr-ligne" style="margin-top:2px"><span class="badge gr-badge">'+c.court+'</span>';
    RAMS.forEach(function(r){var f=ramSaisi(c.id,d,r),rt2=!f&&ramEnRetard(c.id,d,r);
      h+='<button class="gr-c '+(f?"fait":rt2?"retard":"")+'" data-act="ouvrir" data-v="oeufs" data-c="'+c.id+'" data-r="'+r+'" aria-label="'+c.court+' ramassage '+r+'">'+(f?nb(alvDe(oeufsJour(c.id,d,r),cassesJour(c.id,d,r))):rt2?IC.horloge:'<small>'+(heureRamFr(r)||"à faire")+'</small>')+'</button>'});
    h+='</div>';
   });
  });
  h+='<p class="aide" style="margin:8px 0 0;font-size:14px">Vert = fait (nombre d\'alvéoles). Rouge avec horloge = en retard. Touchez une case pour saisir ou corriger.</p></div>';
  h+='<h2 class="sec-titre c-arg">Ventes et dépenses</h2><div class="duo"><button class="btn" data-act="ouvrir" data-v="vente">'+IC.ventes+' Vendre</button><button class="btn sec" data-act="ouvrir" data-v="depense">'+IC.depenses+' Dépense</button></div>';
  var vs=D.ventes.filter(function(v){return v.date===d}),dj=D.dep.filter(function(x){return x.date===d}),srj=dj.filter(function(x){return !srcRecu(x)}).length;
  h+='<div class="chiffres"><div class="chiffre"><div class="v">'+nb(encaisseJour(d))+'</div><div class="l">GNF encaissés · '+nb(somme(vs,function(v){return v.alv}))+' alv. vendues</div></div><div class="chiffre"><div class="v">'+nb(somme(dj,function(x){return x.montant}))+'</div><div class="l">GNF dépensés'+(srj?' · <span class="sans-recu">'+srj+' sans reçu</span>':'')+'</div></div></div>';
  var cr=D.ventes.filter(function(v){return venteReste(v)>0});
  if(cr.length){h+='<h3>Clients qui doivent de l\'argent</h3><div class="bloc"><ul class="hist">';cr.forEach(function(v){h+='<li>'+icone("credits","arg")+'<span class="x"><b>'+esc(v.client)+'</b> doit '+gnf(venteReste(v))+'<small>Vente du '+dateHeure(v)+' · '+nb(v.alv)+' alvéoles</small></span><button class="btn vert petit" data-act="ouvrir" data-v="encaisser" data-id="'+v.id+'">Encaisser</button></li>'});h+='</ul></div>'}
  h+=blocVersementCommercial();
  h+='<button class="tuile" data-act="ouvrir" data-v="achat" style="width:100%;margin-top:10px">'+icone("aliment","elev")+'<span>Enregistrer un achat d\'aliment</span></button>';
  if(!pourProprio)h+=mesSaisies(u,d);
  return h;
}


/* ===== Versements : le commercial verse l'argent au propriétaire tous les 15 jours de ramassage ===== */
function joursCycle(){return Math.max(1,n0(D.reglages.joursCycle)||15)}
function cycles(){
  var R=D.reglages,deb=R.debutCycles||"",vus={};
  D.prod.forEach(function(p){if(!deb||p.date>=deb)vus[p.date]=1});
  var dates=Object.keys(vus).sort(),n=joursCycle(),out=[];
  for(var i=0;i<dates.length;i+=n){var j=dates.slice(i,i+n);out.push({n:out.length+1,jours:j,deb:j[0],complet:j.length===n})}
  out.forEach(function(c,k){var suiv=out[k+1];c.fin=suiv?decal(suiv.deb,-1):(c.complet?j0(c):auj());});
  function j0(c){return c.jours[c.jours.length-1]}
  return out;
}
function calcCycle(c){
  var R=D.reglages,f=function(x){return x.date>=c.deb&&x.date<=c.fin};
  var pr=D.prod.filter(f),o=somme(pr,function(p){return p.oeufs}),ca=somme(pr,function(p){return p.casses}),alv=alvDe(o,ca);
  var ventes=D.ventes.filter(f),enc=somme(ventes,function(v){return v.paye})+somme(D.regl.filter(f),function(r){return r.montant});
  var dep=somme(D.dep.filter(f),function(x){return x.montant}),aVerser=enc-dep;
  var verse=somme(D.vers.filter(function(v){return v.cycle===c.n}),function(v){return v.montant});
  return {oeufs:o,casses:ca,alv:alv,valeur:alv*n0(R.prix),alvVendues:somme(ventes,function(v){return v.alv}),enc:enc,dep:dep,aVerser:aVerser,verse:verse,reste:Math.max(0,aVerser-verse)};
}
function cycleCourant(){var cs=cycles();return cs.length?cs[cs.length-1]:null}
function cyclesNonVerses(){return cycles().filter(function(c){return c.complet&&calcCycle(c).reste>0})}
function lignesCalcul(c,k){
  var R=D.reglages,nonVendu=k.valeur-k.enc,h='';
  h+='<div class="deux-montants"><div class="dm dm-val"><small>① Valeur des alvéoles ramassées</small><b>'+gnf(k.valeur)+'</b><span>'+nb(k.alv)+' alv. × '+nb(R.prix)+'</span></div><div class="dm dm-ver"><small>② Argent à verser</small><b>'+gnf(k.aVerser)+'</b><span>encaissé − dépenses</span></div></div>';
  h+='<table class="t calc"><tr class="titre-c"><td colspan="2">① Comment on calcule la valeur</td></tr>';
  h+='<tr><td>Alvéoles ramassées<small>somme des ramassages des 4 bâtiments</small></td><td class="n"><b>'+nb(k.alv)+'</b></td></tr>';
  h+='<tr><td>× prix d\'une alvéole</td><td class="n">'+gnf(R.prix)+'</td></tr>';
  h+='<tr class="tot"><td><b>Valeur des alvéoles</b></td><td class="n"><b>'+gnf(k.valeur)+'</b></td></tr>';
  h+='<tr class="titre-c"><td colspan="2">② Comment on calcule le versement</td></tr>';
  h+='<tr><td>Argent encaissé par le commercial<small>'+nb(k.alvVendues)+' alvéoles vendues</small></td><td class="n">'+gnf(k.enc)+'</td></tr>';
  h+='<tr><td>Moins les dépenses payées</td><td class="n">− '+gnf(k.dep)+'</td></tr>';
  h+='<tr class="tot"><td><b>À verser au propriétaire</b></td><td class="n"><b>'+gnf(k.aVerser)+'</b></td></tr>';
  h+='<tr><td>Déjà versé</td><td class="n">'+gnf(k.verse)+'</td></tr>';
  h+='<tr class="tot"><td><b>Reste à verser</b></td><td class="n"><b style="color:'+(k.reste>0?"var(--alerte)":"var(--vert)")+'">'+gnf(k.reste)+'</b></td></tr>';
  h+='<tr class="titre-c"><td colspan="2">Pourquoi ① et ② sont différents</td></tr>';
  h+='<tr><td>Dépenses payées</td><td class="n">'+gnf(k.dep)+'</td></tr>';
  h+='<tr><td>'+(nonVendu>=0?"Alvéoles pas encore vendues ou pas encore payées":"Ventes d'alvéoles ramassées avant ce cycle")+'</td><td class="n">'+gnf(Math.abs(nonVendu))+'</td></tr>';
  return h+'</table>';
}
function dVersement(){
  var cs=cycles().slice().reverse(),h='<p class="aide">Le commercial verse l\'argent tous les '+joursCycle()+' jours de ramassage. Voici le calcul, cycle par cycle.</p>';
  if(!cs.length)return h+'<div class="vide">Aucun ramassage saisi pour l\'instant.</div>';
  cs.forEach(function(c){var k=calcCycle(c);
    h+='<div class="bloc"><div class="det-ram"><span><b>Cycle '+c.n+'</b><small>du '+dateCourte(c.deb)+' au '+(c.complet?dateCourte(c.fin):"aujourd'hui")+' · '+c.jours.length+' / '+joursCycle()+' jours</small></span><span class="etat-v '+(!c.complet?"encours":k.reste>0?"du":"ok")+'">'+(!c.complet?"en cours":k.reste>0?"à verser":"versé ✓")+'</span></div>'+lignesCalcul(c,k);
    D.vers.filter(function(v){return v.cycle===c.n}).forEach(function(v){h+='<p class="aide" style="margin:6px 0 0">Versement de '+gnf(v.montant)+' le '+dateHeure(v)+' par '+esc(v.par||"")+(srcRecu(v)?' · <button class="recu-btn" data-act="voirRecu" data-l="vers" data-id="'+v.id+'">Voir le reçu</button>':'')+'</p>'});
    h+='</div>';
  });
  return h;
}
/* Fenêtre de saisie du versement (commercial) */
function fVersement(){
  var F=V.F,cs=cycles().filter(function(c){return calcCycle(c).reste>0});
  if(!cs.length)return '<div class="alerte ok"><b>Rien à verser pour l\'instant.</b></div>';
  var h='<div class="champ"><span class="etiq">Pour quel cycle ?</span><div class="chips">';
  cs.forEach(function(c){h+='<button type="button" class="chip '+(F.cycle===c.n?"on":"")+'" data-act="setN" data-k="cycle" data-v="'+c.n+'">Cycle '+c.n+(c.complet?"":" (en cours)")+'</button>'});
  h+='</div></div>';
  var c=cs.find(function(x){return x.n===F.cycle})||cs[0],k=calcCycle(c);
  h+='<div class="resume">Reste à verser pour le cycle '+c.n+' : <b>'+gnf(k.reste)+'</b></div>'+champMontant("montant","Montant versé au propriétaire")+blocPhoto();
  return h;
}
function blocVersementCommercial(){
  var c=cycleCourant(),nv=cyclesNonVerses(),h='<h2 class="sec-titre c-arg">Versement au propriétaire</h2><div class="bloc">';
  if(nv.length){var tot=somme(nv,function(x){return calcCycle(x).reste});h+='<div class="alerte" style="margin-top:0"><b>Versement à faire :</b> '+gnf(tot)+' pour le'+(nv.length>1?"s cycles ":" cycle ")+nv.map(function(x){return x.n}).join(", ")+'.</div>'}
  if(c){var k=calcCycle(c);h+='<p style="margin:0 0 6px"><b>Cycle '+c.n+'</b> · jour '+c.jours.length+' sur '+joursCycle()+'</p><p class="aide" style="margin:0 0 10px">'+nb(k.alv)+' alvéoles ramassées × '+gnf(D.reglages.prix)+' = <b>'+gnf(k.valeur)+'</b>. Argent à verser à ce jour : <b>'+gnf(k.reste)+'</b>.</p>'}
  return h+'<button class="btn" data-act="ouvrir" data-v="versement">'+IC.benef+' Enregistrer un versement</button></div>';
}
function blocVersementProprio(){
  var c=cycleCourant();if(!c)return '';
  var k=calcCycle(c),nv=cyclesNonVerses();
  var h='<h2 class="sec-titre c-arg">Le versement des '+joursCycle()+' jours</h2><button class="bloc vers-p" data-act="ouvrir" data-v="dVersement">';
  h+='<span class="vp-l">Cycle '+c.n+' · jour '+c.jours.length+' sur '+joursCycle()+'</span><span class="progres"><span style="width:'+(c.jours.length/joursCycle()*100)+'%"></span></span>';
  h+='<span class="vp-calc">'+nb(k.alv)+' alvéoles × '+gnf(D.reglages.prix)+'</span><span class="vp-v">= '+gnf(k.valeur)+'</span><span class="vp-s">valeur des alvéoles ramassés depuis le début du cycle</span>';
  h+='<span class="vp-s">Argent que le commercial doit verser à ce jour : <b>'+gnf(k.reste)+'</b></span>';
  if(nv.length)h+='<span class="sans-recu">'+nv.length+' cycle'+(nv.length>1?"s":"")+' terminé'+(nv.length>1?"s":"")+' pas encore versé'+(nv.length>1?"s":"")+'</span>';
  return h+'<span class="vp-voir">Voir le calcul ›</span></button>';
}

/* ---------- Espace du PROPRIÉTAIRE : tableau de bord cohérent, on touche une case pour le détail ---------- */
function finMois(m){var d=new Date(m+"-15T12:00:00");d.setMonth(d.getMonth()+1);d.setDate(0);return iso(d)}
function periode(){
  if(V.F&&V.F.jour){var dj=V.F.jour;return {deb:dj,fin:dj,mois:false,lib:dateFr(dj),court:"ce jour"}}
  if(V.periode==="mois"){var m=V.date.slice(0,7),f=finMois(m);if(f>auj())f=auj();
    return {deb:m+"-01",fin:f,mois:true,lib:moisFr(m),court:"ce mois"}}
  var d=V.date;return {deb:d,fin:d,mois:false,lib:d===auj()?"Aujourd'hui":dateCourte(d)==="hier"?"Hier":dateFr(d),court:d===auj()?"aujourd'hui":"ce jour"};
}
function moisFr(m){return new Date(m+"-15T12:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}
function dansP(P){return function(x){return x.date>=P.deb&&x.date<=P.fin}}
function joursP(P){var j=[],d=P.deb;while(d<=P.fin){j.push(d);d=decal(d,1)}return j}
function chiffresP(P){
  var f=dansP(P),R=D.reglages,prod=D.prod.filter(f),ventes=D.ventes.filter(f),dep=D.dep.filter(f),regl=D.regl.filter(f);
  var o=somme(prod,function(p){return p.oeufs}),ca=somme(prod,function(p){return p.casses});
  var jp=joursP(P).filter(function(j){return D.prod.some(function(p){return p.date===j})});
  var tx=jp.map(function(j){return ponte(null,j)}).filter(isFinite);
  var enc=somme(ventes,function(v){return v.paye})+somme(regl,function(r){return r.montant});
  var sal=dep.filter(function(x){return x.cat==="Salaires"});
  return {oeufs:o,casses:ca,alv:alvDe(o,ca),joursProd:jp.length,ponte:tx.length?somme(tx,function(t){return t})/tx.length:NaN,
    ventes:ventes,alvVendues:somme(ventes,function(v){return v.alv}),montantVentes:somme(ventes,venteTotal),enc:enc,
    dep:dep,totDep:somme(dep,function(x){return x.montant}),sansRecu:dep.filter(function(x){return !srcRecu(x)}).length,
    sal:sal,totSal:somme(sal,function(x){return x.montant}),
    morts:somme(D.mouv.filter(function(m){return m.type==="mort"&&f(m)}),function(m){return m.n}),
    malades:somme(D.malades.filter(f),function(m){return m.n})};
}
/* Icônes dessinées (s'affichent pareil sur tous les téléphones) */
var IC=(function(){var s=function(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'};return {
  oeuf:s('<path d="M12 3c3.6 0 6.5 5.6 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.6 8.4 3 12 3z"/>'),
  horloge:s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  stock:s('<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
  poule:s('<path d="M7 20h10M9 20l1-4M15 20l-1-4"/><path d="M5 9a7 7 0 0 0 14 3c0-3-2-5-5-5h-1l-1-3-2 2-2-1v3"/>'),
  aliment:s('<path d="M12 21V8M12 8c0-3 2-5 4-5 0 3-2 5-4 5zM12 8c0-3-2-5-4-5 0 3 2 5 4 5zM12 13c0-3 2-5 4-5 0 3-2 5-4 5zM12 13c0-3-2-5-4-5 0 3 2 5 4 5z"/>'),
  malade:s('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M12 10v7M8.5 13.5h7"/>'),
  mortes:s('<path d="M12 3v18M7 8h10"/>'),
  vaccin:s('<path d="M18 2l4 4M17 7l-9 9-3 1 1-3 9-9M15 5l4 4M5 19l-3 3M10 10l2 2"/>'),
  ventes:s('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  depenses:s('<path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M3 7l12-4v4M17 14h.01"/>'),
  salaires:s('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  benef:s('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  credits:s('<path d="M7 11l3-3 3 2 4-4M3 12l4 4 3-1 4 4 4-4 3-3"/>'),
  alerte:s('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>'),
  ok:s('<path d="M5 12l5 5 9-10"/>'),
  liste:s('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  rapport:s('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>'),
  calendrier:s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
  eau:s('<path d="M12 3l6 8a6 6 0 1 1-12 0z"/>'),
  eclair:s('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  carburant:s('<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 10h2a2 2 0 0 1 2 2v4a2 2 0 0 0 4 0V8l-3-3M7 8h4"/>'),
  outil:s('<path d="M14 7a4 4 0 0 0 5 5l2 2-7 7-2-2a4 4 0 0 0-5-5l-4 4 3 3 4-4"/>'),
  boite:s('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M10 15h4"/>'),
  photo:s('<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="4"/>'),
  voix:s('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>'),
  stop:s('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  note:s('<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h4"/>')
}})();
var DET={dRam:["prod","horloge"],dProd:["prod","oeuf"],dStock:["prod","stock"],dPoules:["elev","poule"],dAliment:["elev","aliment"],dMalades:["sante","malade"],dMorts:["sante","mortes"],dVaccins:["sante","vaccin"],dVentes:["arg","ventes"],dDepenses:["arg","depenses"],dSalaires:["arg","salaires"],dBenef:["arg","benef"],dCredits:["arg","credits"],dAlertes:["alerte","alerte"],dVersement:["arg","benef"]};
function tuile(type,v,l,s,probleme){
  var d=DET[type];
  return '<button class="tdb c-'+d[0]+(probleme?" probleme":"")+'" data-act="ouvrir" data-v="'+type+'"><span class="tdb-ic">'+IC[d[1]]+'</span><span class="tdb-v">'+v+'</span><span class="tdb-l">'+l+'</span>'+(s?'<span class="tdb-s">'+s+'</span>':'')+'</button>';
}
function section(cls,titre,tuiles){return '<h2 class="sec-titre c-'+cls+'">'+titre+'</h2><div class="tdb-grille">'+tuiles+'</div>'}
function cibleAlerte(t){t=t.toLowerCase();return /ramassage/.test(t)?"dRam":/malade/.test(t)?"dMalades":/vaccin/.test(t)?"dVaccins":/ponte/.test(t)?"dProd":/morte/.test(t)?"dMorts":/stock/.test(t)?"dStock":/aliment/.test(t)?"dAliment":"dPoules"}
function attention(P,C){
  var L=[];
  if(!P.mois)alertes(P.fin).forEach(function(a){var txt=a.t.replace(/<button[\s\S]*?<\/button>/g,"").replace(/<[^>]+>/g,"").trim();L.push({n:a.k==="alerte"?2:1,t:txt.length>70&&txt.indexOf(" : ")>0?txt.split(" : ")[0]:txt,v:cibleAlerte(txt)})});
  cyclesNonVerses().forEach(function(c){L.push({n:2,t:"Versement du cycle "+c.n+" pas fait : "+gnf(calcCycle(c).reste)+" à verser",v:"dVersement"})});
  if(C.sansRecu)L.push({n:1,t:C.sansRecu+" dépense"+(C.sansRecu>1?"s":"")+" sans reçu",v:"dDepenses"});
  if(C.enc-C.totDep<0&&P.mois)L.push({n:1,t:"Bénéfice négatif sur le mois",v:"dBenef"});
  return L.sort(function(a,b){return b.n-a.n});
}
/* ===== Comprendre facilement : résumé en phrases, comparaisons, tendance ===== */
function perPrec(P){
  if(P.mois){var x=new Date(P.deb+"T12:00:00");x.setMonth(x.getMonth()-1);var m=iso(x).slice(0,7);return {deb:m+"-01",fin:finMois(m),mois:true}}
  var j=decal(P.fin,-1);return {deb:j,fin:j,mois:false};
}
function nomMois(d){return new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{month:"long"})}
/* Alvéoles d'un jour, limitées aux ramassages donnés (pour comparer « à la même heure ») */
function alvRams(d,rams){var pr=D.prod.filter(function(p){return p.date===d&&rams.indexOf(p.r)>=0});return alvDe(somme(pr,function(p){return p.oeufs}),somme(pr,function(p){return p.casses}))}
function ramsFaitsListe(d){return RAMS.filter(function(r){return D.prod.some(function(p){return p.date===d&&p.r===r})})}
/* Compare deux nombres : flèche, couleur et petite phrase */
function comparer(cur,prev,plusBon,ref,unite){
  unite=unite||"";
  if(prev===null||prev===undefined||!isFinite(prev))return {cls:"egal",txt:"pas de comparaison",ph:""};
  var e=Math.round(cur-prev);
  if(e===0)return {cls:"egal",txt:"= pareil "+ref,ph:"autant "+ref};
  var bon=plusBon?e>0:e<0;
  return {cls:bon?"bon":"mauvais",txt:(e>0?"↑ ":"↓ ")+nb(Math.abs(e))+unite+(e>0?" de plus ":" de moins ")+ref,ph:nb(Math.abs(e))+unite+(e>0?" de plus ":" de moins ")+ref};
}
function pill(c){return '<span class="cmp '+c.cls+'">'+c.txt+'</span>'}
function sur100(t){return isFinite(t)?Math.round(t*100)+" poules sur 100":"–"}
/* Toutes les analyses de la période, en un seul endroit */
function analyse(P){
  var R=D.reglages,C=chiffresP(P),Q=perPrec(P),Cp=chiffresP(Q),A={P:P,C:C};
  if(!P.mois){
    var d=P.fin,rams=ramsFaitsListe(d),partiel=rams.length>0&&rams.length<4;
    var hier=D.prod.some(function(p){return p.date===Q.fin});
    A.alvCmp=hier?comparer(C.alv,partiel?alvRams(Q.fin,rams):Cp.alv,true,partiel?"qu'hier à la même heure":"qu'hier"):comparer(0,null);
    var p=ponte(null,d),m7=ponteMoy7(null,d);
    A.ponte=rams.length===4?p:NaN;
    A.ponteCmp=isFinite(A.ponte)&&isFinite(m7)?comparer(A.ponte*100,m7*100,true,"que la moyenne de la semaine"," sur 100"):comparer(0,null);
    A.ramsFaits=ramFaits(d);A.retards=ramManquants(d).length;
  }else{
    var mo=C.joursProd?C.alv/C.joursProd:NaN,mp=Cp.joursProd?Cp.alv/Cp.joursProd:NaN;
    A.moyJour=mo;A.alvCmp=isFinite(mp)&&isFinite(mo)?comparer(mo,mp,true,"par jour qu'en "+nomMois(Q.deb)):comparer(0,null);
    A.ponte=C.ponte;A.ponteCmp=isFinite(C.ponte)&&isFinite(Cp.ponte)?comparer(C.ponte*100,Cp.ponte*100,true,"qu'en "+nomMois(Q.deb)," sur 100"):comparer(0,null);
  }
  var ref=P.mois?"qu'en "+nomMois(Q.deb):"qu'hier",act=Cp.enc||Cp.totDep||D.prod.some(function(p){return p.date>=Q.deb&&p.date<=Q.fin});
  A.encCmp=act?comparer(C.enc,Cp.enc,true,ref):comparer(0,null);
  A.depCmp=act?comparer(C.totDep,Cp.totDep,false,ref):comparer(0,null);
  A.benef=C.enc-C.totDep;A.benefCmp=act?comparer(A.benef,Cp.enc-Cp.totDep,true,ref):comparer(0,null);
  return A;
}
/* Le résumé écrit comme on parle */
function resumePhrases(P){
  var A=analyse(P),C=A.C,R=D.reglages,ph=[],f=dansP(P);
  if(!P.mois){
    var quand=P.fin===auj()?"Aujourd'hui":"Ce jour-là";
    if(!C.oeufs)ph.push(quand+", aucun ramassage n'a encore été saisi.");
    else{
      ph.push(quand+", la ferme a ramassé "+nb(C.alv)+" alvéoles, d'une valeur de "+gnf(C.alv*n0(R.prix))+","+(A.ramsFaits<NR()?" ("+A.ramsFaits+" ramassages sur "+NR()+" saisis)":"")+(A.alvCmp.ph?", soit "+A.alvCmp.ph:"")+".");
      if(isFinite(A.ponte))ph.push(sur100(A.ponte).replace("poules","poules")+" ont pondu"+(A.ponteCmp.ph?", "+A.ponteCmp.ph:"")+".");
    }
    if(A.retards)ph.push("Attention : "+A.retards+" ramassage"+(A.retards>1?"s sont":" est")+" en retard.");
  }else{
    var mN=nomMois(P.deb);
    if(!C.oeufs)ph.push("En "+mN+", aucun ramassage n'a été saisi.");
    else{
      ph.push("En "+mN+", la ferme a ramassé "+nb(C.alv)+" alvéoles, soit "+nb(Math.round(A.moyJour))+" par jour en moyenne"+(A.alvCmp.ph?", "+A.alvCmp.ph:"")+".");
      if(isFinite(A.ponte))ph.push("En moyenne, "+sur100(A.ponte)+" ont pondu chaque jour.");
    }
  }
  var mal=D.malades.filter(f),parC={};mal.forEach(function(m){parC[comp(m.comp).court]=(parC[comp(m.comp).court]||0)+n0(m.n)});
  var malTxt=Object.keys(parC).map(function(k){return parC[k]+" dans "+k}).join(" et ");
  if(C.malades)ph.push(nb(C.malades)+" poule"+(C.malades>1?"s sont malades":" est malade")+" ("+malTxt+").");
  if(C.morts)ph.push(nb(C.morts)+" poule"+(C.morts>1?"s sont mortes":" est morte")+".");
  if(!C.malades&&!C.morts)ph.push("Aucune poule malade ni morte n'a été signalée.");
  ph.push("Vous avez encaissé "+gnf(C.enc)+" et dépensé "+gnf(C.totDep)+".");
  if(C.enc||C.totDep)ph.push(A.benef>=0?"Il vous reste donc "+gnf(A.benef)+".":"Les dépenses dépassent les encaissements de "+gnf(-A.benef)+".");
  if(C.sansRecu)ph.push(C.sansRecu+" dépense"+(C.sansRecu>1?"s n'ont":" n'a")+" pas de reçu.");
  var cr=creditsTotal();if(cr)ph.push("Des clients vous doivent encore "+gnf(cr)+".");
  ph.push("Il y a "+nb(stockAlv(P.fin))+" alvéoles en stock.");
  return ph;
}
/* Version lue à voix haute : nombres sans espaces, « GNF » dit en toutes lettres */
function pourVoix(t){return t.replace(/(\d)[\s\u202f\u00a0](?=\d{3})/g,"$1").replace(/GNF/g,"francs guinéens").replace(/B(\d)/g,"B $1")}
var voixEnCours=false;
function ecouter(quoi){
  if(!("speechSynthesis" in window)){toast("La lecture à voix haute n'est pas disponible sur ce téléphone");return}
  var ss=window.speechSynthesis;
  if(voixEnCours){ss.cancel();voixEnCours=false;majBoutonVoix();return}
  var PV=quoi==="jour"?{deb:auj(),fin:auj(),mois:false,lib:"Aujourd'hui"}:periode();
  var u=new SpeechSynthesisUtterance(pourVoix(resumePhrases(PV).join(" ")));
  u.lang="fr-FR";u.rate=0.95;
  var v=(ss.getVoices()||[]).find(function(x){return /^fr/i.test(x.lang)});if(v)u.voice=v;
  u.onend=u.onerror=function(){voixEnCours=false;majBoutonVoix()};
  ss.cancel();ss.speak(u);voixEnCours=true;majBoutonVoix();
}
function majBoutonVoix(){var b=document.getElementById("btnVoix");if(b)b.innerHTML=voixEnCours?IC.stop+" Arrêter":IC.voix+" Écouter"}
/* Graphique : barres des jours et ligne de l'objectif */
function graphTendance(P){
  var R=D.reglages,js=[];
  if(P.mois)js=joursP(P);else for(var i=6;i>=0;i--)js.push(decal(P.fin,-i));
  var vals=js.map(function(j){return alvDe(oeufsJour(null,j),cassesJour(null,j))}),obj=n0(R.objectif);
  var mx=Math.max.apply(null,vals.concat([obj,1]))*1.15,W=320,H=120,bw=W/js.length,y=function(v){return H-v/mx*H};
  var h='<svg class="tendance" viewBox="0 0 '+W+' '+(H+18)+'" width="100%" role="img" aria-label="Alvéoles ramassées chaque jour, comparées à l\'objectif de '+obj+'">';
  vals.forEach(function(v,i){var hh=H-y(v),der=i===vals.length-1&&!P.mois;
    h+='<rect class="'+(der?"auj":v>=obj?"ok":"")+'" x="'+(i*bw+bw*0.15)+'" y="'+y(v)+'" width="'+(bw*0.7)+'" height="'+hh+'" rx="3"></rect>';
    if(!P.mois)h+='<text x="'+(i*bw+bw/2)+'" y="'+(y(v)-4)+'" text-anchor="middle" class="val">'+(v?nb(v):"")+'</text>';
    if(!P.mois||i%5===0)h+='<text x="'+(i*bw+bw/2)+'" y="'+(H+14)+'" text-anchor="middle">'+(P.mois?(i+1):new Date(js[i]+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short"}).slice(0,3))+'</text>';
  });
  if(obj)h+='<line x1="0" x2="'+W+'" y1="'+y(obj)+'" y2="'+y(obj)+'" class="obj"></line><text x="'+(W-2)+'" y="'+(y(obj)-4)+'" text-anchor="end" class="objt">objectif '+obj+'</text>';
  return h+'</svg>';
}
function ligneArgent(type,ic,lib,val,c){return '<button class="arg-l" data-act="ouvrir" data-v="'+type+'">'+icone(ic,"arg")+'<span class="x"><span class="lib">'+lib+'</span><b>'+val+'</b>'+pill(c)+'</span><span class="fl">›</span></button>'}

/* ===== Espace du PROPRIÉTAIRE : des tableaux clairs, peu de texte ===== */
var MENUS=[["alv","Alvéoles ramassées","oeuf","prod","Par ramassage et par bâtiment"],["ventes","Ventes","ventes","arg","Ce que le commercial a vendu et encaissé"],["dep","Dépenses","depenses","arg","Ce qui a été payé, avec les reçus"],["vers","Argent à recevoir","benef","arg","Ce que le commercial doit vous verser"],["mal","Poules malades","malade","sante","Les poules signalées malades"],["morts","Poules mortes","mortes","sante","Les poules mortes chaque jour"],["poules","Nombre de poules","poule","elev","Combien de poules dans chaque bâtiment"],["alim","Aliment donné","aliment","elev","Les sacs donnés aux poules"],["resume","Résumé du mois","note","gris","Tout le mois expliqué en phrases"]];
/* Dates toujours complètes : jour de la semaine + jj/mm/aaaa */
function dNum(d){var p=String(d).split("-");return p[2]+"/"+p[1]+"/"+p[0]}
function jourSem(d){return new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long"})}
function dComplete(d){return jourSem(d)+" "+dNum(d)}
/* Tableau des derniers jours pour le DG : date, alvéoles, valeur */
function tableDerniersJours(n){
  var R=D.reglages,L=[],tA=0,tV=0;
  for(var i=0;i<n;i++){var d=decal(auj(),-i),a=alvDe(oeufsJour(null,d),cassesJour(null,d)),rf=ramFaits(d);tA+=a;tV+=a*n0(R.prix);
    L.push('<tr class="'+(i===0?"auj-l":"")+'"><td><b>'+(i===0?"Aujourd'hui":i===1?"Hier":jourSem(d))+'</b><small>'+dNum(d)+'</small></td>'+cellN(a?'<b>'+nb(a)+'</b>':(rf?"0":null))+cellN(a?nb(a*n0(R.prix)):null)+cellN(rf?'<span class="'+(ramManquants(d).length?"rouge":"")+'">'+rf+'/'+NR()+'</span>':'<span class="vide-c">–</span>')+'</tr>')}
  return tableau(["Date","Alvéoles","Valeur (GNF)","Ramassages"],L,[n+" jours",'<b>'+nb(tA)+'</b>',nb(tV),""]);
}

function jc(d){var x=new Date(d+"T12:00:00");return x.toLocaleDateString("fr-FR",{weekday:"short"})+" "+dNum(d)}
function cellN(v,cls){return '<td class="n'+(cls?" "+cls:"")+'">'+(v===null?'<span class="vide-c">–</span>':v)+'</td>'}
function tableau(tetes,lignes,total,cls,avant){
  var h='<div class="tab-p'+(cls?" "+cls:"")+'"><table><thead>'+(avant||'')+'<tr>'+tetes.map(function(t,i){var g=t.charAt(0)==="<";return '<th class="'+(i&&!g?"n":"")+'">'+(g?t.slice(1):t)+'</th>'}).join("")+'</tr></thead><tbody>';
  if(total)h+='<tr class="tot">'+total.map(function(t,i){return i?cellN(t):'<td>'+t+'</td>'}).join("")+'</tr>';
  if(!lignes.length)h+='<tr><td colspan="'+tetes.length+'" class="rien">Rien ce mois-ci</td></tr>';
  return h+lignes.join("")+'</tbody></table></div>';
}
function joursMois(P){var j=joursP(P);return j.reverse()}
function detailJour(d){
  var R=D.reglages,h='<table class="mini-t"><tr><th></th>'+RAMS.map(function(r){return '<th>R'+r+'<small>'+heureRamFr(r)+'</small></th>'}).join("")+'</tr>';
  R.comps.forEach(function(c){h+='<tr><td><b>'+c.court+'</b></td>'+RAMS.map(function(r){var p=D.prod.find(function(x){return x.date===d&&x.comp===c.id&&x.r===r});
    return p?'<td>'+nb(alvDe(p.oeufs,p.casses))+'<small>'+heure(p.t)+'</small></td>':(ramEnRetard(c.id,d,r)?'<td class="rouge">!</td>':'<td class="vide-c">–</td>')}).join("")+'</tr>'});
  return h+'</table><p class="note-t" style="margin:6px 0 0">Alvéoles par ramassage · en petit : heure de la saisie.</p>';
}
function tAlv(P){
  var R=D.reglages,cs=R.comps,L=[];
  joursMois(P).forEach(function(d){
    var vals=cs.map(function(c){var o=oeufsJour(c.id,d);return o?alvDe(o,cassesJour(c.id,d)):null});
    var t=alvDe(oeufsJour(null,d),cassesJour(null,d)),rf=ramFaits(d),ouv=V.jourOuvert===d;
    L.push('<tr class="clic'+(ouv?" ouvert":"")+'" data-act="jourOuvrir" data-v="'+d+'"><td>'+(ouv?"▾ ":"▸ ")+jc(d)+(rf&&rf<NR()?'<small class="'+(ramManquants(d).length?"rouge":"")+'">'+rf+'/'+NR()+'</small>':'')+'</td>'+vals.map(function(v){return cellN(v===null?null:nb(v))}).join("")+cellN(t?'<b>'+nb(t)+'</b><small>'+nb(t*n0(R.prix))+'</small>':null)+'</tr>');
    if(ouv)L.push('<tr class="sous"><td colspan="'+(cs.length+2)+'">'+detailJour(d)+'</td></tr>');
  });
  var f=dansP(P),tot=cs.map(function(c){var pr=D.prod.filter(function(p){return p.comp===c.id&&f(p)});return alvDe(somme(pr,function(p){return p.oeufs}),somme(pr,function(p){return p.casses}))}),tt=chiffresP(P).alv;
  return tableau(["Date"].concat(cs.map(function(c){return c.court})).concat(["Total"]),L,["Mois"].concat(tot.map(nb)).concat(['<b>'+nb(tt)+'</b><small>'+nb(tt*n0(R.prix))+'</small>']),null,ligneBat(1))+'<p class="note-t">En alvéoles · sous le total : valeur en GNF. Touchez un jour pour voir ses 4 ramassages.</p>';
}
function tVentes(P){
  var f=dansP(P),V2=D.ventes.filter(f).sort(function(a,b){return (b.t||0)-(a.t||0)}),L=[];
  V2.forEach(function(v){var r=venteReste(v);L.push('<tr><td>'+jc(v.date)+'</td><td class="g">'+esc(v.client)+'</td>'+cellN(nb(v.alv))+cellN(nb(venteTotal(v)))+cellN(r?'<span class="rouge">'+nb(r)+'</span>':"✓")+'</tr>')});
  return tableau(["Date","<Client","Alv.","Montant","Reste"],L,["Mois","",nb(somme(V2,function(v){return v.alv})),nb(somme(V2,venteTotal)),nb(somme(V2,venteReste))])+'<p class="note-t">Montants en GNF. Reste = crédit du client.</p>';
}
function tDep(P){
  var f=dansP(P),L2=D.dep.filter(f).sort(function(a,b){return (b.t||0)-(a.t||0)}),L=[];
  L2.forEach(function(x){var s=srcRecu(x);L.push('<tr><td>'+jc(x.date)+'</td><td class="g">'+esc(x.cat)+(x.note?'<small>'+esc(x.note)+'</small>':'')+'</td>'+cellN(nb(x.montant))+'<td class="n">'+(s?'<button class="recu-btn" data-act="voirRecu" data-l="dep" data-id="'+x.id+'">Voir</button>':'<span class="rouge">non</span>')+'</td></tr>')});
  return tableau(["Date","<Pour quoi","Montant","Reçu"],L,["Mois","",nb(somme(L2,function(x){return x.montant})),""])+'<p class="note-t">Montants en GNF.</p>';
}
function tVers(){
  var cs=cycles().slice().reverse(),L=[];
  cs.forEach(function(c){var k=calcCycle(c),ouv=V.cycleOuvert===c.n;
    L.push('<tr class="clic'+(ouv?" ouvert":"")+'" data-act="cycleOuvrir" data-v="'+c.n+'"><td>'+(ouv?"▾ ":"▸ ")+c.n+'<small>'+jc(c.deb)+' → '+(c.complet?jc(c.fin):"…")+'</small></td>'+cellN(nb(k.valeur)+'<small>'+nb(k.alv)+' alv.</small>')+cellN(nb(k.aVerser))+cellN(k.reste?'<span class="rouge">'+nb(k.reste)+'</span>':(c.complet?"✓":"…"))+'</tr>');
  });
  var co=cs.find(function(c){return c.n===V.cycleOuvert});
  return tableau(["Cycle","① Valeur alvéoles","② À verser","Reste"],L,null,"serre")+(co?'<div class="calc-ouvert"><div class="co-tete"><b>Calcul du cycle '+co.n+'</b><button class="lien" data-act="cycleOuvrir" data-v="'+co.n+'">Fermer</button></div>'+lignesCalcul(co,calcCycle(co))+'</div>':'')+'<p class="note-t">'+joursCycle()+' jours de ramassage par cycle. Montants en GNF. Touchez un cycle pour voir le calcul.</p>';
}
function tMal(P){
  var f=dansP(P),M=D.malades.filter(f).sort(function(a,b){return (b.t||0)-(a.t||0)}),L=[];
  M.forEach(function(m){L.push('<tr><td>'+jc(m.date)+'</td><td>'+esc(comp(m.comp).court)+'</td>'+cellN(nb(m.n))+'<td class="g">'+esc(m.signes)+(m.trait?'<small>'+esc(m.trait)+'</small>':'')+'</td></tr>')});
  return tableau(["Date","<Comp.","Nb","<Signes · traitement"],L,["Mois","",nb(somme(M,function(m){return m.n})),""]);
}
function tParComp(P,fn,unite){
  var cs=D.reglages.comps,tot=cs.map(function(){return 0}),L=[];
  joursMois(P).forEach(function(d){var vals=cs.map(function(c){return fn(c.id,d)});if(vals.every(function(v){return v===null}))return;
    vals.forEach(function(v,i){tot[i]+=v||0});L.push('<tr><td>'+jc(d)+'</td>'+vals.map(function(v){return cellN(v===null?null:nb(v))}).join("")+cellN('<b>'+nb(somme(vals,function(v){return v||0}))+'</b>')+'</tr>')});
  return tableau(["Date"].concat(cs.map(function(c){return c.court})).concat(["Total"]),L,["Mois"].concat(tot.map(nb)).concat(['<b>'+nb(somme(tot,function(v){return v}))+'</b>']));
}
function tMorts(P){return tParComp(P,function(c,d){var l=D.mouv.filter(function(m){return m.type==="mort"&&m.comp===c&&m.date===d});return l.length?somme(l,function(m){return m.n}):null})}
function tAlim(P){return tParComp(P,function(c,d){var l=D.alimOut.filter(function(a){return a.comp===c&&a.date===d});return l.length?somme(l,function(a){return a.sacs}):null})+'<p class="note-t">En sacs. Stock : '+nb(stockAliment(auj()))+' sacs.</p>'}
function tPoules(P){
  var L=[];D.reglages.comps.forEach(function(c){var k=dernierComptage(c.id,P.fin),mo=somme(D.mouv.filter(function(m){return m.type==="mort"&&m.comp===c.id&&m.date>=P.deb&&m.date<=P.fin}),function(m){return m.n});
    L.push('<tr><td><span class="badge" style="font-size:13px;padding:3px 7px">'+c.court+'</span></td>'+cellN('<b>'+nb(effectif(c.id,P.fin))+'</b>')+cellN(nb(mo))+'<td class="n">'+(k?jc(k.date):'<span class="rouge">jamais</span>')+'</td></tr>')});
  return tableau(["Comp.","Poules","Mortes","Compté le"],L,["Total",'<b>'+nb(effectifTotal(P.fin))+'</b>',nb(chiffresP(P).morts),""]);
}
function tResume(P){return '<div class="resume-jour"><div class="rj-tete"><b>Le résumé</b><button class="btn petit" id="btnVoix" data-act="ecouter">'+(voixEnCours?IC.stop+" Arrêter":IC.voix+" Écouter")+'</button></div><p>'+resumePhrases(P).map(esc).join(" ")+'</p></div>'}


/* Alvéoles d'un jour : ramassages (lignes) × bâtiments (colonnes) */
function tableRamBat(d){
  var R=D.reglages,cs=R.comps,L=[];
  RAMS.forEach(function(r){
    var vals=cs.map(function(c){var p=D.prod.find(function(x){return x.date===d&&x.comp===c.id&&x.r===r});return p?alvDe(p.oeufs,p.casses):(ramEnRetard(c.id,d,r)?"!":null)});
    var t=somme(vals,function(v){return typeof v==="number"?v:0}),au=vals.some(function(v){return typeof v==="number"});
    L.push('<tr><td><b>R'+r+'</b><small>'+heureRamFr(r)+'</small></td>'+vals.map(function(v){return v==="!"?'<td class="n"><span class="rouge" title="en retard">!</span></td>':cellN(v===null?null:nb(v))}).join("")+cellN(au?'<b>'+nb(t)+'</b>':null)+'</tr>');
  });
  var totC=cs.map(function(c){return alvDe(oeufsJour(c.id,d),cassesJour(c.id,d))}),tt=alvDe(oeufsJour(null,d),cassesJour(null,d));
  return tableau(["Ramassage"].concat(cs.map(function(c){return c.court})).concat(["Total"]),L,["Jour"].concat(totC.map(nb)).concat(['<b>'+nb(tt)+'</b>']),null,ligneBat(1))+
    '<p class="valeur-j">'+nb(tt)+' alvéoles × '+gnf(R.prix)+' = <b>'+gnf(tt*n0(R.prix))+'</b></p>';
}
function navJourAlv(d){return '<div class="nav-jour petit"><button class="ico" data-act="jourAlv" data-v="-1" aria-label="Jour précédent">'+ICO.retour+'</button><div><b>'+(d===auj()?"Aujourd'hui":jourSem(d))+'</b><small>'+dComplete(d)+'</small></div><button class="ico" data-act="jourAlv" data-v="1" aria-label="Jour suivant" '+(d>=auj()?"disabled":"")+' style="transform:scaleX(-1)">'+ICO.retour+'</button></div>'}


/* ===== Poules qui ont pondu : 1 œuf = 1 poule qui a pondu (une poule pond au plus 1 œuf par jour) ===== */
function oeufsCumul(c,d,r){return somme(D.prod.filter(function(p){return p.date===d&&p.comp===c&&p.r<=r}),function(p){return p.oeufs})}
function dernierRam(c,d){var m=0;D.prod.forEach(function(p){if(p.date===d&&p.comp===c&&p.r>m)m=p.r});return m}
/* Combien ont pondu et combien pas encore, depuis le matin jusqu'au ramassage r */
function bilanPonte(c,d,r){var e=Math.max(0,effectif(c,d)),o=oeufsCumul(c,d,r);return {poules:e,oeufs:o,ont:Math.min(e,o),pas:Math.max(0,e-o)}}
function tablePonte(d){
  var R=D.reglages,cs=R.comps,L=[];
  RAMS.forEach(function(r){
    var vals=cs.map(function(c){if(!D.prod.some(function(p){return p.date===d&&p.comp===c.id&&p.r===r}))return null;return bilanPonte(c.id,d,r)});
    if(vals.every(function(v){return v===null}))return;
    L.push('<tr><td><b>Après R'+r+'</b><small>'+heureRamFr(r)+'</small></td>'+vals.map(function(v){return v?'<td class="n"><span class="'+(v.pas>0?"pas-pondu":"tout-pondu")+'">'+nb(v.pas)+'</span><small>'+nb(v.ont)+' ont pondu</small></td>':cellN(null)}).join("")+'</tr>');
  });
  var tete=["Pas encore pondu"].concat(cs.map(function(c){return c.court+'<br><small style="font-weight:400">'+nb(Math.max(0,effectif(c.id,d)))+' p.</small>'}));
  return tableau(tete,L,null,null,ligneBat(0))+'<p class="note-t">En gros : poules qui n\'ont pas encore pondu depuis le matin. 1 œuf ramassé = 1 poule qui a pondu (30 œufs par alvéole).</p>';
}


/* ===== Journal de la ferme : un seul tableau avec tout ce qui s'est passé ===== */
var J_FILTRES=[["tout","Tout"],["ram","Ramassages"],["argent","Ventes et rentrées"],["dep","Dépenses"],["sante","Malades et mortes"],["elev","Poules et aliment"]];
function lignesJournal(deb,fin){
  var R=D.reglages,f=function(x){return x.date>=deb&&x.date<=fin},L=[],cb=function(c){return c==="TOUS"?"Tous":comp(c).court};
  D.prod.filter(f).forEach(function(x){var a=alvDe(x.oeufs,x.casses);L.push({x:x,g:"ram",ic:["oeuf","prod"],b:cb(x.comp),q:"Ramassage "+(x.r||"")+(heureRam(x.r)?" <small>prévu "+heureRamFr(x.r)+"</small>":""),n:nb(a)+" alv."+(n0(x.casses)?"<small>"+nb(x.casses)+" cassés</small>":""),m:"<small>valeur</small>"+nb(a*n0(R.prix)),s:0,alv:a})});
  D.mouv.filter(f).forEach(function(x){var mo=x.type==="mort";L.push({x:x,g:mo?"sante":"elev",ic:mo?["mortes","sante"]:["poule","elev"],b:cb(x.comp),q:mo?"Poules mortes":TYPES_MOUV[x.type],n:mo&&!n0(x.n)?"aucune":nb(x.n),m:"",s:0,morts:mo?n0(x.n):0})});
  D.malades.filter(f).forEach(function(x){L.push({x:x,g:"sante",ic:["malade","sante"],b:cb(x.comp),q:"Poules malades<small>"+esc(x.signes)+(x.trait?" · "+esc(x.trait):"")+"</small>",n:'<span class="rouge">'+nb(x.n)+'</span>',m:"",s:0,mal:n0(x.n)})});
  D.vaccins.filter(f).forEach(function(x){L.push({x:x,g:"sante",ic:["vaccin","sante"],b:cb(x.comp),q:"Vaccin<small>"+esc(x.vaccin)+"</small>",n:"",m:"",s:0})});
  D.alimOut.filter(f).forEach(function(x){L.push({x:x,g:"elev",ic:["aliment","elev"],b:cb(x.comp),q:"Aliment donné",n:nb(x.sacs)+" sacs",m:"",s:0})});
  D.alimIn.filter(f).forEach(function(x){L.push({x:x,g:"dep",ic:["aliment","arg"],b:"",q:"Achat d'aliment<small>"+nb(x.sacs)+" sacs</small>",n:"",m:'<span class="sortie">− '+nb(x.montant)+'</span>',s:-n0(x.montant),dep:n0(x.montant)})});
  D.dep.filter(f).forEach(function(x){if(x.auto)return;L.push({x:x,g:"dep",ic:["depenses","arg"],b:"",q:"Dépense : "+esc(x.cat)+"<small>"+esc(x.note||"")+(srcRecu(x)?' <button class="recu-btn" data-act="voirRecu" data-l="dep" data-id="'+x.id+'">reçu</button>':' <span class="rouge">sans reçu</span>')+"</small>",n:"",m:'<span class="sortie">− '+nb(x.montant)+'</span>',s:-n0(x.montant),dep:n0(x.montant)})});
  D.ventes.filter(f).forEach(function(x){var r=venteReste(x);L.push({x:x,g:"argent",ic:["ventes","arg"],b:"",q:"Vente à "+esc(x.client)+(n0(x.paye)<venteTotal(x)?'<small class="rouge">crédit '+nb(venteTotal(x)-n0(x.paye))+'</small>':""),n:nb(x.alv)+" alv.",m:'<span class="entree">+ '+nb(x.paye)+'</span>',s:n0(x.paye),entree:n0(x.paye)})});
  D.regl.filter(f).forEach(function(x){var v=D.ventes.find(function(y){return y.id===x.vente});L.push({x:x,g:"argent",ic:["credits","arg"],b:"",q:"Paiement d'un crédit"+(v?"<small>"+esc(v.client)+"</small>":""),n:"",m:'<span class="entree">+ '+nb(x.montant)+'</span>',s:n0(x.montant),entree:n0(x.montant)})});
  D.vers.filter(f).forEach(function(x){L.push({x:x,g:"argent",ic:["benef","arg"],b:"",q:"Versement au DG<small>cycle "+x.cycle+"</small>",n:"",m:'<span class="verse">'+nb(x.montant)+'</span>',s:0})});
  D.comptages.filter(f).forEach(function(x){L.push({x:x,g:"elev",ic:["poule","elev"],b:cb(x.comp),q:"Nombre de poules enregistré",n:nb(x.n),m:"",s:0})});
  return L.sort(function(a,b){return a.x.date<b.x.date?1:a.x.date>b.x.date?-1:(b.x.t||0)-(a.x.t||0)});
}
function vueJournal(){
  var per=V.jPer||"jour",fi=V.jFiltre||"tout",P=periode(),deb,fin,h='';
  if(per==="jour"){deb=fin=V.jJour||auj()}else if(per==="7"){fin=auj();deb=decal(fin,-6)}else{deb=P.deb;fin=P.fin}
  var tous=lignesJournal(deb,fin),L=fi==="tout"?tous:tous.filter(function(e){return e.g===fi});
  // choix de la période
  h+='<div class="seg j-per">'+[["jour","Ce jour"],["7","7 derniers jours"],["mois","Le mois"]].map(function(x){return '<button data-act="jPer" data-v="'+x[0]+'" class="'+(per===x[0]?"on":"")+'">'+x[1]+'</button>'}).join("")+'</div>';
  if(per==="jour")h+='<p class="j-dates">'+dComplete(deb)+'</p>';
  if(false)h+='<div class="nav-jour petit"><button class="ico" data-act="jJour" data-v="-1" aria-label="Jour précédent">'+ICO.retour+'</button><div><b>'+(deb===auj()?"Aujourd'hui":jourSem(deb))+'</b><small>'+dComplete(deb)+'</small></div><button class="ico" data-act="jJour" data-v="1" aria-label="Jour suivant" '+(deb>=auj()?"disabled":"")+' style="transform:scaleX(-1)">'+ICO.retour+'</button></div>';
  else h+='<p class="j-dates">du '+dComplete(deb)+' au '+dComplete(fin)+'</p>';
  // totaux de la période
  var t=function(k){return somme(tous,function(e){return e[k]||0})};
  h+='<div class="j-tot"><div><b>'+nb(t("alv"))+'</b><small>alvéoles</small></div><div><b class="'+(t("mal")?"rouge":"")+'">'+nb(t("mal"))+'</b><small>malades</small></div><div><b>'+nb(t("morts"))+'</b><small>mortes</small></div><div class="large"><b class="entree">'+nb(t("entree"))+'</b><small>GNF rentrés</small></div><div class="large"><b class="sortie">'+nb(t("dep"))+'</b><small>GNF dépensés</small></div></div>';
  // filtres
  h+='<div class="chips j-fil">'+J_FILTRES.map(function(x){return '<button class="chip '+(fi===x[0]?"on":"")+'" data-act="jFiltre" data-v="'+x[0]+'">'+x[1]+'</button>'}).join("")+'</div>';
  // le tableau, regroupé par jour
  var lim=V.jTout?L.length:80,rows=[],jourCourant="";
  L.slice(0,lim).forEach(function(e){
    if(e.x.date!==jourCourant){jourCourant=e.x.date;var dj=tous.filter(function(z){return z.x.date===jourCourant});
      rows.push('<tr class="j-jour"><td colspan="4"><b>'+dComplete(jourCourant)+'</b><span>'+nb(somme(dj,function(z){return z.alv||0}))+' alv. · <span class="entree">+'+nb(somme(dj,function(z){return z.entree||0}))+'</span> · <span class="sortie">−'+nb(somme(dj,function(z){return z.dep||0}))+'</span></span></td></tr>')}
    rows.push('<tr><td class="j-h">'+heure(e.x.t)+'<small>'+esc(prenom(e.x.par||""))+'</small></td><td class="j-q"><span class="j-qi">'+icone(e.ic[0],e.ic[1])+'<span>'+(e.b?'<b class="j-b">'+e.b+'</b> ':'')+e.q+'</span></span></td><td class="n">'+e.n+'</td><td class="n">'+e.m+'</td></tr>');
  });
  h+='<div class="tab-p journal"><table><thead><tr><th>Heure</th><th>Quoi</th><th class="n">Nombre</th><th class="n">GNF</th></tr></thead><tbody>'+(rows.length?rows.join(""):'<tr><td colspan="4" class="rien">Rien sur cette période</td></tr>')+'</tbody></table></div>';
  if(L.length>lim)h+='<button class="btn sec" data-act="jTout" style="margin-top:8px">Voir les '+(L.length-lim)+' lignes suivantes</button>';
  h+='<p class="note-t">Vert = argent rentré · rouge = argent dépensé · bleu = versé au DG. Sous « valeur » : la valeur des alvéoles ramassées (× '+nb(D.reglages.prix)+').</p>';
  return h;
}


/* Une case « ramassage » du tableau de bord : fait (avec l'heure réelle), pas fait, ou à venir */
function caseRam(c,r){
  var R=D.reglages,cs=R.comps,a=auj();
  if(c.deb===c.fin){var d=c.deb,recs=D.prod.filter(function(p){return p.date===d&&p.r===r}),faits=cs.filter(function(x){return recs.some(function(p){return p.comp===x.id})});
    var alv=somme(recs,function(p){return alvDe(p.oeufs,p.casses)}),manq=cs.filter(function(x){return faits.indexOf(x)<0});
    var enRetard=manq.filter(function(x){return ramEnRetard(x.id,d,r)});
    if(!manq.length){var tm=Math.max.apply(null,recs.map(function(p){return p.t||0}));return '<b>'+nb(alv)+'</b><small class="ok-r">✓ fait à '+heure(tm)+'</small>'}
    if(enRetard.length===cs.length)return '<span class="pas-fait">PAS FAIT</span><small class="rouge">prévu à '+heureRamFr(r)+'</small>';
    if(enRetard.length)return '<b>'+nb(alv)+'</b><small class="rouge">manque '+enRetard.map(function(x){return x.court}).join(", ")+'</small>';
    return (faits.length?'<b>'+nb(alv)+'</b>':'<span class="vide-c">–</span>')+'<small>'+(faits.length?"en cours":"prévu à "+heureRamFr(r))+'</small>';
  }
  var dd=c.deb,att=0,fa=0,alv2=0;
  while(dd<=c.fin){cs.forEach(function(x){var p=D.prod.filter(function(q){return q.date===dd&&q.comp===x.id&&q.r===r});
      if(p.length){fa++;alv2+=somme(p,function(q){return alvDe(q.oeufs,q.casses)})}
      if(dd<a||ramEnRetard(x.id,dd,r)||p.length)att++});dd=decal(dd,1)}
  return '<b>'+nb(alv2)+'</b><small class="'+(fa<att?"rouge":"ok-r")+'">'+fa+'/'+att+' faits</small>';
}
/* ===== Tableau de bord unique : toutes les rubriques, en lignes, pour aujourd'hui, hier et le mois ===== */
function tableauBord(){
  var R=D.reglages,a=auj(),h1=decal(a,-1),PM=periode();
  var cols=[{deb:a,fin:a,lib:"Aujourd'hui",d:dNum(a).slice(0,5)},{deb:h1,fin:h1,lib:"Hier",d:dNum(h1).slice(0,5)},{deb:PM.deb,fin:PM.fin,lib:"Mois",d:nomMois(PM.deb)}];
  var C=cols.map(function(c){return chiffresP({deb:c.deb,fin:c.fin,mois:c.deb!==c.fin})});
  var fx=function(c){return function(x){return x.date>=c.deb&&x.date<=c.fin}};
  /* Ramassages faits sur ceux qui étaient déjà dus (un ramassage à venir ne compte pas comme manquant) */
  var ramP=function(c){var n=0,t=0,d=c.deb;while(d<=c.fin){R.comps.forEach(function(x){RAMS.forEach(function(r){var f=ramSaisi(x.id,d,r);if(f)n++;if(f||d<a||ramEnRetard(x.id,d,r))t++})});d=decal(d,1)}return {n:n,t:t,manque:t-n}};
  var lignes=[
   ["prod","Production"],
   ["alv","Ramassages faits<small>sur ceux déjà prévus</small>",function(c,k){var r=ramP(c);return '<b class="'+(r.manque?"rouge":"ok-r")+'">'+r.n+'/'+r.t+'</b>'+(r.manque?'<small class="rouge">'+r.manque+' pas fait'+(r.manque>1?"s":"")+'</small>':'<small class="ok-r">tous faits</small>')}],
   ["alv","<span class=\"r-num\">R1</span>Ramassage 1<small>prévu à "+heureRamFr(1)+"</small>",function(c,k){return caseRam(c,1)}],
   ["alv","<span class=\"r-num\">R2</span>Ramassage 2<small>prévu à "+heureRamFr(2)+"</small>",function(c,k){return caseRam(c,2)}],
   ["alv","<span class=\"r-num\">R3</span>Ramassage 3<small>prévu à "+heureRamFr(3)+"</small>",function(c,k){return caseRam(c,3)}],
   ["alv","<span class=\"r-num\">R4</span>Ramassage 4<small>prévu à "+heureRamFr(4)+"</small>",function(c,k){return caseRam(c,4)}],
   ["alv","Total des alvéoles ramassées",function(c,k){return '<b>'+nb(C[k].alv)+'</b>'}],
   ["alv","Valeur des alvéoles (GNF)",function(c,k){return nb(C[k].alv*n0(R.prix))}],
   ["alv","Poules qui ont pondu",function(c,k){if(c.deb!==c.fin)return pct(C[k].ponte);var o=oeufsJour(null,c.deb),e=effectifTotal(c.deb);return e?nb(Math.min(o,e))+'<small>sur '+nb(e)+'</small>':"–"}],
   ["sante","Santé des poules"],
   ["mal","Poules malades",function(c,k){var v=C[k].malades;return v?'<span class="rouge">'+nb(v)+'</span>':"0"}],
   ["morts","Poules mortes",function(c,k){return nb(C[k].morts)}],
   ["mal","Vaccins donnés",function(c,k){return nb(D.vaccins.filter(fx(c)).length)}],
   ["elev","Élevage"],
   ["poules","Nombre de poules",function(c,k){return nb(effectifTotal(c.fin))}],
   ["alim","Aliment donné (sacs)",function(c,k){return nb(somme(D.alimOut.filter(fx(c)),function(x){return x.sacs}))}],
   ["arg","Argent"],
   ["ventes","Alvéoles vendues",function(c,k){return nb(C[k].alvVendues)}],
   ["ventes","Argent rentré (GNF)",function(c,k){return '<span class="entree">'+nb(C[k].enc)+'</span>'}],
   ["dep","Dépenses (GNF)",function(c,k){return '<span class="sortie">'+nb(C[k].totDep)+'</span>'}],
   ["dep","Dépenses sans reçu",function(c,k){return C[k].sansRecu?'<span class="rouge">'+C[k].sansRecu+'</span>':"0"}],
   ["dep","Dont salaires (GNF)",function(c,k){return nb(C[k].totSal)}],
   ["ventes","Reste (rentré − dépensé)",function(c,k){var b=C[k].enc-C[k].totDep;return '<b class="'+(b<0?"sortie":"entree")+'">'+nb(b)+'</b>'}]
  ];
  var h='<div class="tab-p bord"><table><thead><tr><th>Rubrique</th>'+cols.map(function(c){return '<th class="n">'+c.lib+'<small>'+c.d+'</small></th>'}).join("")+'</tr></thead><tbody>';
  lignes.forEach(function(l){
    if(!l[2]){h+='<tr class="b-sec c-'+l[0]+'"><td colspan="4">'+l[1]+'</td></tr>';return}
    h+='<tr class="clic" data-act="menuOuvrir" data-v="'+l[0]+'"><td>'+l[1]+'</td>'+cols.map(function(c,k){return '<td class="n">'+l[2](c,k)+'</td>'}).join("")+'</tr>';
  });
  var nv=cyclesNonVerses(),rv=somme(cycles(),function(c){return calcCycle(c).reste});
  h+='<tr class="b-sec c-arg"><td colspan="4">À tout moment</td></tr>';
  h+='<tr class="clic" data-act="menuOuvrir" data-v="ventes"><td>Crédits clients (GNF)</td><td class="n" colspan="3">'+nb(creditsTotal())+'</td></tr>';
  h+='<tr class="clic" data-act="menuOuvrir" data-v="vers"><td>À verser au DG (GNF)</td><td class="n" colspan="3"><b class="'+(nv.length?"rouge":"")+'">'+nb(rv)+'</b>'+(nv.length?'<small class="rouge">'+nv.length+' versement(s) en retard</small>':'')+'</td></tr>';
  h+='<tr class="clic" data-act="menuOuvrir" data-v="alv"><td>Alvéoles en stock</td><td class="n" colspan="3">'+nb(stockAlv(a))+'</td></tr>';
  return h+'</tbody></table></div><p class="note-t">Touchez une ligne pour voir son détail plus bas. Rouge = à regarder.</p>';
}

/* ===== Espace du PROPRIÉTAIRE : menus en couleur qui s'ouvrent juste en dessous ===== */
var GROUPES=[["prod","1. La production",["alv"]],["arg","2. L'argent",["ventes","dep","vers"]],["sante","3. La santé des poules",["mal","morts"]],["elev","4. L'élevage",["poules","alim"]],["gris","5. Le résumé",["resume"]]];
function menuInfo(k){return MENUS.find(function(x){return x[0]===k})}
function chiffreMenu(k,P){
  var C=chiffresP(P),R=D.reglages,al=function(t){return ' <span class="mv-alerte">'+t+'</span>'};
  if(k==="alv")return [nb(C.alv)+" alvéoles","valeur : "+gnf(C.alv*n0(R.prix))];
  if(k==="ventes")return [gnf(C.enc),nb(C.alvVendues)+" alvéoles vendues"];
  if(k==="dep")return [gnf(C.totDep),C.dep.length+" dépense"+(C.dep.length>1?"s":"")+(C.sansRecu?al(C.sansRecu+" sans reçu"):"")];
  if(k==="vers"){var r=somme(cycles(),function(c){return calcCycle(c).reste}),nv=cyclesNonVerses().length;return [gnf(r),"reste à vous verser"+(nv?al(nv+" versement"+(nv>1?"s":"")+" en retard"):"")]}
  if(k==="mal")return [nb(C.malades)+" malade"+(C.malades>1?"s":""),C.malades?al("à regarder"):"rien à signaler"];
  if(k==="morts")return [nb(C.morts)+" morte"+(C.morts>1?"s":""),"ce mois-ci"];
  if(k==="poules")return [nb(effectifTotal(P.fin))+" poules","dans les "+R.comps.length+" bâtiments"];
  if(k==="alim")return [nb(somme(D.alimOut.filter(dansP(P)),function(a){return a.sacs}))+" sacs","stock : "+nb(stockAliment(auj()))+" sacs"];
  return ["","Touchez pour lire ou écouter"];
}
function navMois(P){return '<div class="nav-jour"><button class="ico" data-act="jour" data-v="-1" aria-label="Mois précédent">'+ICO.retour+'</button><div><b>'+P.lib+'</b></div><button class="ico" data-act="jour" data-v="1" aria-label="Mois suivant" '+(P.fin>=auj()?"disabled":"")+' style="transform:scaleX(-1)">'+ICO.retour+'</button></div>'}

/* ===== Rubriques en grille : 3 par ligne, de gauche à droite ; le détail s'ouvre sous la grille ===== */
var COURTS={alv:"Alvéoles",ventes:"Ventes",dep:"Dépenses",vers:"À recevoir",mal:"Malades",morts:"Mortes",poules:"Poules",alim:"Aliment",resume:"Résumé"};
var ORDRE_GRILLE=["alv","ventes","dep","vers","mal","morts","poules","alim","resume"];
function court(n){n=Math.round(n0(n));if(Math.abs(n)>=1e6)return (Math.round(n/1e5)/10).toLocaleString("fr-FR")+" M";if(Math.abs(n)>=1e4)return Math.round(n/1e3).toLocaleString("fr-FR")+" k";return nb(n)}
function valeurTuile(k,P){
  var C=chiffresP(P),R=D.reglages;
  if(k==="alv")return [nb(C.alv),"alvéoles"];
  if(k==="ventes")return [court(C.enc),"GNF rentrés"];
  if(k==="dep")return [court(C.totDep),C.sansRecu?'<span class="rouge">'+C.sansRecu+' sans reçu</span>':"GNF"];
  if(k==="vers"){var r=somme(cycles(),function(c){return calcCycle(c).reste}),nv=cyclesNonVerses().length;return [court(r),nv?'<span class="rouge">en retard</span>':"GNF"]}
  if(k==="mal")return [nb(C.malades),C.malades?'<span class="rouge">à voir</span>':"ce mois"];
  if(k==="morts")return [nb(C.morts),"ce mois"];
  if(k==="poules")return [nb(effectifTotal(P.fin)),"poules"];
  if(k==="alim")return [nb(somme(D.alimOut.filter(dansP(P)),function(a){return a.sacs})),"sacs"];
  return ["","lire, écouter"];
}
function grilleRubriques(P){
  var h='<div class="grille-rub">';
  ORDRE_GRILLE.forEach(function(k){var m=menuInfo(k),v=valeurTuile(k,P),on=V.ouvertP===k,alerte=/rouge/.test(v[1]);
    h+='<button class="rub m-'+m[3]+(on?" on":"")+(alerte?" alerte":"")+'" data-act="menuOuvrir" data-v="'+k+'" aria-pressed="'+(on?"true":"false")+'"><span class="rub-ic">'+IC[m[2]]+'</span><b>'+COURTS[k]+'</b>'+(v[0]?'<span class="rub-v">'+v[0]+'</span>':'')+'<small>'+v[1]+'</small></button>'});
  return h+'</div><div id="panneau-menu">'+panneauMenu(P)+'</div>';
}
/* ===== Espace du DG : le temps d'abord (Aujourd'hui · Hier · Jours précédents), puis un tableau simple du jour ===== */
function jourChoisi(){return V.bordJour||auj()}
function nomJour(d){return d===auj()?"Aujourd'hui":d===decal(auj(),-1)?"Hier":jourSem(d)}
function barreTemps(){
  var d=jourChoisi(),onglet=V.bordListe?"avant":d===auj()?"auj":d===decal(auj(),-1)?"hier":"avant";
  var h='<div class="temps" role="tablist">'+[["auj","Aujourd'hui"],["hier","Hier"],["avant","Jours précédents"]].map(function(x){return '<button role="tab" data-act="temps" data-v="'+x[0]+'" class="'+(onglet===x[0]?"on":"")+'">'+x[1]+'</button>'}).join("")+'</div>';
  if(!V.bordListe)h+='<div class="temps-date"><button class="ico" data-act="bordJour" data-v="-1" aria-label="Jour d\'avant">'+ICO.retour+'</button><div><b>'+nomJour(d)+'</b><span>'+dComplete(d)+'</span></div><button class="ico" data-act="bordJour" data-v="1" aria-label="Jour d\'après" '+(d>=auj()?"disabled":"")+' style="transform:scaleX(-1)">'+ICO.retour+'</button></div>';
  return h;
}
/* État du jour en une phrase */
function etatJour(d){
  var C=chiffresP({deb:d,fin:d,mois:false}),A=attention({deb:d,fin:d,mois:false},C).filter(function(a){return a.v!=="dVersement"}),graves=A.filter(function(a){return a.n===2});
  if(!A.length)return '<div class="etat ok">'+IC.ok+'<span><b>Tout va bien</b><small>Rien à signaler pour '+(d===auj()?"aujourd'hui":"ce jour")+'</small></span></div>';
  var h='<div class="etat '+(graves.length?"alerte":"attention")+'">'+IC.alerte+'<span><b>'+A.length+' point'+(A.length>1?"s":"")+' à regarder</b><small>'+A.slice(0,3).map(function(a){return esc(a.t)}).join(" · ")+'</small></span></div>';
  return h;
}
function ligne(lib,val,cls,sous,v){return '<tr'+(v?' class="clic" data-act="menuOuvrir" data-v="'+v+'"':'')+'><td>'+lib+(sous?'<small>'+sous+'</small>':'')+'</td><td class="n'+(cls?" "+cls:"")+'">'+val+'</td></tr>'}
function tableJour(d){
  var R=D.reglages,cs=R.comps,a=auj(),C=chiffresP({deb:d,fin:d,mois:false}),h='';
  // 1. Ramassages, heure par heure
  h+='<div class="tj-bloc c-prod"><div class="tj-titre">'+IC.horloge+'Ramassages de la journée</div><table class="tj tj-ram"><thead><tr><th>Heure</th>'+cs.map(function(c){return '<th class="n">'+esc(c.court)+'</th>'}).join("")+'<th class="n">État</th></tr></thead><tbody>';
  RAMS.forEach(function(r){
    var recs=D.prod.filter(function(p){return p.date===d&&p.r===r}),manq=cs.filter(function(c){return !recs.some(function(p){return p.comp===c.id})}),ret=manq.filter(function(c){return ramEnRetard(c.id,d,r)});
    var etat=!manq.length?'<span class="pastille ok">✓ '+heure(Math.max.apply(null,recs.map(function(p){return p.t||0})))+'</span>':ret.length?'<span class="pastille non">Pas fait</span>':recs.length?'<span class="pastille cours">En cours</span>':'<span class="pastille avenir">À venir</span>';
    h+='<tr><td><b>'+heureRamFr(r)+'</b><small>ramassage '+r+'</small></td>'+cs.map(function(c){var p=recs.filter(function(x){return x.comp===c.id});return p.length?'<td class="n"><b>'+nb(somme(p,function(x){return alvDe(x.oeufs,x.casses)}))+'</b></td>':'<td class="n">'+(ret.indexOf(c)>=0?'<span class="rouge">!</span>':'<span class="vide-c">–</span>')+'</td>'}).join("")+'<td class="n">'+etat+'</td></tr>';
  });
  var tc=cs.map(function(c){return alvDe(oeufsJour(c.id,d),cassesJour(c.id,d))});
  h+='<tr class="tot"><td>Total</td>'+tc.map(function(v){return '<td class="n">'+nb(v)+'</td>'}).join("")+'<td class="n"><b>'+nb(C.alv)+' alv.</b></td></tr></tbody></table>';
  h+='<p class="tj-pied">'+nb(C.alv)+' alvéoles × '+gnf(R.prix)+' = <b>'+gnf(C.alv*n0(R.prix))+'</b></p></div>';
  // 2. Les poules
  var e=effectifTotal(d),o=oeufsJour(null,d),rf=ramsFaitsListe(d).length;
  h+='<div class="tj-bloc c-elev"><div class="tj-titre">'+IC.poule+'Les poules</div><table class="tj"><tbody>';
  h+=ligne("Nombre de poules",'<b>'+nb(e)+'</b>',"",cs.map(function(c){return esc(c.court)+" : "+nb(effectif(c.id,d))}).join(" · "),"poules");
  h+=ligne("Ont pondu",e?'<b>'+nb(Math.min(o,e))+'</b><small>'+Math.round(Math.min(o,e)/e*100)+' sur 100</small>':"–","",rf<4?"au fil des ramassages":"sur la journée","alv");
  h+=ligne("Malades",C.malades?'<b>'+nb(C.malades)+'</b>':"0",C.malades?"rouge":"","","mal");
  h+=ligne("Mortes",nb(C.morts),C.morts>=R.seuilMorts?"rouge":"","","morts");
  h+=ligne("Aliment donné",nb(somme(D.alimOut.filter(function(x){return x.date===d}),function(x){return x.sacs}))+" sacs","","","alim");
  h+='</tbody></table></div>';
  // 3. L'argent
  var b=C.enc-C.totDep;
  h+='<div class="tj-bloc c-arg"><div class="tj-titre">'+IC.ventes+'L\'argent</div><table class="tj"><tbody>';
  h+=ligne("Argent rentré",'<span class="entree">+ '+nb(C.enc)+'</span>',"",nb(C.alvVendues)+" alvéoles vendues","ventes");
  h+=ligne("Argent dépensé",'<span class="sortie">− '+nb(C.totDep)+'</span>',"",C.sansRecu?'<span class="rouge">'+C.sansRecu+' sans reçu</span>':(C.dep.length?"reçus complets":""),"dep");
  h+=ligne("Reste du jour",'<b class="'+(b<0?"sortie":"entree")+'">'+nb(b)+'</b>',"","GNF","ventes");
  h+='</tbody></table></div>';
  // 4. À suivre (ne dépend pas du jour)
  var nv=cyclesNonVerses(),rv=somme(cycles(),function(c){return calcCycle(c).reste});
  h+='<div class="tj-bloc c-gris"><div class="tj-titre">'+IC.liste+'À suivre</div><table class="tj"><tbody>';
  h+=ligne("À verser au DG",'<b'+(nv.length?' class="rouge"':'')+'>'+nb(rv)+'</b>',"",nv.length?'<span class="rouge">'+nv.length+' versement(s) en retard</span>':"GNF","vers");
  h+=ligne("Crédits clients",nb(creditsTotal()),"","GNF","ventes");
  h+=ligne("Alvéoles en stock",nb(stockAlv(a)),"","","alv");
  return h+'</tbody></table></div>';
}
/* Jours précédents : un jour par ligne, on touche pour l'ouvrir */
function listeJours(){
  var R=D.reglages,n=V.nbJours||14,h='<p class="aide" style="margin:10px 2px">Touchez un jour pour voir son tableau. <b class="ok-r">✓</b> = journée complète · <b class="rouge">!</b> = ramassage manquant ou problème.</p><div class="liste-jours">';
  for(var i=0;i<n;i++){var d=decal(auj(),-i),C=chiffresP({deb:d,fin:d,mois:false}),A=alertes(d).filter(function(x){return x.k==="alerte"}).length,rf=ramFaits(d);
    h+='<button class="lj" data-act="choisirJour" data-v="'+d+'"><span class="lj-d"><b>'+nomJour(d)+'</b><small>'+dNum(d)+'</small></span><span class="lj-v"><b>'+nb(C.alv)+'</b><small>alvéoles</small></span><span class="lj-v"><b class="entree">'+nb(C.enc)+'</b><small>rentré</small></span><span class="lj-e '+(A?"non":rf<NR()&&d<auj()?"non":"ok")+'">'+(A||(rf<NR()&&d<auj())?"!":"✓")+'</span></button>'}
  return h+'</div><button class="btn sec" data-act="plusJours" style="margin-top:8px">Afficher plus de jours</button>';
}

/* ===== Dépenses du DG : par période, par catégorie, puis jour par jour ===== */
var DEP_PER=[["auj","Aujourd'hui"],["hier","Hier"],["7","7 jours"],["mois","Ce mois"],["tout","Tout"]];
function periodeDep(){
  var p=V.depPer||"mois",a=auj(),P=periode();
  if(p==="auj")return {deb:a,fin:a,lib:"Aujourd'hui · "+dComplete(a)};
  if(p==="hier"){var h=decal(a,-1);return {deb:h,fin:h,lib:"Hier · "+dComplete(h)}}
  if(p==="7")return {deb:decal(a,-6),fin:a,lib:"Du "+dNum(decal(a,-6))+" au "+dNum(a)};
  if(p==="tout"){var dd=D.dep.reduce(function(m,x){return x.date<m?x.date:m},a);return {deb:dd,fin:a,lib:"Depuis le "+dNum(dd)}}
  return {deb:P.deb,fin:P.fin,lib:"Mois de "+nomMois(P.deb)+" "+P.deb.slice(0,4)};
}
function contenuDepenses(){
  var Q=periodeDep(),L=D.dep.filter(function(x){return x.date>=Q.deb&&x.date<=Q.fin}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(b.t||0)-(a.t||0)});
  var tot=somme(L,function(x){return x.montant}),sr=L.filter(function(x){return !srcRecu(x)}).length,h='';
  h+='<div class="chips j-fil">'+DEP_PER.map(function(x){return '<button class="chip '+((V.depPer||"mois")===x[0]?"on":"")+'" data-act="depPer" data-v="'+x[0]+'">'+x[1]+'</button>'}).join("")+'</div>';
  if((V.depPer||"mois")==="mois")h+=navMois(periode());
  h+='<p class="j-dates" style="text-transform:none">'+Q.lib+'</p>';
  h+=kpis([[nb(tot),"GNF dépensés"],[nb(L.length),"dépense"+(L.length>1?"s":"")],[nb(sr),"sans reçu",sr>0]]);
  // 1. Par catégorie : toutes les catégories sont mentionnées
  var cat={},nbc={};L.forEach(function(x){cat[x.cat]=(cat[x.cat]||0)+n0(x.montant);nbc[x.cat]=(nbc[x.cat]||0)+1});
  var ordre=CATS.map(function(c){return c[0]}).concat(Object.keys(cat).filter(function(k){return !CATS.some(function(c){return c[0]===k})}));
  ordre.sort(function(a,b){return (cat[b]||0)-(cat[a]||0)});
  h+='<h3 class="sous-t">Dans quoi l\'argent a été dépensé</h3><div class="tab-p"><table><thead><tr><th>Catégorie</th><th class="n">Montant (GNF)</th></tr></thead><tbody>';
  h+='<tr class="tot"><td>Total<small>'+nb(L.length)+' dépense'+(L.length>1?"s":"")+'</small></td><td class="n"><b>'+nb(tot)+'</b></td></tr>';
  ordre.forEach(function(k){var e=(CATS.find(function(c){return c[0]===k})||["","note"])[1],v=cat[k]||0;
    h+='<tr class="'+(v?"":"zero")+'"><td class="g"><span class="cat-l">'+icone(e,"arg")+'<span>'+esc(k)+'<small>'+(nbc[k]||0)+' dépense'+((nbc[k]||0)>1?"s":"")+'</small></span></span></td><td class="n">'+(v?'<b class="sortie">'+nb(v)+'</b>':'0')+'</td></tr>'});
  h+='</tbody></table></div>';
  // 2. Jour par jour, chaque dépense
  h+='<h3 class="sous-t">Chaque dépense, jour par jour</h3>';
  if(!L.length)return h+'<div class="vide">Aucune dépense sur cette période.</div>';
  var rows=[],jc2="";
  L.forEach(function(x){
    if(x.date!==jc2){jc2=x.date;var dj=L.filter(function(z){return z.date===jc2});rows.push('<tr class="j-jour"><td colspan="3"><b>'+nomJour(jc2)+' · '+dNum(jc2)+'</b><span>'+dj.length+' dépense'+(dj.length>1?"s":"")+' · <span class="sortie">− '+nb(somme(dj,function(z){return z.montant}))+'</span></span></td></tr>')}
    var e=(CATS.find(function(c){return c[0]===x.cat})||["","note"])[1],s2=srcRecu(x);
    rows.push('<tr><td class="j-h">'+heure(x.t)+'<small>'+esc(prenom(x.par||""))+'</small></td><td class="j-q"><span class="j-qi">'+icone(e,"arg")+'<span><b>'+esc(x.cat)+'</b>'+(x.note?'<small>'+esc(x.note)+'</small>':'')+(x.imprevu?'<small class="rouge">imprévu</small>':'')+'<small>'+(s2?'<button class="recu-btn" data-act="voirRecu" data-l="dep" data-id="'+x.id+'">Voir le reçu</button>':'<span class="rouge">sans reçu</span>')+'</small></span></span></td><td class="n"><span class="sortie">− '+nb(x.montant)+'</span></td></tr>');
  });
  return h+'<div class="tab-p journal"><table><thead><tr><th>Heure</th><th>Dépense</th><th class="n">GNF</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';
}

/* ===== Espace du DG : tout est rangé dans des menus ; on touche un menu, l'information s'ouvre en dessous ===== */
var MENUS_DG=[
  ["jour","Aujourd'hui","horloge","prod","Le tableau du jour"],
  ["avant","Jours passés","note","gris","Revoir un jour précédent"],
  ["journal","Journal","liste","gris","Chaque saisie, avec l'heure"],
  ["alv","Alvéoles","oeuf","prod","Par ramassage et par bâtiment"],
  ["ventes","Ventes","ventes","arg","Ventes et argent rentré"],
  ["dep","Dépenses","depenses","arg","Toutes les dépenses, par catégorie"],
  ["vers","À recevoir","benef","arg","Versements du commercial"],
  ["mal","Malades","malade","sante","Poules malades et vaccins"],
  ["morts","Mortes","mortes","sante","Poules mortes chaque jour"],
  ["poules","Poules","poule","elev","Nombre par bâtiment"],
  ["alim","Aliment","aliment","elev","Sacs donnés et stock"],
  ["resume","Résumé","voix","gris","À écouter ou envoyer"]
];
var PAR_JOUR={jour:1,avant:1,journal:1,resume:1,dep:1};
function menuDG(k){return MENUS_DG.find(function(x){return x[0]===k})}
function valeurMenuDG(k,P){
  var d=jourChoisi(),a=auj();
  if(k==="jour"){var C=chiffresP({deb:a,fin:a,mois:false}),A=attention({deb:a,fin:a,mois:false},C).filter(function(x){return x.v!=="dVersement"});return [nb(C.alv)+" alv.",A.length?'<span class="rouge">'+A.length+' point'+(A.length>1?"s":"")+'</span>':"tout va bien"]}
  if(k==="avant")return ["","historique"];
  if(k==="journal"){var n=toutesSaisies().filter(function(it){return it.x.date===a}).length;return [nb(n),"saisies aujourd'hui"]}
  if(k==="resume")return ["","écouter, envoyer"];
  return valeurTuile(k,P);
}
function grilleDG(P){
  var h='<div class="grille-rub">';
  MENUS_DG.forEach(function(m){var k=m[0],v=valeurMenuDG(k,P),on=V.ouvertP===k,alerte=/rouge/.test(v[1]);
    h+='<button class="rub m-'+m[3]+(on?" on":"")+(alerte?" alerte":"")+'" data-act="menuOuvrir" data-v="'+k+'" aria-pressed="'+(on?"true":"false")+'"><span class="rub-ic">'+IC[m[2]]+'</span><b>'+m[1]+'</b>'+(v[0]?'<span class="rub-v">'+v[0]+'</span>':'')+'<small>'+v[1]+'</small></button>'});
  return h+'</div><div id="panneau-menu">'+panneauMenu(P)+'</div>';
}
function contenuDG(k,P){
  var d=jourChoisi();
  if(k==="jour"){var h='<div class="temps-date"><button class="ico" data-act="bordJour" data-v="-1" aria-label="Jour d\'avant">'+ICO.retour+'</button><div><b>'+nomJour(d)+'</b><span>'+dComplete(d)+'</span></div><button class="ico" data-act="bordJour" data-v="1" aria-label="Jour d\'après" '+(d>=auj()?"disabled":"")+' style="transform:scaleX(-1)">'+ICO.retour+'</button></div>';
    return h+etatJour(d)+tableJour(d)}
  if(k==="avant")return listeJours();
  if(k==="journal"){V.jJour=d;return vueJournal()}
  if(k==="resume"){var PJ={deb:d,fin:d,mois:false,lib:nomJour(d)},t=rapportSoir(d);
    return '<div class="resume-top" style="margin-top:0"><div class="rj-tete"><b>'+nomJour(d)+'<small class="date-num">'+dComplete(d)+'</small></b><button class="btn petit" id="btnVoix" data-act="ecouter" data-v="jour">'+(voixEnCours?IC.stop+" Arrêter":IC.voix+" Écouter")+'</button></div><p>'+resumePhrases(PJ).map(esc).join(" ")+'</p></div>'+
      '<div class="duo" style="margin-top:10px"><a class="btn" href="https://wa.me/?text='+encodeURIComponent(t)+'" target="_blank" rel="noopener">'+IC.rapport+' WhatsApp</a><button class="btn sec" data-act="copier">Copier le rapport</button></div>'}
  if(k==="dep")return contenuDepenses();
  return navMois(P)+contenuMenu(k,P);
}
function panneauMenu(P){
  var k=V.ouvertP;if(!k)return '';
  var m=menuDG(k)||menuInfo(k);if(!m)return '';
  var sous=m[4]+(PAR_JOUR[k]?"":" · "+nomMois(P.deb));
  return '<div class="panneau m-'+m[3]+'"><div class="pn-tete"><span class="mv-ic">'+IC[m[2]]+'</span><span class="x"><b>'+m[1]+'</b><small>'+sous+'</small></span><button class="ico" data-act="menuOuvrir" data-v="'+k+'" aria-label="Fermer">'+ICO.fermer+'</button></div><div class="mv-contenu">'+contenuDG(k,P)+'</div></div>';
}
function vueFerme(){
  V.periode="mois";
  if(V.ouvertP===undefined)V.ouvertP="jour";
  var P=periode(),h='',a=auj(),C=chiffresP({deb:a,fin:a,mois:false}),A=attention({deb:a,fin:a,mois:false},C).filter(function(x){return x.v!=="dVersement"});
  h+=guide(moi());
  h+='<div class="entete-dg"><div><small>Aujourd\'hui</small><b>'+dComplete(a)+'</b></div><button class="etat-mini '+(A.length?(A.some(function(x){return x.n===2})?"alerte":"attention"):"ok")+'" data-act="menuOuvrir" data-v="jour">'+(A.length?IC.alerte+A.length+' à regarder':IC.ok+'Tout va bien')+'</button></div>';
  h+=grilleDG(P);
  return h;
}

/* Ouvre ou ferme un menu directement à sa place, sans redessiner tout l'écran */
function basculerMenu(k){
  if(voixEnCours){speechSynthesis.cancel();voixEnCours=false}
  V.ouvertP=V.ouvertP===k?null:k;V.jourOuvert=null;V.cycleOuvert=null;
  var pn=document.getElementById("panneau-menu");
  if(!pn){V.vueProprio="ferme";V.page="accueil";V.bordListe=false;rendreApp();pn=document.getElementById("panneau-menu")}
  else{var P=periode();document.querySelectorAll(".grille-rub .rub").forEach(function(b){var on=b.getAttribute("data-v")===V.ouvertP;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false")});pn.innerHTML=panneauMenu(P)}
  if(V.ouvertP&&pn){var e=pn.firstChild;if(e)placer(e)}
}
function fermerBloc(e){e.classList.remove("ouvert");var c=e.querySelector(".mv-contenu");if(c)c.remove();var bt=e.querySelector(".mv-carte");if(bt){bt.setAttribute("aria-expanded","false");bt.querySelector(".mv-fl").textContent="▼"}}
/* Fait remonter la carte ouverte juste sous l'en-tête, sans à-coup */
function placer(e){var hd=document.querySelector("header.barre"),haut=(hd?hd.getBoundingClientRect().bottom:0)+8,r=e.getBoundingClientRect();if(Math.abs(r.top-haut)>4)window.scrollTo(0,window.scrollY+r.top-haut)}
function majContenuOuvert(){var e=V.ouvertP&&document.getElementById("panneau-menu"),c=e&&e.querySelector(".mv-contenu");if(!c)return false;var y=window.scrollY;c.innerHTML=contenuDG(V.ouvertP,periode());window.scrollTo(0,y);return true}
function kpis(L){return '<div class="kpis">'+L.map(function(x){return '<div><b'+(x[2]?' class="rouge"':'')+'>'+x[0]+'</b><small>'+x[1]+'</small></div>'}).join("")+'</div>'}
function contenuMenu(k,P){
  var C=chiffresP(P),R=D.reglages,h='';
  if(k==="alv"){var js=joursP(P).filter(function(j){return D.prod.some(function(p){return p.date===j})}).length;
    var dj=V.jourAlv||auj();
    h+='<h3 class="sous-t">Alvéoles du jour, par ramassage</h3>'+navJourAlv(dj)+tableRamBat(dj);
    h+='<h3 class="sous-t">Poules qui n\'ont pas encore pondu</h3>'+tablePonte(dj);
    h+='<h3 class="sous-t">Tout le mois de '+nomMois(P.deb)+'</h3>'+kpis([[nb(C.alv),"alvéoles"],[nb(C.alv*n0(R.prix)),"GNF de valeur"],[js?nb(Math.round(C.alv/js)):"–","par jour"]])+tAlv(P);}
  else if(k==="ventes")h+=kpis([[nb(C.enc),"GNF encaissés"],[nb(C.alvVendues),"alvéoles vendues"],[nb(creditsTotal()),"GNF de crédits",creditsTotal()>0]])+tVentes(P);
  else if(k==="dep")h+=kpis([[nb(C.totDep),"GNF dépensés"],[nb(C.dep.length),"dépenses"],[nb(C.sansRecu),"sans reçu",C.sansRecu>0]])+tDep(P);
  else if(k==="vers"){var cs=cycles(),r=somme(cs,function(c){return calcCycle(c).reste}),vs=somme(D.vers,function(v){return v.montant});
    var cc=cycleCourant(),kc=cc?calcCycle(cc):null;
    h+=(kc?'<p class="note-t" style="margin:0 2px 6px;font-weight:700">Cycle '+cc.n+' en cours · jour '+cc.jours.length+' sur '+joursCycle()+'</p>'+lignesCalcul(cc,kc).split('<table')[0]:'')+kpis([[nb(r),"GNF reste à verser (tous cycles)",r>0],[nb(vs),"GNF déjà versés"]])+tVers();}
  else if(k==="mal")h+=kpis([[nb(C.malades),"malades",C.malades>0],[nb(D.malades.filter(dansP(P)).length),"signalements"]])+tMal(P);
  else if(k==="morts")h+=kpis([[nb(C.morts),"mortes",C.morts>0],[nb(effectifTotal(P.fin)),"poules restantes"]])+tMorts(P);
  else if(k==="poules")h+=kpis([[nb(effectifTotal(auj())),"poules aujourd'hui"],[nb(C.morts),"mortes ce mois"]])+panneauPoules();
  else if(k==="alim"){var sd=somme(D.alimOut.filter(dansP(P)),function(a){return a.sacs});h+=kpis([[nb(sd),"sacs donnés"],[nb(stockAliment(auj())),"sacs en stock",stockAliment(auj())<=R.seuilAliment]])+tAlim(P);}
  else h+=tResume(P);
  return h;
}
function fTab(){var P=periode();return navMois(P)+contenuMenu(V.F.menu,P)}

function casesDetails(P,C){
  var R=D.reglages,f=dansP(P),h='',mqR=P.mois?0:ramManquants(P.fin).length,rf=ramFaits(P.fin),rt=R.comps.length*4;
  var sacs=somme(D.alimOut.filter(f),function(a){return a.sacs}),vac=D.vaccins.filter(f).length,rappels=D.vaccins.filter(function(v){return v.rappel&&!v.fait&&v.rappel<=decal(auj(),3)}).length,nbCr=D.ventes.filter(function(v){return venteReste(v)>0}).length;
  h+=section("prod","Production",tuile("dRam",P.mois?nb(D.prod.filter(f).length):rf+"/"+rt,"Ramassages",mqR?mqR+" en retard":"saisis",mqR>0)+tuile("dStock",nb(stockAlv(P.fin)),"Stock","alvéoles"));
  h+=section("elev","Poules",tuile("dPoules",nb(effectifTotal(P.fin)),"Poules",R.comps.length+" bâtiments")+tuile("dAliment",nb(sacs),"Aliment","sacs donnés"));
  h+=section("sante","Santé",tuile("dMalades",nb(C.malades),"Malades",C.malades?"voir les signes":"aucune",C.malades>0)+tuile("dMorts",nb(C.morts),"Mortes",C.morts?"par bâtiment":"aucune",C.morts>=R.seuilMorts)+tuile("dVaccins",nb(vac),"Vaccins",rappels?rappels+" rappel(s)":"à jour",rappels>0));
  h+=section("arg","Argent",tuile("dSalaires",nb(C.totSal),"Salaires","GNF")+tuile("dCredits",nb(creditsTotal()),"Crédits","GNF · "+nbCr+" client"+(nbCr>1?"s":"")));
  return h;
}

/* ---------- Détails (feuilles en lecture) ---------- */
function enTete(P,txt){return '<div class="det-per">'+P.lib+(P.mois?" · du "+dateCourte(P.deb)+" au "+dateCourte(P.fin):"")+'</div>'+(txt?'<p class="aide">'+txt+'</p>':'')}
function ligneT(a,b,fort){return '<tr><td>'+(fort?'<b>'+a+'</b>':a)+'</td><td class="n">'+(fort?'<b>'+b+'</b>':b)+'</td></tr>'}
function badgeC(c){return '<span class="badge" style="font-size:13px;padding:3px 7px">'+c.court+'</span>'}
function dRam(){
  var P=periode(),R=D.reglages,h=enTete(P);
  if(P.mois){
    var f=dansP(P),js=joursP(P),complets=js.filter(function(j){return ramFaits(j)===R.comps.length*4}).length;
    h+='<div class="bloc"><table class="t">'+ligneT("Jours complets ("+NR()+" ramassages)",complets+" / "+js.length,true);
    RAMS.forEach(function(r){var n=D.prod.filter(function(p){return p.r===r&&f(p)}).length;h+=ligneT("Ramassage "+r+" ("+heureRamFr(r)+")",n+" saisies sur "+js.length*R.comps.length)});
    return h+'</table></div><p class="aide">Passez en mode « Jour » pour voir le détail heure par heure.</p>';
  }
  var d=P.fin;
  RAMS.forEach(function(r){
    var o=oeufsJour(null,d,r),ca=cassesJour(null,d,r);
    h+='<div class="bloc"><div class="det-ram"><span><b>Ramassage '+r+'</b><small>prévu à '+(heureRamFr(r)||"–")+'</small></span><span class="gros-n">'+nb(alvDe(o,ca))+'<small>alvéoles</small></span></div><table class="t">';
    R.comps.forEach(function(c){var p=D.prod.find(function(x){return x.date===d&&x.comp===c.id&&x.r===r});
      h+='<tr><td>'+badgeC(c)+' '+(p?'<small style="color:var(--gris)">saisi à '+heure(p.t)+' · '+esc(prenom(p.par||""))+'</small>':(ramEnRetard(c.id,d,r)?'<small class="sans-recu">en retard</small>':'<small style="color:var(--gris)">pas encore</small>'))+'</td><td class="n">'+(p?nb(alvDe(p.oeufs,p.casses))+' alv.'+(n0(p.casses)?' <small style="color:var(--gris)">('+nb(p.casses)+' cassés)</small>':''):'–')+'</td></tr>'});
    h+='</table></div>';
  });
  return h;
}
function dProd(){
  var P=periode(),R=D.reglages,C=chiffresP(P),h=enTete(P);
  if(!P.mois){var d=P.fin;
    h+='<div class="bloc"><table class="t">';
    R.comps.forEach(function(c){h+=ligneT(badgeC(c)+' '+nb(effectif(c.id,d))+' poules',nb(alvDe(oeufsJour(c.id,d),cassesJour(c.id,d)))+' alv. · '+pct(ponte(c.id,d)))});
    return h+ligneT("Total",nb(C.alv)+" alv. · "+pct(ponte(null,d)),true)+'</table><p class="aide" style="margin:8px 0 0">'+nb(C.oeufs)+' œufs ramassés, dont '+nb(C.casses)+' cassés. Taux de ponte = œufs ÷ poules.</p></div>';
  }
  var js=joursP(P),mx=Math.max.apply(null,js.map(function(j){return oeufsJour(null,j)}).concat([1])),W=320,H=100,bw=W/js.length;
  h+='<div class="bloc"><b>Œufs ramassés chaque jour</b><svg class="svgbar" viewBox="0 0 '+W+' '+(H+16)+'" width="100%" role="img" aria-label="Œufs par jour" style="margin-top:8px">';
  js.forEach(function(j,i){var v=oeufsJour(null,j),hh=v/mx*H;h+='<rect x="'+(i*bw+1)+'" y="'+(H-hh)+'" width="'+Math.max(1,bw-2)+'" height="'+hh+'" rx="1.5"></rect>';if(i%5===0)h+='<text x="'+(i*bw+bw/2)+'" y="'+(H+12)+'" text-anchor="middle">'+(i+1)+'</text>'});
  h+='</svg></div><div class="bloc"><table class="t">'+ligneT("Alvéoles ramassées",nb(C.alv),true)+ligneT("Œufs ramassés",nb(C.oeufs))+ligneT("Œufs cassés",nb(C.casses))+ligneT("Taux de ponte moyen",pct(C.ponte))+ligneT("Jours saisis",C.joursProd+" / "+js.length);
  R.comps.forEach(function(c){var pr=D.prod.filter(function(p){return p.comp===c.id&&p.date>=P.deb&&p.date<=P.fin});h+=ligneT(badgeC(c),nb(alvDe(somme(pr,function(p){return p.oeufs}),somme(pr,function(p){return p.casses})))+" alv.")});
  return h+'</table></div>';
}
function dPoules(){
  var P=periode(),R=D.reglages,f=dansP(P),h=enTete(P,"Nombre exact de poules par bâtiment, saisi par le technicien.");
  R.comps.forEach(function(c){
    var k=dernierComptage(c.id,P.fin),mv=D.mouv.filter(function(m){return m.comp===c.id&&m.type!=="mort"&&f(m)});
    h+='<div class="bloc"><div class="det-ram"><span>'+badgeC(c)+' <small>'+esc(c.nom)+'</small></span><span class="gros-n">'+nb(effectif(c.id,P.fin))+'<small>poules</small></span></div>';
    h+='<p class="aide" style="margin:0">'+(k?'Dernier comptage : '+nb(k.n)+' le '+dateCourte(k.date)+' par '+esc(k.par||""):'<span class="sans-recu">Jamais compté</span>')+'</p>';
    mv.forEach(function(m){h+='<p class="aide" style="margin:4px 0 0">'+dateCourte(m.date)+' : '+TYPES_MOUV[m.type]+' · '+nb(m.n)+(m.note?" · "+esc(m.note):"")+'</p>'});
    h+='</div>';
  });
  return h;
}
function dMalades(){
  var P=periode(),f=dansP(P),L=D.malades.filter(f).sort(function(a,b){return (b.t||0)-(a.t||0)}),h=enTete(P);
  if(!L.length)return h+'<div class="alerte ok"><b>Aucune poule malade signalée.</b></div>';
  var par={};L.forEach(function(m){par[m.comp]=(par[m.comp]||0)+n0(m.n)});
  h+='<div class="bloc"><table class="t">';D.reglages.comps.forEach(function(c){if(par[c.id])h+=ligneT(badgeC(c)+' '+esc(c.nom),nb(par[c.id])+" malade"+(par[c.id]>1?"s":""))});
  h+=ligneT("Total",nb(somme(L,function(m){return m.n})),true)+'</table></div><div class="bloc"><ul class="hist">';
  L.forEach(function(m){h+='<li>'+icone("malade","sante")+'<span class="x"><b>'+nb(m.n)+' malade'+(m.n>1?"s":"")+' · '+esc(comp(m.comp).court)+'</b><small>'+dateCourte(m.date)+' '+heure(m.t)+' · '+esc(m.par||"")+'</small><small><b style="color:var(--encre)">Signes :</b> '+esc(m.signes)+'</small><small><b style="color:var(--encre)">Traitement :</b> '+(m.trait?esc(m.trait):"aucun noté")+'</small></span></li>'});
  return h+'</ul></div>';
}
function dMorts(){
  var P=periode(),R=D.reglages,f=dansP(P),h=enTete(P);
  var L=D.mouv.filter(function(m){return m.type==="mort"&&f(m)});
  h+='<div class="bloc"><table class="t">';
  R.comps.forEach(function(c){var l=L.filter(function(m){return m.comp===c.id}),n=somme(l,function(m){return m.n});
    h+=ligneT(badgeC(c)+' '+esc(c.nom),(l.length?nb(n)+" morte"+(n>1?"s":""):'<small style="color:var(--gris)">pas saisi</small>'))});
  h+=ligneT("Total",nb(somme(L,function(m){return m.n})),true)+'</table></div>';
  if(P.mois){var js=joursP(P);h+='<div class="bloc"><table class="t">';js.slice().reverse().forEach(function(j){var n=somme(L.filter(function(m){return m.date===j}),function(m){return m.n});if(n)h+=ligneT(dateCourte(j),nb(n))});h+='</table></div>'}
  else L.forEach(function(m){h+='<p class="aide" style="margin:4px 0">'+(n0(m.n)?"✝ ":"✓ ")+esc(comp(m.comp).court)+' : '+(n0(m.n)?nb(m.n)+" mortes":"aucune morte")+' · saisi à '+heure(m.t)+' par '+esc(m.par||"")+'</p>'});
  return h;
}
function dAliment(){
  var P=periode(),R=D.reglages,f=dansP(P),h=enTete(P);
  h+='<div class="bloc"><table class="t">';
  R.comps.forEach(function(c){var s=somme(D.alimOut.filter(function(a){return a.comp===c.id&&f(a)}),function(a){return a.sacs});h+=ligneT(badgeC(c)+' '+esc(c.nom),nb(s)+" sacs")});
  h+=ligneT("Total donné",nb(somme(D.alimOut.filter(f),function(a){return a.sacs}))+" sacs",true)+'</table></div>';
  var ach=D.alimIn.filter(f);
  h+='<div class="bloc"><table class="t">'+ligneT("Sacs achetés",nb(somme(ach,function(a){return a.sacs})))+ligneT("Coût des achats",gnf(somme(ach,function(a){return a.montant})))+ligneT("Stock d'aliment",nb(stockAliment(P.fin))+" sacs",true)+'</table></div>';
  return h;
}
function dVaccins(){
  var P=periode(),f=dansP(P),L=D.vaccins.filter(f).sort(function(a,b){return (b.t||0)-(a.t||0)}),h=enTete(P);
  var ar=D.vaccins.filter(function(v){return v.rappel&&!v.fait}).sort(function(a,b){return a.rappel<b.rappel?-1:1});
  if(ar.length){h+='<h3>Rappels à venir</h3><div class="bloc"><table class="t">';ar.forEach(function(v){var j=Math.round((new Date(v.rappel+"T12:00:00")-new Date(auj()+"T12:00:00"))/864e5);h+=ligneT(esc(v.vaccin)+' · '+esc(comp(v.comp).court),j<0?'<span class="sans-recu">en retard</span>':j===0?"aujourd'hui":"dans "+j+" j")});h+='</table></div>'}
  h+='<h3>Vaccins donnés</h3>';
  if(!L.length)return h+'<div class="vide">Aucun vaccin sur cette période.</div>';
  h+='<div class="bloc"><ul class="hist">';L.forEach(function(v){h+='<li>'+icone("vaccin","sante")+'<span class="x"><b>'+esc(v.vaccin)+' · '+esc(comp(v.comp).court)+'</b><small>'+dateCourte(v.date)+' · '+esc(v.par||"")+(v.rappel?" · rappel le "+dateCourte(v.rappel)+(v.fait?" (fait)":""):"")+'</small></span></li>'});
  return h+'</ul></div>';
}
function dVentes(){
  var P=periode(),C=chiffresP(P),h=enTete(P);
  h+='<div class="bloc"><table class="t">'+ligneT("Alvéoles vendues",nb(C.alvVendues))+ligneT("Montant des ventes",gnf(C.montantVentes))+ligneT("Argent encaissé",gnf(C.enc),true)+'</table></div>';
  if(!C.ventes.length)return h+'<div class="vide">Aucune vente sur cette période.</div>';
  h+='<div class="bloc"><ul class="hist">';
  C.ventes.slice().sort(function(a,b){return (b.t||0)-(a.t||0)}).forEach(function(v){h+='<li>'+icone("ventes","arg")+'<span class="x"><b>'+nb(v.alv)+' alv. · '+esc(v.client)+'</b><small>'+dateCourte(v.date)+' '+heure(v.t)+' · '+gnf(venteTotal(v))+(venteReste(v)>0?' · <span class="sans-recu">reste '+gnf(venteReste(v))+'</span>':' · payé')+'</small></span></li>'});
  return h+'</ul></div>';
}
function listeDep(L){
  var h='<div class="bloc"><ul class="hist">';
  L.slice().sort(function(a,b){return (b.t||0)-(a.t||0)}).forEach(function(x){var s=srcRecu(x);h+='<li><span class="e">'+(s?'<img src="'+s+'" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px">':icone("depenses","arg"))+'</span><span class="x"><b>'+gnf(x.montant)+' · '+esc(x.cat)+'</b><small>'+dateCourte(x.date)+' · '+esc(x.par||"")+(x.note?" · "+esc(x.note):"")+(x.imprevu?" · imprévu":"")+(s?"":' · <span class="sans-recu">sans reçu</span>')+'</small></span>'+(s?'<button class="recu-btn" data-act="voirRecu" data-l="dep" data-id="'+x.id+'">Voir</button>':'')+'</li>'});
  return h+'</ul></div>';
}
function dDepenses(){
  var P=periode(),C=chiffresP(P),h=enTete(P,"Touchez « Voir » pour afficher le reçu.");
  var cat={};C.dep.forEach(function(x){cat[x.cat]=(cat[x.cat]||0)+n0(x.montant)});
  h+='<div class="bloc"><table class="t">';
  Object.keys(cat).sort(function(a,b){return cat[b]-cat[a]}).forEach(function(k){var e=(CATS.find(function(c){return c[0]===k})||["","note"])[1];h+=ligneT('<span class="cat-l">'+icone(e,"arg")+esc(k)+'</span>',gnf(cat[k]))});
  h+=ligneT("Total des dépenses",gnf(C.totDep),true)+'</table></div>';
  return h+(C.dep.length?listeDep(C.dep):'<div class="vide">Aucune dépense sur cette période.</div>');
}
function dSalaires(){
  var P=periode(),C=chiffresP(P),h=enTete(P,"Les salaires sont les dépenses de la catégorie Salaires, saisies par le commercial avec le nom de la personne payée.");
  var par={};C.sal.forEach(function(x){var n=(x.note||"Sans nom").trim();par[n]=(par[n]||0)+n0(x.montant)});
  h+='<div class="bloc"><table class="t">';Object.keys(par).forEach(function(n){h+=ligneT(esc(n),gnf(par[n]))});
  h+=ligneT("Total des salaires",gnf(C.totSal),true)+'</table></div>';
  return h+(C.sal.length?listeDep(C.sal):'<div class="vide">Aucun salaire versé sur cette période.</div>');
}
function dBenef(){
  var P=periode(),C=chiffresP(P),h=enTete(P),cat={};
  C.dep.forEach(function(x){cat[x.cat]=(cat[x.cat]||0)+n0(x.montant)});
  h+='<div class="bloc"><table class="t">'+ligneT("Argent encaissé",gnf(C.enc),true);
  Object.keys(cat).sort(function(a,b){return cat[b]-cat[a]}).forEach(function(k){h+=ligneT("− "+esc(k),gnf(cat[k]))});
  var b=C.enc-C.totDep;
  h+=ligneT("Bénéfice",'<span style="color:'+(b<0?"var(--alerte)":"var(--vert)")+'">'+gnf(b)+'</span>',true)+'</table></div>';
  return h+'<p class="aide">Les ventes à crédit comptent le jour où le client paie. Crédits en attente : '+gnf(creditsTotal())+'.</p>';
}
function dStock(){
  var P=periode(),C=chiffresP(P),h=enTete(P);
  h+='<div class="bloc"><table class="t">'+ligneT("Alvéoles ramassées",nb(C.alv))+ligneT("Alvéoles vendues",nb(C.alvVendues))+ligneT("En stock le "+dateCourte(P.fin),nb(stockAlv(P.fin))+" alvéoles",true)+'</table></div>';
  if(D.alimIn.length||D.alimOut.length){var f=dansP(P);
    h+='<h3>Aliment</h3><div class="bloc"><table class="t">'+ligneT("Sacs achetés",nb(somme(D.alimIn.filter(f),function(a){return a.sacs})))+ligneT("Sacs donnés aux poules",nb(somme(D.alimOut.filter(f),function(a){return a.sacs})))+ligneT("Sacs en stock",nb(stockAliment(P.fin)),true)+'</table></div>'}
  if(stockOeufs(P.fin)<0)h+='<div class="alerte"><b>Écart :</b> plus d\'alvéoles vendues que ramassées. À vérifier.</div>';
  return h;
}
function dCredits(){
  var cr=D.ventes.filter(function(v){return venteReste(v)>0}),h='<p class="aide">Clients qui doivent encore de l\'argent, toutes dates confondues.</p>';
  if(!cr.length)return h+'<div class="vide">Aucun crédit en cours.</div>';
  h+='<div class="bloc"><ul class="hist">';cr.forEach(function(v){h+='<li>'+icone("credits","arg")+'<span class="x"><b>'+esc(v.client)+' doit '+gnf(venteReste(v))+'</b><small>Vente du '+dateCourte(v.date)+' · '+nb(v.alv)+' alvéoles · '+esc(v.par||"")+'</small></span></li>'});
  return h+'</ul></div><div class="bloc"><table class="t">'+ligneT("Total des crédits",gnf(creditsTotal()),true)+'</table></div>';
}
function dAlertes(){var a=alertes(V.date);return a.length?a.map(function(x){return '<div class="alerte '+(x.k==="alerte"?"":"info")+'">'+x.t+'</div>'}).join(""):'<div class="alerte ok"><b>Aucune alerte.</b></div>'}

/* ---------- Ventes (commercial) ---------- */
function blocVentes(){
  var h='',d=auj();
  h+='<div class="bloc" style="margin-top:16px"><div class="gros-stock">'+icone("stock","prod")+'<div><div class="v">'+nb(stockAlv(d))+'</div><div class="aide" style="margin:0">alvéoles en stock</div></div></div></div>';
  var vs=D.ventes.filter(function(v){return v.date===d});
  h+='<div class="chiffres"><div class="chiffre"><div class="v">'+nb(somme(vs,function(v){return v.alv}))+'</div><div class="l">alvéoles vendues aujourd\'hui</div></div><div class="chiffre"><div class="v">'+nb(encaisseJour(d))+'</div><div class="l">GNF encaissés aujourd\'hui</div></div></div>';
  var cr=D.ventes.filter(function(v){return venteReste(v)>0});
  h+='<h2>Clients qui doivent de l\'argent</h2>';
  if(!cr.length)h+='<div class="vide">Aucun crédit en cours.</div>';
  else{h+='<div class="bloc"><ul class="hist">';cr.forEach(function(v){h+='<li>'+icone("ventes","arg")+'<span class="x"><b>'+esc(v.client)+'</b> doit '+gnf(venteReste(v))+'<small>Vente du '+dateCourte(v.date)+' · '+nb(v.alv)+' alvéoles</small></span><button class="btn vert petit" data-act="ouvrir" data-v="encaisser" data-id="'+v.id+'">Encaisser</button></li>'});h+='</ul></div>'}
  return h;
}
/* ---------- Liste des saisies ---------- */
function toutesSaisies(){
  var L=[];
  D.prod.forEach(function(x){L.push({l:"prod",x:x,e:["oeuf","prod"],t:nb(alvDe(x.oeufs,x.casses))+" alvéoles · "+(x.r?nomRam(x.r)+" · ":"")+comp(x.comp).court,s:(n0(x.casses)?nb(x.casses)+" œufs cassés":"")})});
  D.mouv.forEach(function(x){L.push({l:"mouv",x:x,e:x.type==="mort"?["mortes","sante"]:["poule","elev"],t:(x.type==="mort"&&!n0(x.n)?"Aucune poule morte":nb(x.n)+" · "+TYPES_MOUV[x.type])+" · "+comp(x.comp).court,s:esc(x.note||"")})});
  D.alimOut.forEach(function(x){L.push({l:"alimOut",x:x,e:["aliment","elev"],t:nb(x.sacs)+" sacs d'aliment · "+comp(x.comp).court,s:""})});
  D.alimIn.forEach(function(x){L.push({l:"alimIn",x:x,e:["aliment","arg"],t:nb(x.sacs)+" sacs d'aliment achetés",s:gnf(x.montant)})});
  D.malades.forEach(function(x){L.push({l:"malades",x:x,e:["malade","sante"],t:nb(x.n)+" malade"+(x.n>1?"s":"")+" · "+comp(x.comp).court,s:esc(x.signes)+(x.trait?" · "+esc(x.trait):"")})});
  D.vaccins.forEach(function(x){L.push({l:"vaccins",x:x,e:["vaccin","sante"],t:esc(x.vaccin)+" · "+comp(x.comp).court,s:x.rappel?"Rappel le "+dateCourte(x.rappel)+(x.fait?" (fait)":""):""})});
  D.dep.forEach(function(x){if(x.auto)return;L.push({l:"dep",x:x,e:["depenses","arg"],t:gnf(x.montant)+" · "+esc(x.cat),s:(x.imprevu?"Imprévu · ":"")+esc(x.note||"")+(srcRecu(x)?"":(x.note||x.imprevu?" · ":"")+'<span class="sans-recu">sans reçu</span>')})});
  D.ventes.forEach(function(x){L.push({l:"ventes",x:x,e:["ventes","arg"],t:nb(x.alv)+" alvéoles vendues à "+esc(x.client),s:gnf(venteTotal(x))+(venteReste(x)>0?" · crédit "+gnf(venteReste(x)):"")})});
  D.regl.forEach(function(x){var v=D.ventes.find(function(y){return y.id===x.vente});L.push({l:"regl",x:x,e:["credits","arg"],t:gnf(x.montant)+" reçus"+(v?" de "+esc(v.client):""),s:""})});
  D.vers.forEach(function(x){L.push({l:"vers",x:x,e:["benef","arg"],t:gnf(x.montant)+" versés au propriétaire",s:"cycle "+x.cycle})});
  D.comptages.forEach(function(x){L.push({l:"comptages",x:x,e:["poule","elev"],t:"Nombre de poules : "+nb(x.n)+" · "+comp(x.comp).court,s:x.calcule!=null&&x.avant?"avant : "+nb(x.calcule):""})});
  return L.sort(function(a,b){return (b.x.t||0)-(a.x.t||0)});
}
function peutAnnuler(it){var u=moi();if(!u)return false;if(u.role==="proprio")return true;return it.x.parId===u.id&&it.x.date===auj()}
function listeSaisies(L,annul,avecHeure){
  var h='<div class="bloc"><ul class="hist direct">';
  L.forEach(function(it){
    h+='<li>'+(avecHeure?'<span class="h">'+heure(it.x.t)+'<small>'+(it.x.date===auj()?"aujourd'hui":dateCourte(it.x.date))+'</small></span>':'')+icone(it.e[0],it.e[1])+'<span class="x"><b>'+it.t+'</b><small>'+(avecHeure?esc(it.x.par||""):dateHeure(it.x))+(it.s?" · "+it.s:"")+'</small></span>'+(srcRecu(it.x)?'<button class="recu-btn" data-act="voirRecu" data-l="'+it.l+'" data-id="'+it.x.id+'">Voir le reçu</button>':'')+(annul&&peutAnnuler(it)?'<button class="btn sec petit" data-act="annuler" data-l="'+it.l+'" data-id="'+it.x.id+'" data-d="'+it.x.date+'">Annuler</button>':'')+'</li>'});
  return h+'</ul></div>';
}

/* ---------- Réglages ---------- */
function vueReglages(){
  var R=D.reglages,s=V.sousReglages,h='<div class="page-tete"><button class="ico" data-act="page" data-v="accueil" aria-label="Retour">'+ICO.retour+'</button><h2>Réglages</h2></div><div class="seg">';
  [["equipe","Équipe"],["ferme","Ferme"],["saisies","Toutes les saisies"]].forEach(function(x){h+='<button data-act="sousG" data-v="'+x[0]+'" class="'+(s===x[0]?"on":"")+'">'+x[1]+'</button>'});
  h+='</div>';
  if(s==="equipe")h+=vueEquipe();
  if(s==="saisies")h+='<p class="aide">Vous pouvez annuler toute saisie erronée.</p>'+listeSaisies(toutesSaisies().slice(0,100),true,true);
  if(s==="ferme"){
    var num=function(n,l,v){return '<div class="champ"><label for="f_'+n+'">'+l+'</label><input id="f_'+n+'" name="'+n+'" type="number" inputmode="numeric" min="0" value="'+v+'" required></div>'};
    h+='<form class="bloc" data-f="ferme"><div class="champ"><label for="f_ferme">Nom de la ferme</label><input id="f_ferme" name="ferme" value="'+esc(R.ferme)+'" required></div><div class="champ"><label for="f_lieu">Lieu</label><input id="f_lieu" name="lieu" value="'+esc(R.lieu)+'"></div>';
    h+='<div class="champ"><label for="f_debutCycles">Premier jour des cycles de versement</label><input id="f_debutCycles" name="debutCycles" type="date" value="'+esc(R.debutCycles||"")+'"><span class="hint">Laissez vide pour partir du premier ramassage saisi.</span></div>'+num("joursCycle","Jours de ramassage par cycle de versement",R.joursCycle||15);
    h+=num("prix","Prix d'une alvéole (GNF)",R.prix)+num("oeufsAlv","Œufs par alvéole",R.oeufsAlv)+num("objectif","Objectif d'alvéoles par jour",R.objectif)+num("seuilPonte","Alerte si la ponte passe sous (%)",R.seuilPonte)+num("seuilMorts","Alerte à partir de combien de mortes par jour",R.seuilMorts)+num("seuilAliment","Alerte quand il reste combien de sacs",R.seuilAliment)+num("margeRam","Délai avant de signaler un retard (minutes)",R.margeRam);
    h+='<div class="champ"><span class="etiq">Heures des 4 ramassages</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+RAMS.map(function(r){return '<label style="font-size:15px">Ramassage '+r+'<input type="time" name="hr'+r+'" value="'+esc(heureRam(r))+'" required></label>'}).join("")+'</div></div>';
    R.comps.forEach(function(c){h+='<div class="champ"><label for="n_'+c.id+'">Nom de '+c.court+'</label><input id="n_'+c.id+'" name="nom_'+c.id+'" value="'+esc(c.nom)+'" required></div>'});
    h+='<button class="btn">Enregistrer</button></form>';
    if(MODE==="local")h+='<h3>Sauvegarde</h3><div class="bloc"><p class="aide" style="margin-top:0">Ce téléphone n\'est pas relié aux autres. Copiez la sauvegarde et envoyez-la par WhatsApp.</p><button class="btn sec" data-act="copierSauv">Copier la sauvegarde</button></div>';
  }
  return h;
}

/* ================== FEUILLES DE SAISIE ================== */
var TITRES={poules:"Nombre de poules",oeufs:"Alvéoles ramassées",morts:"Poules mortes",aliment:"Aliment donné",malade:"Poule malade",vaccin:"Vaccin",mouv:"Arrivée ou sortie de poules",achat:"Achat d'aliment",depense:"Dépense",vente:"Nouvelle vente",encaisser:"Encaisser un paiement",codeUser:"Code secret",tab:"",versement:"Versement au propriétaire",dVersement:"Versements au propriétaire",rapport:"Rapport du jour",bilan:"Bilan du mois",ventesP:"Ventes et crédits",depensesP:"Dépenses et reçus",dRam:"Ramassages",dProd:"Alvéoles et ponte",dPoules:"Poules",dMalades:"Poules malades",dMorts:"Poules mortes",dAliment:"Aliment",dVaccins:"Vaccins",dVentes:"Ventes",dDepenses:"Dépenses",dSalaires:"Salaires",dBenef:"Bénéfice",dStock:"Stock",dCredits:"Crédits clients",dAlertes:"Alertes",activite:"Toute l'activité",recu:"Reçu"};
function ouvrir(type,c,id,r){
  var F={type:type,date:auj(),comp:c||(type==="vaccin"?"TOUS":"B1"),changerDate:false},R=D.reglages;
  if(type==="poules"){F.n=Math.max(0,effectif(F.comp,auj()))}
  if(type==="oeufs"){F.r=n0(r)||premierRamLibre(F.comp);chargerOeufs(F)}
  if(type==="morts"){var m=recMort(F.comp,F.date);F.n=m?m.n:0}
  if(type==="aliment"){var a=recAlim(F.comp,F.date);F.sacs=a?a.sacs:0}
  if(type==="malade"){F.n=1;F.signes=[];F.trait=""}
  if(type==="vaccin"){F.vaccin="";F.autre="";F.rappel=0}
  if(type==="mouv"){F.mtype="arrivee";F.n=0;F.note=""}
  if(type==="achat"){F.sacs=0;F.montant=""}
  if(type==="depense"){F.cat="";F.montant="";F.note="";F.imprevu=false}
  if(type==="vente"){F.client="";F.alv=0;F.prix=R.prix;F.mode="tout";F.paye="";F.changerPrix=false}
  if(type==="versement"){var nv=cycles().filter(function(c){return calcCycle(c).reste>0});F.cycle=nv.length?nv[0].n:0;F.montant=nv.length?calcCycle(nv[0]).reste:""}
  if(type==="tab")F.menu=c;
  if(type==="codeUser"){F.uid=id;F.pin=(PROFIL&&id===PROFIL.id)?"":codeAuHasard()}
  if(type==="encaisser"){F.vente=id;var v=D.ventes.find(function(x){return x.id===id});F.montant=v?venteReste(v):0}
  V.F=F;rendreFeuille();
}
function premierRamLibre(c){for(var i=0;i<RAMS.length;i++)if(!ramSaisi(c,auj(),RAMS[i]))return RAMS[i];return 4}
function chargerOeufs(F){
  var ps=D.prod.filter(function(x){return x.comp===F.comp&&x.r===F.r&&x.date===F.date}),k=D.reglages.oeufsAlv;
  var p=ps.length?{oeufs:somme(ps,function(x){return x.oeufs}),casses:somme(ps,function(x){return x.casses})}:null;
  if(p){var bons=n0(p.oeufs)-n0(p.casses);F.alv=Math.floor(bons/k);F.plus=bons%k;F.casses=n0(p.casses);F.existe=true}
  else{F.alv=0;F.plus=0;F.casses=0;F.existe=false}
}
function fermer(){if(V.F&&V.F.retour){V.F=V.F.retour;rendreFeuille();return}V.F=null;rendre()}
function rendreFeuille(){
  var el=document.getElementById("feuille"),F=V.F;
  if(!F){el.innerHTML="";document.body.style.overflow="";return}
  document.body.style.overflow="hidden";
  if(F.type==="ok"){
    clearTimeout(V.tOk);if(!F.suite){V.tOk=setTimeout(function(){if(V.F===F)fermer()},2200)}
    var h='<div class="feuille"><div class="corps"><div class="succes"><div class="rond">✓</div><h2>Enregistré</h2><p class="aide" style="font-size:18px">'+F.msg+'</p><p class="date-ok">'+IC.calendrier+dateFr(auj())+' à '+heure(Date.now())+'</p></div></div><div class="pied"><div>';
    if(F.suite)h+='<button class="btn" data-act="ouvrir" data-v="'+F.suite.type+'" data-c="'+F.suite.comp+'"'+(F.suite.r?' data-r="'+F.suite.r+'"':'')+' style="margin-bottom:10px">'+F.suite.lib+'</button>';
    el.innerHTML=h+'<button class="btn '+(F.suite?"sec":"")+'" data-act="fermer">Terminé</button></div></div></div>';return;
  }
  var lecture=/^(rapport|bilan|ventesP|depensesP|activite|recu|tab|d[A-Z]\w*)$/.test(F.type);
  var corps=({dRam:dRam,dMalades:dMalades,dMorts:dMorts,dAliment:dAliment,dVaccins:dVaccins,dProd:dProd,dPoules:dPoules,dVentes:dVentes,dDepenses:dDepenses,dSalaires:dSalaires,dBenef:dBenef,dStock:dStock,dCredits:dCredits,dAlertes:dAlertes,depensesP:fDepensesP,activite:fActivite,recu:fRecu,poules:fPoules,oeufs:fOeufs,morts:fMorts,aliment:fAliment,malade:fMalade,vaccin:fVaccin,mouv:fMouv,achat:fAchat,depense:fDepense,vente:fVente,encaisser:fEncaisser,codeUser:fCodeUser,tab:fTab,versement:fVersement,dVersement:dVersement,rapport:fRapport,bilan:fBilan,ventesP:blocVentes})[F.type]();
  var avecDate=!lecture&&F.type!=="poules"&&F.type!=="codeUser";
  var pied=lecture?(F.type==="rapport"?'<div class="rangee"><a class="btn" href="https://wa.me/?text='+encodeURIComponent(rapportSoir(V.date))+'" target="_blank" rel="noopener">Envoyer par WhatsApp</a><button class="btn sec" data-act="copier">Copier</button></div>':'<button class="btn sec" data-act="fermer">Fermer</button>')
    :'<button class="btn" data-act="valider">'+(F.type==="vente"?"Enregistrer la vente":F.type==="encaisser"?"Encaisser":(F.existe||F.type==="poules"?"Enregistrer":"Enregistrer"))+'</button>';
  var dt=DET[F.type];if(F.type==="tab"){var mi=menuInfo(F.menu);dt=[mi[3],mi[2]];TITRES.tab=mi[1]}
  el.innerHTML='<div class="feuille'+(dt?" c-"+dt[0]:"")+'" role="dialog" aria-modal="true" aria-label="'+TITRES[F.type]+'"><div class="tete"><h2>'+(dt?IC[dt[1]]:"")+TITRES[F.type]+'</h2><button class="ico" data-act="fermer" aria-label="Fermer">'+ICO.fermer+'</button></div><div class="corps"><div>'+
    (avecDate?ligneDate():'')+corps+'</div></div><div class="pied"><div>'+pied+'</div></div></div>';
}

function dateHeure(x){var d=new Date((x.date||auj())+"T12:00:00");return d.toLocaleDateString("fr-FR",{weekday:"short"})+" "+dNum(x.date||auj())+(x.t?" à "+heure(x.t):"")}
function numBat(c){return (c.id.match(/\d+/)||[""])[0]}
function batiments(){return D.reglages.comps.map(function(c){return {n:numBat(c),comps:[c]}})}
function ligneBat(){return ''}
function choixComp(tous){
  var F=V.F,h='<div class="champ"><span class="etiq">Bâtiment</span><div class="chips">';
  if(tous)h+='<button type="button" class="chip '+(F.comp==="TOUS"?"on":"")+'" data-act="set" data-k="comp" data-v="TOUS">Tous</button>';
  D.reglages.comps.forEach(function(c){h+='<button type="button" class="chip gros '+(F.comp===c.id?"on":"")+'" data-act="set" data-k="comp" data-v="'+c.id+'">'+esc(c.nom)+'</button>'});
  return h+'</div></div>';
}
function compteur(k,lib,pas,gros,dec){
  var F=V.F,h='<div class="champ"><label for="cpt_'+k+'">'+lib+'</label><div class="compteur"><button type="button" data-act="pas" data-k="'+k+'" data-v="'+(-pas)+'" aria-label="Moins">−</button><input id="cpt_'+k+'" type="number" inputmode="'+(dec?"decimal":"numeric")+'" min="0" step="'+pas+'" data-k="'+k+'" value="'+F[k]+'"><button type="button" data-act="pas" data-k="'+k+'" data-v="'+pas+'" aria-label="Plus">+</button></div>';
  if(gros)h+='<div class="compteur-pas">'+gros.map(function(g){return '<button type="button" data-act="pas" data-k="'+k+'" data-v="'+g+'">'+(g>0?"+":"−")+Math.abs(g)+'</button>'}).join("")+'</div>';
  return h+'</div>';
}
function champMontant(k,lib,hint){
  var F=V.F;
  return '<div class="champ"><label for="m_'+k+'">'+lib+'</label><input id="m_'+k+'" type="number" inputmode="numeric" min="0" data-k="'+k+'" value="'+F[k]+'" placeholder="0"><span class="hint" id="lu_'+k+'">'+(F[k]!==""?"= "+gnf(F[k]):(hint||"En francs guinéens"))+'</span></div>';
}
function fPoules(){
  var F=V.F,act=effectif(F.comp,auj());
  var k=comptagesDe(F.comp)[0];
  return choixComp()+'<div class="resume">'+(k?'Nombre enregistré : <b>'+nb(k.n)+' poules</b><br><span style="font-size:14px">le '+dateHeure(k)+'</span>':'Aucun nombre enregistré pour ce bâtiment.')+'</div>'+compteur("n","Nouveau nombre exact de poules",1,[-100,-10,10,100])+'<p class="aide">Ce nombre restera affiché jusqu\'au prochain changement.</p>';
}
function fOeufs(){
  var F=V.F,h=choixComp()+'<div class="champ"><span class="etiq">Ramassage</span><div class="chips">';
  RAMS.forEach(function(r){var f=ramSaisi(F.comp,F.date,r);h+='<button type="button" class="chip '+(F.r===r?"on":"")+'" data-act="setRam" data-v="'+r+'">'+r+(heureRam(r)?" · "+heureRamFr(r):"")+(f?" ✓":"")+'</button>'});
  h+='</div></div>';
  if(F.existe)h+='<div class="bandeau" style="margin:0 0 14px">Ce ramassage est déjà saisi. Vous pouvez le corriger.</div>';
  return h+compteur("alv","Alvéoles pleines",1,[-10,10])+compteur("plus","Œufs en plus (alvéole pas pleine)",1)+compteur("casses","Œufs cassés",1)+'<div class="resume" id="resume">'+resumeOeufs()+'</div>';
}
function resumeOeufs(){var F=V.F,R=D.reglages,tot=n0(F.alv)*R.oeufsAlv+n0(F.plus)+n0(F.casses);
  var autres=somme(D.prod.filter(function(p){return p.date===F.date&&p.comp===F.comp&&p.r!==F.r}),function(p){return p.oeufs});
  var e=effectif(F.comp,F.date);
  var cassAutres=somme(D.prod.filter(function(p){return p.date===F.date&&p.comp===F.comp&&p.r!==F.r}),function(p){return p.casses});
  return 'Ce ramassage : <b>'+nb(n0(F.alv))+' alvéoles</b>'+(n0(F.plus)?' et '+nb(F.plus)+' œufs':'')+'<br>Total du jour pour '+comp(F.comp).court+' : <b>'+nb(alvDe(tot+autres,n0(F.casses)+cassAutres))+' alvéoles</b>'+(e>0?' (ponte '+pct((tot+autres)/e)+')':'')+
    (e>0?'<div class="calc-ponte"><b>'+nb(n0(F.alv))+' alvéoles × '+R.oeufsAlv+' œufs'+(n0(F.plus)?' + '+nb(F.plus):'')+(n0(F.casses)?' + '+nb(F.casses)+' cassés':'')+' = '+nb(tot)+' œufs</b><br>Depuis ce matin : '+nb(tot+autres)+' œufs sur '+nb(e)+' poules<br><span class="ont">'+nb(Math.min(e,tot+autres))+' poules ont pondu</span> · <span class="pas">'+nb(Math.max(0,e-tot-autres))+' n\'ont pas encore pondu</span>'+(tot+autres>e?'<br><span class="rouge">Attention : plus d\'œufs que de poules. Vérifiez le nombre de poules du bâtiment.</span>':'')+'</div>':'<div class="calc-ponte">Enregistrez d\'abord le nombre de poules du bâtiment pour savoir combien ont pondu.</div>')}
function fMorts(){var F=V.F;return choixComp()+compteur("n","Nombre de poules mortes aujourd'hui",1)+'<button class="btn sec" data-act="aucuneMorte">Aucune poule morte</button>'}
function fAliment(){return choixComp()+compteur("sacs","Sacs d'aliment donnés aujourd'hui",0.5,null,true)+'<p class="aide">Stock : '+nb(stockAliment(auj()))+' sacs.</p>'}
function fMalade(){
  var F=V.F,h=choixComp()+compteur("n","Nombre de poules malades",1)+'<div class="champ"><span class="etiq">Ce que vous voyez</span><div class="chips">';
  SIGNES.forEach(function(s){h+='<button type="button" class="chip '+(F.signes.indexOf(s)>=0?"on":"")+'" data-act="multi" data-k="signes" data-v="'+s+'">'+s+'</button>'});
  return h+'</div></div><div class="champ"><label for="tr">Traitement donné</label><input id="tr" data-k="trait" value="'+esc(F.trait)+'" placeholder="Facultatif"></div>';
}
function fVaccin(){
  var F=V.F,h=choixComp(true)+'<div class="champ"><span class="etiq">Vaccin ou produit</span><div class="chips">';
  VACCINS.concat(["Autre"]).forEach(function(s){h+='<button type="button" class="chip '+(F.vaccin===s?"on":"")+'" data-act="set" data-k="vaccin" data-v="'+s+'">'+s+'</button>'});
  h+='</div></div>';
  if(F.vaccin==="Autre")h+='<div class="champ"><label for="va">Nom du produit</label><input id="va" data-k="autre" value="'+esc(F.autre)+'"></div>';
  h+='<div class="champ"><span class="etiq">Prochain rappel</span><div class="chips">';
  [[0,"Pas de rappel"],[7,"Dans 7 jours"],[14,"Dans 14 jours"],[21,"Dans 21 jours"],[30,"Dans 1 mois"]].forEach(function(r){h+='<button type="button" class="chip '+(F.rappel===r[0]?"on":"")+'" data-act="setN" data-k="rappel" data-v="'+r[0]+'">'+r[1]+'</button>'});
  return h+'</div></div>';
}
function fMouv(){
  var F=V.F,h='<div class="champ"><span class="etiq">Que s\'est-il passé ?</span><div class="chips">';
  [["arrivee","Arrivée de poules"],["vente","Poules vendues"],["reforme","Poules réformées"]].forEach(function(t){h+='<button type="button" class="chip '+(F.mtype===t[0]?"on":"")+'" data-act="set" data-k="mtype" data-v="'+t[0]+'">'+t[1]+'</button>'});
  return h+'</div></div>'+choixComp()+compteur("n","Nombre de poules",1,[-10,10])+'<div class="champ"><label for="mn">Remarque</label><input id="mn" data-k="note" value="'+esc(F.note)+'" placeholder="Facultatif"></div>';
}
function blocPhoto(){
  var F=V.F;
  if(F.photo)return '<div class="photo-recu"><img src="'+F.photo.data+'" alt="Photo du reçu"><div class="rangee"><label class="btn sec petit" style="flex-direction:row">Reprendre<input type="file" accept="image/*" capture="environment" data-act="photo"></label><button type="button" class="btn sec petit" data-act="sansPhoto">Retirer</button></div></div>';
  return '<div class="photo-recu"><label><span class="ic-photo">'+IC.photo+'</span>Prendre le reçu en photo<small class="aide" style="margin:0;font-weight:400">Le propriétaire verra la photo</small><input type="file" accept="image/*" capture="environment" data-act="photo"></label></div>';
}
function compresser(file){
  return new Promise(function(ok,ko){
    var img=new Image(),url=URL.createObjectURL(file);
    img.onload=function(){
      var dessiner=function(max){var s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext("2d").drawImage(img,0,0,c.width,c.height);return c};
      var grand=dessiner(1400),petit=dessiner(520);URL.revokeObjectURL(url);
      grand.toBlob(function(b){if(!b)return ko();ok({blob:b,data:petit.toDataURL("image/jpeg",0.55)})},"image/jpeg",0.72);
    };
    img.onerror=function(){URL.revokeObjectURL(url);ko()};img.src=url;
  });
}

function fAchat(){return compteur("sacs","Sacs achetés",1,[-10,10],true)+champMontant("montant","Prix total payé")+blocPhoto()+'<p class="aide">L\'achat s\'ajoute aussi aux dépenses.</p>'}
function fDepense(){
  var F=V.F,h='<div class="champ"><span class="etiq">Pour quoi ?</span><div class="cats">';
  CATS.forEach(function(c){h+='<button type="button" class="'+(F.cat===c[0]?"on":"")+'" data-act="set" data-k="cat" data-v="'+c[0]+'">'+icone(c[1],"arg")+c[0]+'</button>'});
  h+='</div></div>'+champMontant("montant","Montant")+blocPhoto()+(F.cat==="Salaires"?'<div class="champ"><label for="dn">Nom de la personne payée</label><input id="dn" data-k="note" value="'+esc(F.note)+'" placeholder="Ex. : Moussa Traoré"></div>':'<div class="champ"><label for="dn">Détail</label><input id="dn" data-k="note" value="'+esc(F.note)+'" placeholder="Ex. : 2 flacons de vitamines"></div>');
  return h+'<button type="button" class="bascule '+(F.imprevu?"on":"")+'" data-act="bascule" data-k="imprevu"><span class="boite">'+(F.imprevu?"✓":"")+'</span>C\'est un imprévu (panne, perte, vol…)</button>';
}
function fVente(){
  var F=V.F,cl={},h='';
  D.ventes.slice().sort(function(a,b){return (b.t||0)-(a.t||0)}).forEach(function(v){cl[v.client]=1});
  var noms=Object.keys(cl).slice(0,8);
  h+='<div class="champ"><label for="vc">Client</label><input id="vc" data-k="client" value="'+esc(F.client)+'" placeholder="Nom du client" autocomplete="off">';
  if(noms.length)h+='<div class="chips" style="margin-top:6px">'+noms.map(function(n){return '<button type="button" class="chip '+(F.client===n?"on":"")+'" data-act="set" data-k="client" data-v="'+esc(n)+'">'+esc(n)+'</button>'}).join("")+'</div>';
  h+='</div>'+compteur("alv","Nombre d'alvéoles",1,[-10,10])+'<div class="chips rapides">'+[1,5,10,20,30].map(function(n){return '<button type="button" class="chip" data-act="rapide" data-k="alv" data-v="'+n+'">'+n+'</button>'}).join("")+'</div>';
  h+='<p class="aide" style="margin-top:-8px">En stock : '+nb(stockAlv(F.date))+' alvéoles. Prix : '+gnf(F.prix)+' l\'alvéole. <button class="lien" data-act="changerPrix">Changer le prix</button></p>';
  if(F.changerPrix)h+=champMontant("prix","Prix d'une alvéole");
  h+='<div class="resume" id="resume">'+resumeVente()+'</div><div class="champ"><span class="etiq">Le client a payé</span><div class="chips">';
  [["tout","Tout"],["partie","Une partie"],["rien","Rien (crédit)"]].forEach(function(m){h+='<button type="button" class="chip '+(F.mode===m[0]?"on":"")+'" data-act="set" data-k="mode" data-v="'+m[0]+'">'+m[1]+'</button>'});
  h+='</div></div>';
  if(F.mode==="partie")h+=champMontant("paye","Montant reçu","Le reste sera noté comme crédit");
  return h;
}
function resumeVente(){var F=V.F;return 'Total à payer : <b>'+gnf(n0(F.alv)*n0(F.prix))+'</b>'}
function fEncaisser(){
  var F=V.F,v=D.ventes.find(function(x){return x.id===F.vente});if(!v)return '<p>Vente introuvable.</p>';
  return '<div class="resume"><b>'+esc(v.client)+'</b> doit encore <b>'+gnf(venteReste(v))+'</b><br><span style="font-size:15px">Vente du '+dateCourte(v.date)+' · '+nb(v.alv)+' alvéoles</span></div>'+champMontant("montant","Montant reçu aujourd'hui");
}
function fRapport(){
  return '<div class="champ"><label for="jourR">Journée</label><input id="jourR" type="date" data-act="dateRap" value="'+V.date+'" max="'+auj()+'"></div><div class="bloc"><pre style="white-space:pre-wrap;margin:0;font-family:inherit;font-size:16px">'+esc(rapportSoir(V.date))+'</pre></div>';
}
function fBilan(){
  var b=bilanMois(V.mois),h='<div class="champ"><label for="moisR">Mois</label><input id="moisR" type="month" data-act="moisRap" value="'+V.mois+'" max="'+auj().slice(0,7)+'"></div>';
  var mx=Math.max.apply(null,b.parJour.concat([1])),W=320,H=110,bw=W/b.jours.length;
  h+='<div class="bloc"><b>Œufs ramassés chaque jour</b><svg class="svgbar" viewBox="0 0 '+W+' '+(H+16)+'" width="100%" role="img" aria-label="Œufs ramassés chaque jour" style="margin-top:8px">';
  b.parJour.forEach(function(v,i){var hh=v/mx*H;h+='<rect x="'+(i*bw+1)+'" y="'+(H-hh)+'" width="'+Math.max(1,bw-2)+'" height="'+hh+'" rx="1.5"></rect>';if(i%5===0)h+='<text x="'+(i*bw+bw/2)+'" y="'+(H+12)+'" text-anchor="middle">'+(i+1)+'</text>'});
  h+='</svg></div><div class="bloc"><table class="t">';
  var lig=function(a,v,fort){return '<tr><td>'+(fort?'<b>'+a+'</b>':a)+'</td><td class="n">'+(fort?'<b>'+v+'</b>':v)+'</td></tr>'};
  h+=lig("Œufs ramassés",nb(b.oeufs))+lig("Œufs cassés",nb(b.casses))+lig("Alvéoles produites",nb(b.alv))+lig("Taux de ponte moyen",pct(b.taux))+lig("Poules mortes",nb(b.morts));
  h+=lig("Alvéoles vendues",nb(b.alvVendues))+lig("Montant des ventes",gnf(b.ventes))+lig("Argent encaissé",gnf(b.enc));
  for(var c in b.parCat)h+=lig("Dépense : "+esc(c),gnf(b.parCat[c]));
  h+=lig("Total des dépenses",gnf(b.dep))+lig("dont imprévus",gnf(b.imprevus))+lig("Bénéfice",gnf(b.benef),true);
  return h+'</table></div><p class="aide">Bénéfice = argent encaissé moins dépenses. Les ventes à crédit comptent quand le client paie.</p>';
}

function fCodeUser(){var u=D.users.find(function(x){return x.id===V.F.uid});if(!u)return '';var soi=PROFIL&&u.id===PROFIL.id;
  return '<div class="resume">Nouveau code pour <b>'+esc(u.nom)+'</b></div><div class="champ"><label for="cU">Code secret (6 chiffres)</label><input id="cU" data-k="pin" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" autocomplete="off" value="'+esc(V.F.pin)+'" style="font-size:32px;letter-spacing:10px;text-align:center"></div><p class="aide">'+(soi?"Ne donnez ce code à personne.":"Notez ce code et donnez-le à "+esc(u.nom)+" en main propre. L\'ancien code ne marchera plus.")+'</p>'}
function fActivite(){var L=toutesSaisies();return L.length?listeSaisies(L.slice(0,150),false,true):'<div class="vide">Aucune saisie.</div>'}
function fRecu(){var x=D[V.F.l].find(function(y){return y.id===V.F.id});if(!x)return '<p>Reçu introuvable.</p>';
  return '<div class="resume"><b>'+(x.cat?esc(x.cat):"Achat d\'aliment")+'</b> · '+gnf(x.montant)+'<br><span style="font-size:15px">'+dateFr(x.date)+' · '+esc(x.par||"")+'</span></div><img class="recu-grand" src="'+srcRecu(x)+'" alt="Photo du reçu">'}
function fDepensesP(){
  var m=V.date.slice(0,7),L=D.dep.filter(function(x){return x.date.slice(0,7)===m}).sort(function(a,b){return (b.t||0)-(a.t||0)});
  var tot=somme(L,function(x){return x.montant}),sr=L.filter(function(x){return !srcRecu(x)});
  var h='<div class="chiffres" style="margin-top:0"><div class="chiffre"><div class="v">'+nb(tot)+'</div><div class="l">GNF dépensés en '+new Date(m+"-15T12:00:00").toLocaleDateString("fr-FR",{month:"long"})+'</div></div><div class="chiffre"><div class="v" style="'+(sr.length?"color:var(--alerte)":"")+'">'+sr.length+'</div><div class="l">dépenses sans reçu</div></div></div>';
  if(!L.length)return h+'<div class="vide">Aucune dépense ce mois-ci.</div>';
  h+='<div class="bloc"><ul class="hist">';
  L.forEach(function(x){var s=srcRecu(x);h+='<li><span class="e">'+(s?'<img src="'+s+'" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px">':icone("depenses","arg"))+'</span><span class="x"><b>'+gnf(x.montant)+' · '+esc(x.cat)+'</b><small>'+dateCourte(x.date)+' · '+esc(x.par||"")+(x.note?" · "+esc(x.note):"")+(x.imprevu?" · imprévu":"")+(s?"":' · <span class="sans-recu">sans reçu</span>')+'</small></span>'+(s?'<button class="recu-btn" data-act="voirRecu" data-l="dep" data-id="'+x.id+'">Voir</button>':'')+'</li>'});
  return h+'</ul></div>';
}
function valider(){
  var F=V.F,R=D.reglages,suite=null,msg="",ok=true;
  if(!(estDG()&&F.changerDate&&F.date&&F.date<=auj()))F.date=auj();
  var cs=R.comps,iC=cs.findIndex(function(c){return c.id===F.comp});
  var prochain=function(test){for(var k=1;k<cs.length;k++){var c=cs[(iC+k)%cs.length];if(!test(c.id))return c.id}return null};
  if(F.type==="poules"){if(F.n===""||n0(F.n)<0)return toast("Indiquez le nombre de poules");
    var av=D.comptages.some(function(z){return z.comp===F.comp});ok=ecrire(auj(),"comptages",uid(),{date:auj(),comp:F.comp,n:n0(F.n),calcule:effectif(F.comp,auj()),avant:av});
    msg=comp(F.comp).court+" : "+nb(F.n)+" poules.";var nx=prochain(function(c){return D.comptages.some(function(z){return z.comp===c})});if(nx)suite={type:"poules",comp:nx,lib:"Continuer avec "+comp(nx).court}}
  else if(F.type==="oeufs"){var tot=n0(F.alv)*R.oeufsAlv+n0(F.plus)+n0(F.casses);if(tot<=0)return toast("Indiquez les œufs ramassés");
    var exP=D.prod.find(function(x){return x.date===F.date&&x.comp===F.comp&&x.r===F.r});
    ok=ecrire(F.date,"prod",exP?exP.id:uid(),{date:F.date,comp:F.comp,r:F.r,alv:n0(F.alv),plus:n0(F.plus),casses:n0(F.casses)});
    msg=nomRam(F.r)+" de "+comp(F.comp).court+" : "+nb(F.alv)+" alvéoles"+(n0(F.plus)?" et "+nb(F.plus)+" œufs":"")+".";
    var nx2=prochain(function(c){return ramSaisi(c,F.date,F.r)});
    if(nx2)suite={type:"oeufs",comp:nx2,r:F.r,lib:"Continuer avec "+comp(nx2).court};
    else msg+="<br>Le ramassage "+F.r+" est fait dans les "+cs.length+" bâtiments.<br>Ramassages faits aujourd'hui : "+ramFaits(F.date)+" sur "+(cs.length*4)+".";}
  else if(F.type==="morts"){if(n0(F.n)<=0)return toast("Indiquez un nombre, ou touchez « Aucune poule morte »");
    var exM=D.mouv.find(function(x){return x.type==="mort"&&x.comp===F.comp&&x.date===F.date});
    ok=ecrire(F.date,"mouv",exM?exM.id:uid(),{date:F.date,comp:F.comp,type:"mort",n:n0(F.n),note:""});msg=nb(F.n)+" poule"+(F.n>1?"s":"")+" morte"+(F.n>1?"s":"")+" dans "+comp(F.comp).court+".";
    var nx3=prochain(function(c){return mortsSaisis(c,F.date)});if(nx3)suite={type:"morts",comp:nx3,lib:"Continuer avec "+comp(nx3).court}}
  else if(F.type==="aliment"){if(n0(F.sacs)<=0)return toast("Indiquez le nombre de sacs");
    var exA=D.alimOut.find(function(x){return x.comp===F.comp&&x.date===F.date});
    ok=ecrire(F.date,"alimOut",exA?exA.id:uid(),{date:F.date,comp:F.comp,sacs:n0(F.sacs)});msg=nb(F.sacs)+" sacs pour "+comp(F.comp).court+".";
    var nx4=prochain(function(c){return alimSaisi(c,F.date)});if(nx4)suite={type:"aliment",comp:nx4,lib:"Continuer avec "+comp(nx4).court}}
  else if(F.type==="malade"){if(n0(F.n)<=0)return toast("Indiquez le nombre de poules malades");if(!F.signes.length)return toast("Choisissez ce que vous voyez");
    ok=ecrire(F.date,"malades",uid(),{date:F.date,comp:F.comp,n:n0(F.n),signes:F.signes.join(", "),trait:F.trait});msg="Le propriétaire est prévenu.";}
  else if(F.type==="vaccin"){var nom=F.vaccin==="Autre"?F.autre.trim():F.vaccin;if(!nom)return toast("Choisissez le vaccin");
    ok=ecrire(F.date,"vaccins",uid(),{date:F.date,comp:F.comp,vaccin:nom,rappel:F.rappel?decal(F.date,F.rappel):"",fait:false});msg=nom+(F.rappel?". Rappel le "+dateCourte(decal(F.date,F.rappel))+".":".");}
  else if(F.type==="mouv"){if(n0(F.n)<=0)return toast("Indiquez le nombre de poules");
    ok=ecrire(F.date,"mouv",uid(),{date:F.date,comp:F.comp,type:F.mtype,n:n0(F.n),note:F.note});msg=TYPES_MOUV[F.mtype]+" : "+nb(F.n)+" dans "+comp(F.comp).court+".";}
  else if(F.type==="achat"){if(n0(F.sacs)<=0)return toast("Indiquez le nombre de sacs");
    if(F.photo&&!F.recu)return envoyerPhoto(F,valider);var aid=uid(),rc=champsRecu(F);
    ok=ecrire(F.date,"alimIn",aid,Object.assign({date:F.date,sacs:n0(F.sacs),montant:n0(F.montant)},rc));if(ok&&n0(F.montant)>0)ecrire(F.date,"dep",uid(),Object.assign({date:F.date,cat:"Aliment",montant:n0(F.montant),note:nb(F.sacs)+" sacs achetés",imprevu:false,auto:aid},rc));msg=nb(F.sacs)+" sacs ajoutés au stock."+(F.recu?"<br>Reçu joint ✓":"");}
  else if(F.type==="depense"){if(!F.cat)return toast("Choisissez pour quoi");if(n0(F.montant)<=0)return toast("Indiquez le montant");if(F.cat==="Salaires"&&!String(F.note).trim())return toast("Indiquez le nom de la personne payée");
    if(F.photo&&!F.recu)return envoyerPhoto(F,valider);
    ok=ecrire(F.date,"dep",uid(),Object.assign({date:F.date,cat:F.cat,montant:n0(F.montant),note:F.note,imprevu:F.imprevu},champsRecu(F)));msg=gnf(F.montant)+" · "+F.cat+"."+(F.recu?"<br>Reçu joint ✓":"<br>Sans photo du reçu.");}
  else if(F.type==="vente"){var alv=n0(F.alv),tot2=alv*n0(F.prix);if(!F.client.trim())return toast("Indiquez le nom du client");if(alv<=0)return toast("Indiquez le nombre d'alvéoles");
    var paye=F.mode==="tout"?tot2:F.mode==="rien"?0:n0(F.paye);if(F.mode==="partie"&&(paye<=0||paye>=tot2))return toast("Le montant reçu doit être entre 0 et "+gnf(tot2));
    if(alv>stockAlv(F.date)&&!confirm("Le stock enregistré n'est que de "+nb(stockAlv(F.date))+" alvéoles. Enregistrer quand même ? Le propriétaire verra un écart."))return;
    ok=ecrire(F.date,"ventes",uid(),{date:F.date,client:F.client.trim(),alv:alv,prix:n0(F.prix),paye:paye});msg=nb(alv)+" alvéoles à "+esc(F.client.trim())+"."+(paye<tot2?"<br>Crédit : "+gnf(tot2-paye):"");
    suite={type:"vente",comp:"",lib:"Nouvelle vente"}}
  else if(F.type==="codeUser"){if(!estDG())return toast("Seul le DG peut changer les codes");var uc=D.users.find(function(x){return x.id===F.uid}),pc=String(F.pin||"").replace(/\s/g,"");
    if(!/^\d{6}$/.test(pc))return toast("Le code doit avoir 6 chiffres");if(codeFaible(pc))return toast("Ce code est trop facile à deviner");
    var soi=PROFIL&&uc.id===PROFIL.id;
    actionEquipe("changer_code",{id:uc.id,code:pc},"",function(){V.F={type:"ok",msg:soi?"Votre code est changé. Ne le donnez à personne.":"Nouveau code de "+esc(uc.nom)+" : <b style=\"font-size:26px;letter-spacing:3px\">"+codeLisible(pc)+"</b><br>Donnez-le-lui en main propre."};rendre()});return}
  else if(F.type==="versement"){var cv=cycles().find(function(c){return c.n===F.cycle}),mv=n0(F.montant);if(!cv)return toast("Choisissez le cycle");if(mv<=0)return toast("Indiquez le montant versé");
    if(F.photo&&!F.recu)return envoyerPhoto(F,valider);
    ok=ecrire(auj(),"vers",uid(),Object.assign({date:auj(),cycle:cv.n,montant:mv},champsRecu(F)));msg=gnf(mv)+" versés pour le cycle "+cv.n+".";}
  else if(F.type==="encaisser"){var v=D.ventes.find(function(x){return x.id===F.vente}),m=n0(F.montant);if(m<=0)return toast("Indiquez le montant reçu");if(m>venteReste(v))return toast("C'est plus que ce que le client doit");
    ok=ecrire(auj(),"regl",uid(),{date:auj(),vente:v.id,montant:m});msg=gnf(m)+" reçus de "+esc(v.client)+".";}
  if(!ok)return;
  vibrer();V.F={type:"ok",msg:msg,suite:suite};rendre();
}

/* ================== ÉVÉNEMENTS ================== */
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-act]");if(!b)return;var a=b.getAttribute("data-act"),v=b.getAttribute("data-v"),k=b.getAttribute("data-k");
  if(a==="page"){V.page=v;rendre();window.scrollTo(0,0)}
  else if(a==="vueP"){V.vueProprio=v;V.date=auj();rendre();window.scrollTo(0,0)}
  else if(a==="sousG"){V.sousReglages=v;rendre()}
  else if(a==="toutDirect"){V.toutDirect=true;rendreApp()}
  else if(a==="ecouter"){ecouter(v)}
  else if(a==="resumeLong"){V.resumeLong=!V.resumeLong;rendreApp()}
  else if(a==="menuOuvrir"){basculerMenu(v)}
  else if(a==="temps"){V.bordListe=v==="avant";if(v==="auj")V.bordJour=auj();if(v==="hier")V.bordJour=decal(auj(),-1);V.jPer="jour";rendreApp();window.scrollTo(0,0)}
  else if(a==="bordJour"){var nb2=decal(jourChoisi(),n0(v));if(nb2<=auj()){V.bordJour=nb2;V.jPer="jour";if(!majContenuOuvert())rendreApp()}}
  else if(a==="choisirJour"){V.bordJour=v;V.bordListe=false;V.jPer="jour";V.ouvertP="jour";rendreApp();var pn=document.getElementById("panneau-menu");if(pn&&pn.firstChild)placer(pn.firstChild)}
  else if(a==="plusJours"){V.nbJours=(V.nbJours||14)+14;if(!majContenuOuvert())rendreApp()}
  else if(a==="depPer"){V.depPer=v;if(!majContenuOuvert())rendreApp()}
  else if(a==="jPer"){V.jPer=v;V.jTout=false;if(!majContenuOuvert())rendreApp()}
  else if(a==="jJour"){var nj2=decal(V.jJour||auj(),n0(v));if(nj2<=auj()){V.jJour=nj2;V.bordJour=nj2;V.jTout=false;rendreApp()}}
  else if(a==="jFiltre"){V.jFiltre=v;V.jTout=false;if(!majContenuOuvert())rendreApp()}
  else if(a==="jTout"){V.jTout=true;if(!majContenuOuvert())rendreApp()}
  else if(a==="jourAlv"){var nj=decal(V.jourAlv||auj(),n0(v));if(nj<=auj()){V.jourAlv=nj;if(!majContenuOuvert())rendreApp()}}
  else if(a==="jourOuvrir"){V.jourOuvert=V.jourOuvert===v?null:v;if(!majContenuOuvert())rendreApp();if(V.F)rendreFeuille()}
  else if(a==="cycleOuvrir"){V.cycleOuvert=V.cycleOuvert===n0(v)?null:n0(v);if(!majContenuOuvert())rendreApp();if(V.F)rendreFeuille()}
  else if(a==="menuP"){V.menuP=v;if(voixEnCours){speechSynthesis.cancel();voixEnCours=false}rendreApp()}
  else if(a==="details"){V.details=!V.details;rendreApp()}
  else if(a==="ongletTech"){V.ongletTech=v;rendreApp();window.scrollTo(0,0)}
  else if(a==="resetComp"){var cc=comp(v);if(!confirm("Réinitialiser le nombre de poules de "+cc.court+" ? Le nombre enregistré et ses anciens nombres seront effacés."))return;
    comptagesDe(v).forEach(function(k){if(k.src)k.src.forEach(function(x){ecrire(x.date,"comptages",x.id,null)});else ecrire(k.date,"comptages",k.id,null)});toast("Nombre de "+cc.court+" réinitialisé");if(!majContenuOuvert())rendreApp();else rendreApp()}
  else if(a==="guideVu"){var uu=moi();if(uu)ecrireLS("fermeKonate.guide."+uu.id,true);rendreApp()}
  else if(a==="mesSaisies"){V.mesOuvert=!V.mesOuvert;rendreApp()}
  else if(a==="rapide"){V.F[k]=n0(v);var ip=document.getElementById("cpt_"+k);if(ip)ip.value=V.F[k];majResume()}
  else if(a==="toutesAlertes"){V.toutesAlertes=true;rendreApp()}
  else if(a==="jour"){var nd;if(V.periode==="mois"){var x=new Date(V.date.slice(0,7)+"-15T12:00:00");x.setMonth(x.getMonth()+n0(v));nd=iso(x).slice(0,7)+"-01";if(nd>auj())return;var fm=finMois(nd.slice(0,7));nd=fm>auj()?auj():fm}else nd=decal(V.date,n0(v));if(nd<=auj()){V.date=nd;rendreApp();if(V.F)rendreFeuille()}}
  else if(a==="periode"){if(voixEnCours){speechSynthesis.cancel();voixEnCours=false}V.periode=v;if(v==="jour")V.date=V.date>auj()?auj():V.date;rendreApp()}
  else if(a==="voirRecu"){V.F={type:"recu",l:b.getAttribute("data-l"),id:b.getAttribute("data-id"),retour:V.F};rendreFeuille()}
  else if(a==="sansPhoto"){V.F.photo=null;V.F.recu=null;rendreFeuille()}
  else if(a==="choixUser"){V.choixUser=v;V.pin="";rendre()}
  else if(a==="pin"){if(V.attente)return;if(V.pin.length<6)V.pin+=v;V.erreurPin="";
    if(V.pin.length===6){V.attente=true;rendre();var qui=V.choixUser;
      entrer(qui,V.pin).then(function(){V.attente=false;V.pin="";V.choixUser=null;V.msgConnexion="";V.page="accueil";V.vueProprio="ferme";V.date=auj();vibrer();rendre();window.scrollTo(0,0)},
        function(e){V.attente=false;V.pin="";var i=e&&e.info||{},m=e&&e.message||"Code incorrect.";
          if(i.restant!=null)m+=" Encore "+i.restant+" essai"+(i.restant>1?"s":"")+".";if(i.secondes)m+=" Attendez "+Math.ceil(i.secondes/60)+" min.";
          if(i.bloque){V.choixUser=null;V.msgConnexion=m;chargerEquipe()}else V.erreurPin=m;try{if(navigator.vibrate)navigator.vibrate([80,60,80])}catch(x){}rendre()});return}
    rendre()}
  else if(a==="pinEff"){V.pin=V.pin.slice(0,-1);V.erreurPin="";rendre()}
  else if(a==="pinRetour"){V.choixUser=null;V.pin="";V.erreurPin="";rendre()}
  else if(a==="nc"){if(V.attente)return;var e2=(V.nc1||"").length===6,kk=e2?"nc2":"nc1";V[kk]=(V[kk]||"")+v;V.erreurPin="";
    if(!e2&&V.nc1.length===6&&codeFaible(V.nc1)){V.erreurPin="Ce code est trop facile à deviner. Choisissez-en un autre.";V.nc1=""}
    if(e2&&V.nc2.length===6){if(V.nc2!==V.nc1){V.erreurPin="Les deux codes ne sont pas pareils. Recommencez.";V.nc1="";V.nc2=""}
      else{V.attente=true;rendre();fonction("changer_code",{id:PROFIL.id,code:V.nc1},true).then(function(){V.attente=false;V.nc1="";V.nc2="";PROFIL.code_a_changer=false;ecrireLS(CLE_PROFIL,PROFIL);
          (STATE.profils||[]).forEach(function(p){if(p.id===PROFIL.id)p.code_a_changer=false});construireD();toast("Votre nouveau code est enregistré");rendre();window.scrollTo(0,0)},
        function(e){V.attente=false;V.nc1="";V.nc2="";V.erreurPin=e&&e.message||"Enregistrement impossible";rendre()});return}}
    rendre()}
  else if(a==="ncEff"){var k2=(V.nc1||"").length===6?"nc2":"nc1";V[k2]=(V[k2]||"").slice(0,-1);rendre()}
  else if(a==="ncRetour"){if((V.nc1||"").length===6){V.nc1="";V.nc2="";V.erreurPin="";rendre()}else sortir()}
  else if(a==="reessayer"){chargerEquipe();toast("Connexion…")}
  else if(a==="installer"){installer()}
  else if(a==="notif"){demanderNotif()}
  else if(a==="notifNon"){ecrireLS("fermeKonate.notifPlusTard",true);majBandeaux()}
  else if(a==="okRejet"){ETAT.rejets=[];majBandeaux()}
  else if(a==="sortir"){sortir()}
  else if(a==="ouvrir"){var prec=V.F&&V.F.type!=="ok"?V.F:null;ouvrir(v,b.getAttribute("data-c"),b.getAttribute("data-id"),b.getAttribute("data-r"));var jj=b.getAttribute("data-j");if(V.F&&prec&&V.F!==prec)V.F.retour=prec;if(jj&&V.F){V.F.jour=jj;rendreFeuille()}}
  else if(a==="fermer"){fermer()}
  else if(a==="valider"){valider()}
  else if(a==="changerDate"){V.F.changerDate=true;rendreFeuille()}
  else if(a==="changerPrix"){V.F.changerPrix=true;rendreFeuille()}
  else if(a==="set"){V.F[k]=v;if(V.F.type==="oeufs"&&k==="comp"){V.F.r=premierRamLibre(v);chargerOeufs(V.F)}
    if(V.F.type==="poules"&&k==="comp")V.F.n=Math.max(0,effectif(v,auj()));
    if(V.F.type==="morts"&&k==="comp"){var mm=recMort(v,V.F.date);V.F.n=mm?mm.n:0}
    if(V.F.type==="aliment"&&k==="comp"){var aa=recAlim(v,V.F.date);V.F.sacs=aa?aa.sacs:0}
    rendreFeuille()}
  else if(a==="setRam"){V.F.r=n0(v);chargerOeufs(V.F);rendreFeuille()}
  else if(a==="setN"){V.F[k]=n0(v);rendreFeuille()}
  else if(a==="multi"){var arr=V.F[k],i=arr.indexOf(v);if(i>=0)arr.splice(i,1);else arr.push(v);rendreFeuille()}
  else if(a==="bascule"){V.F[k]=!V.F[k];rendreFeuille()}
  else if(a==="pas"){V.F[k]=Math.max(0,Math.round((n0(V.F[k])+n0(v))*10)/10);var inp=document.getElementById("cpt_"+k);if(inp)inp.value=V.F[k];majResume()}
  else if(a==="aucuneMorte"){var F=V.F;if(!(estDG()&&F.changerDate&&F.date&&F.date<=auj()))F.date=auj();var exM2=D.mouv.find(function(x){return x.type==="mort"&&x.comp===F.comp&&x.date===F.date});if(!ecrire(F.date,"mouv",exM2?exM2.id:uid(),{date:F.date,comp:F.comp,type:"mort",n:0,note:""}))return;
    var cs=D.reglages.comps,i2=cs.findIndex(function(c){return c.id===F.comp}),s=null;for(var j=1;j<cs.length;j++){var c=cs[(i2+j)%cs.length];if(!mortsSaisis(c.id,F.date)){s={type:"morts",comp:c.id,lib:"Continuer avec "+c.court};break}}
    vibrer();V.F={type:"ok",msg:"Aucune poule morte dans "+comp(F.comp).court+".",suite:s};rendre()}
  else if(a==="annuler"){if(!confirm("Annuler cette saisie ?"))return;var l=b.getAttribute("data-l"),id=b.getAttribute("data-id"),dd=b.getAttribute("data-d");
    if(l==="ventes")D.regl.filter(function(r){return r.vente===id}).forEach(function(r){ecrire(r.date,"regl",r.id,null)});
    if(l==="alimIn"){var dp=D.dep.find(function(x){return x.auto===id});if(dp)ecrire(dp.date,"dep",dp.id,null)}
    ecrire(dd,l,id,null);toast("Saisie annulée");rendreApp()}
  else if(a==="bloquer"){if(!estDG())return;var ub=D.users.find(function(x){return x.id===b.getAttribute("data-id")});if(!ub||ub.role==="proprio")return;
    if(!ub.bloque&&!confirm("Bloquer "+ub.nom+" ? Il sera sorti de l'application tout de suite."))return;var nb2=!ub.bloque;actionEquipe("bloquer",{id:ub.id,bloque:nb2},ub.nom+(nb2?" est bloqué":" est débloqué"))}
  else if(a==="supprUser"){if(!estDG())return;var ur=D.users.find(function(x){return x.id===b.getAttribute("data-id")});if(!ur||ur.role==="proprio")return;if(!confirm("Retirer "+ur.nom+" de l'équipe ? Ses saisies restent enregistrées."))return;actionEquipe("retirer",{id:ur.id},ur.nom+" est retiré de l'équipe")}
  else if(a==="chipForm"){var g=b.closest("[data-groupe]");g.querySelectorAll(".chip").forEach(function(x){x.classList.toggle("on",x===b)});b.closest("form").elements[g.getAttribute("data-groupe")].value=v}
  else if(a==="rappelFait"){ecrire(b.getAttribute("data-d"),"vaccins",b.getAttribute("data-id"),{fait:true,_brut:true});toast("Rappel noté comme fait");rendreApp()}
  else if(a==="copier"){copier(rapportSoir(V.F&&V.F.type==="rapport"?V.date:jourChoisi()),"Rapport copié")}
  else if(a==="copierSauv"){copier(JSON.stringify(STATE.rows),"Sauvegarde copiée")}
});
function majResume(){var r=document.getElementById("resume");if(!r||!V.F)return;if(V.F.type==="oeufs")r.innerHTML=resumeOeufs();if(V.F.type==="vente")r.innerHTML=resumeVente()}
document.addEventListener("input",function(e){
  var t=e.target,k=t.getAttribute("data-k");
  if(k&&V.F){V.F[k]=t.value;
    var lu=document.getElementById("lu_"+k);if(lu)lu.textContent=t.value!==""?"= "+gnf(t.value):"En francs guinéens";
    if(k==="date"){if(V.F.type==="oeufs")chargerOeufs(V.F);rendreFeuille();return}
    majResume()}
});
document.addEventListener("change",function(e){
  var t=e.target,a=t.getAttribute("data-act");
  if(a==="date"&&t.value){V.date=t.value;rendreApp()}
  if(a==="dateRap"&&t.value){V.date=t.value;rendreFeuille()}
  if(a==="moisRap"&&t.value){V.mois=t.value;rendreFeuille()}
  if(a==="photo"&&t.files&&t.files[0]&&V.F){var F=V.F;toast("Préparation de la photo…");compresser(t.files[0]).then(function(p){if(V.F!==F)return;F.photo=p;F.recu=null;rendreFeuille()},function(){toast("Photo illisible, réessayez")})}
});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&V.F)fermer()});
function copier(t,msg){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast(msg)},function(){repli(t,msg)})}else repli(t,msg)}
function repli(t,msg){var ta=document.createElement("textarea");ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");toast(msg)}catch(e){toast("Copie impossible")}ta.remove()}
document.addEventListener("submit",function(e){
  var f=e.target,type=f.getAttribute("data-f");if(!type)return;e.preventDefault();
  var g=function(n){return f.elements[n]?f.elements[n].value.trim():""};
  if(type==="user"){if(!estDG())return toast("Seul le DG peut ajouter une personne");var cp=g("pin").replace(/\s/g,""),nm=g("nom"),rl=g("role")||"com";
    if(nm.length<2)return toast("Indiquez le nom");if(!/^\d{6}$/.test(cp))return toast("Le code doit avoir 6 chiffres");if(codeFaible(cp))return toast("Ce code est trop facile à deviner");
    actionEquipe("ajouter",{nom:nm,role:ROLE_BASE[rl],code:cp},"",function(){V.F={type:"ok",msg:esc(nm)+" est ajouté comme "+ROLES[rl].toLowerCase()+".<br>Son code : <b style=\"font-size:26px;letter-spacing:3px\">"+codeLisible(cp)+"</b><br>Donnez-le-lui en main propre."};rendre()});return}
  if(type==="ferme"){if(!estDG())return;var R=D.reglages;R.ferme=g("ferme");R.lieu=g("lieu");["prix","oeufsAlv","objectif","seuilPonte","seuilMorts","seuilAliment","margeRam"].forEach(function(k2){R[k2]=Math.max(k2==="oeufsAlv"?1:0,n0(g(k2)))});
    R.heuresRam=RAMS.map(function(r){return g("hr"+r)||heureRam(r)});R.debutCycles=g("debutCycles");R.joursCycle=Math.max(1,n0(g("joursCycle"))||15);R.comps.forEach(function(c){c.nom=g("nom_"+c.id)||c.nom});ecrireConfig();toast("Réglages enregistrés")}
  rendre();
});
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
    return h+'</div><p class="aide" style="text-align:center">Votre nom n\'est pas là ? Seul le DG peut vous ajouter.</p>'+boutonInstaller()+'</div>';
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
  h+='</ul></div><h3>Ajouter une personne</h3><form class="bloc" data-f="user"><div class="champ"><label for="uNom">Nom</label><input id="uNom" name="nom" required minlength="2" maxlength="40" autocomplete="off" placeholder="Ex. : Laye"></div><div class="champ"><span class="etiq">Rôle</span><div class="chips" data-groupe="role">';
  [["com","Commercial"],["gest","Technicien"]].forEach(function(r,i){h+='<button type="button" class="chip '+(i===0?"on":"")+'" data-act="chipForm" data-v="'+r[0]+'">'+r[1]+'</button>'});
  h+='</div><input type="hidden" name="role" value="com"></div><div class="champ"><label for="uPin">Son code secret (6 chiffres)</label><input id="uPin" name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="off" value="'+codeAuHasard()+'" style="font-size:26px;letter-spacing:6px"><span class="hint">Un code est proposé. Vous pouvez le changer. Notez-le et donnez-le en main propre.</span></div><button class="btn">Ajouter</button></form>';
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

/* ---------- Installation sur le téléphone, fonctionnement sans réseau, rappels sonores ---------- */
var INSTALL=null;
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();INSTALL=e;if(!moi())rendre();else majBandeaux()});
window.addEventListener("appinstalled",function(){INSTALL=null;toast("Application installée");majBandeaux()});
function boutonInstaller(){return INSTALL?'<button class="btn sec" style="margin-top:16px" data-act="installer">'+IC.telephone+' Installer l\'application sur ce téléphone</button>':''}
function installer(){if(!INSTALL)return;INSTALL.prompt();INSTALL.userChoice.then(function(){INSTALL=null;rendre()},function(){})}
if("serviceWorker" in navigator&&location.protocol!=="file:"){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}

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

construireD();rendre();demarrerPartage();
