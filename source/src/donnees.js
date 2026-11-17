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
var TABLES={comptages:"comptages_poules",mouv:"mouvements_poules",malades:"malades",vaccins:"vaccins",prod:"ramassages",ventes:"ventes",regl:"paiements_credits",dep:"depenses",alimIn:"achats_aliment",alimOut:"aliment_donne",vers:"versements",inv:"inventaires"};
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
  else if(l==="alimIn"){x.sacs=num(b.sacs);x.montant=num(b.montant);x.recu=b.recu_chemin||"";x.sacsRecus=b.sacs_recus==null?null:num(b.sacs_recus);x.recuPar=b.recu_par?nomDe(b.recu_par):"";x.recuLe=b.recu_le||null}
  else if(l==="inv"){x.type=b.type;x.compte=num(b.compte);x.theorique=b.theorique==null?null:num(b.theorique);x.note=b.note||""}
  else if(l==="dep"){x.cat=b.categorie;x.montant=num(b.montant);x.note=b.detail||"";x.imprevu=!!b.imprevu;x.recu=b.recu_chemin||"";x.auto=b.achat_aliment_id||""}
  else if(l==="ventes"){x.client=b.client;x.alv=num(b.alveoles);x.prix=num(b.prix_alveole);x.paye=num(b.paye);x.tel=b.client_tel||""}
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
  else if(l==="ventes"){if("client" in r)a("client",String(r.client||"").trim());if("alv" in r)a("alveoles",entier(r.alv));if("prix" in r)a("prix_alveole",entier(r.prix));if("paye" in r)a("paye",entier(r.paye));if("tel" in r)a("client_tel",r.tel||null)}
  else if(l==="regl"){a("vente_id",r.vente);if("montant" in r)a("montant",entier(r.montant))}
  else if(l==="inv"){a("type",r.type);if("compte" in r)a("compte",Math.max(0,n0(r.compte)));if("theorique" in r)a("theorique",r.theorique==null?null:n0(r.theorique));if("note" in r)a("note",(r.note||"").trim()||null)}
  else if(l==="vers"){if("cycle" in r)a("cycle",r.cycle);if("montant" in r)a("montant",entier(r.montant));if("recu" in r)a("recu_chemin",r.recu||null)}
  return b;
}
function nomDe(id){var p=(STATE.profils||[]).find(function(x){return x.id===id});return p?p.nom:(PROFIL&&PROFIL.id===id?PROFIL.nom:"")}
function reglagesApp(){
  var g=STATE.reg||{},bats=(STATE.bats&&STATE.bats.length?STATE.bats.slice().sort(function(a,b){return a.ordre-b.ordre}).map(function(b){return {id:b.id,court:b.court,nom:b.nom}}):cloner(COMPS));
  return {ferme:g.ferme||"Ferme avicole de M. Konaté",lieu:g.lieu||"Kankan",prix:num(g.prix_alveole||47000),oeufsAlv:num(g.oeufs_par_alveole||30),objectif:num(g.objectif_alveoles==null?80:g.objectif_alveoles),
    seuilPonte:num(g.seuil_ponte==null?70:g.seuil_ponte),seuilMorts:num(g.seuil_morts==null?5:g.seuil_morts),seuilAliment:num(g.seuil_aliment==null?5:g.seuil_aliment),heureFin:18,
    heuresRam:(g.heures_ramassage||["08:00","12:00","14:00","18:00"]).map(hm),margeRam:num(g.marge_retard_min==null?30:g.marge_retard_min),comps:bats,debutCycles:g.debut_cycles||"",joursCycle:num(g.jours_cycle||15),
    poulesRef:num(g.poules_reference==null?2997:g.poules_reference),sacsMin:num(g.sacs_min==null?5:g.sacs_min),sacsMax:num(g.sacs_max==null?7:g.sacs_max),prixSac:num(g.prix_sac==null?290000:g.prix_sac),kgSac:num(g.kg_sac||50),ponteMin:num(g.ponte_min==null?75:g.ponte_min),ponteMoyen:num(g.ponte_moyen==null?60:g.ponte_moyen),
    ouvDate:g.ouv_date||"",ouvAlv:num(g.ouv_alveoles),ouvSacs:num(g.ouv_sacs),ouvCaisse:num(g.ouv_caisse)};
}

/* ---------- File d'attente appliquée par-dessus les données reçues ---------- */
function appliquer(rows,op){
  if(op.k==="ins"){rows[op.l][op.id]=Object.assign({saisi_par:PROFIL&&PROFIL.id,saisi_le:new Date().toISOString(),annule:false,apres_coup:false},op.row,{id:op.id})}
  else if(op.k==="maj"){var r=rows[op.l][op.id];if(r)rows[op.l][op.id]=Object.assign({},r,op.patch)}
  else if(op.k==="rpc"&&op.f==="confirmer_reception"){var ac=rows.alimIn[op.args.p_id];if(ac)rows.alimIn[op.args.p_id]=Object.assign({},ac,{sacs_recus:op.args.p_sacs,recu_par:PROFIL&&PROFIL.id,recu_le:new Date().toISOString()})}
  else if(op.k==="rpc"&&op.f==="marquer_rappel_fait"){var v=rows.vaccins[op.args.p_id];if(v)rows.vaccins[op.args.p_id]=Object.assign({},v,{rappel_fait:true})}
}
function construireD(){
  var rows=STATE.rows;
  if(OUT.some(function(o){return o.k==="ins"||o.k==="maj"||o.k==="rpc"})){rows={};LISTES.forEach(function(l){rows[l]=Object.assign({},STATE.rows[l])});OUT.forEach(function(o){appliquer(rows,o)})}
  var reg=STATE.reg;OUT.forEach(function(o){if(o.k==="cfg")STATE.reg=Object.assign({},STATE.reg||{},o.patch)});
  var bats=STATE.bats;OUT.forEach(function(o){if(o.k==="bat"&&STATE.bats)STATE.bats=STATE.bats.map(function(b){return b.id===o.id?Object.assign({},b,{nom:o.nom}):b})});
  D={reglages:reglagesApp(),users:(STATE.profils||[]).filter(function(p){return !p.retire}).map(function(p){return {id:p.id,nom:p.nom,role:ROLE_APP[p.role]||"gest",bloque:!!p.bloque,codeAChanger:!!p.code_a_changer}})};
  STATE.reg=reg;STATE.bats=bats;
  D.depAnnulees=[];
  LISTES.forEach(function(l){D[l]=[];var m=rows[l];for(var id in m){var b=m[id];if(!b)continue;
    if(!b.annule)D[l].push(versApp(l,b));else if(l==="dep"){var xa=versApp(l,b);xa.motif=b.motif_annulation||"";xa.annulePar=nomDe(b.annule_par);xa.annuleLe=b.annule_le;D.depAnnulees.push(xa)}}});
  D.depAnnulees.sort(function(a,b){return (b.annuleLe||"")>(a.annuleLe||"")?1:-1});
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
  else if(rec._rpc)op={k:"rpc",f:rec._rpc,args:rec.args};
  else if(l==="vaccins"&&rec._brut&&rec.fait)op={k:"rpc",f:"marquer_rappel_fait",args:{p_id:id}};
  else if(idBrut(l,id)){var r=Object.assign({},rec);delete r._brut;delete r.date;op={k:"maj",l:l,id:id,patch:versBase(l,r)}}
  else op={k:"ins",l:l,id:id,row:Object.assign(versBase(l,rec),{id:id,jour:date||auj(),saisi_tel:new Date().toISOString()})};
  op.par=PROFIL&&PROFIL.id;op.quand=Date.now();
  OUT.push(op);sauverOut();construireD();vider();
  return true;
}
function ecrireConfig(){
  var R=D.reglages;
  OUT.push({k:"cfg",patch:{ferme:R.ferme,lieu:R.lieu,prix_alveole:entier(R.prix),oeufs_par_alveole:Math.max(1,entier(R.oeufsAlv)),objectif_alveoles:entier(R.objectif),seuil_ponte:Math.min(100,entier(R.seuilPonte)),seuil_morts:entier(R.seuilMorts),seuil_aliment:entier(R.seuilAliment),marge_retard_min:entier(R.margeRam),heures_ramassage:R.heuresRam.map(function(h){return h.length===5?h+":00":h}),debut_cycles:R.debutCycles||null,jours_cycle:Math.max(1,entier(R.joursCycle)),
    poules_reference:entier(R.poulesRef),sacs_min:Math.min(n0(R.sacsMin),n0(R.sacsMax)),sacs_max:Math.max(n0(R.sacsMin),n0(R.sacsMax)),prix_sac:entier(R.prixSac),kg_sac:Math.max(1,entier(R.kgSac)),ponte_min:Math.min(100,entier(R.ponteMin)),ponte_moyen:Math.min(entier(R.ponteMin),entier(R.ponteMoyen)),
    ouv_date:R.ouvDate||null,ouv_alveoles:R.ouvDate?entier(R.ouvAlv):null,ouv_sacs:R.ouvDate?Math.max(0,n0(R.ouvSacs)):null,ouv_caisse:R.ouvDate?entier(R.ouvCaisse):null}});
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
var envoiEnCours=false,debutEnvoi=0;
/* Un envoi qui ne répond pas en 25 s est considéré comme un problème de réseau : on réessaiera */
function avecDelai(p){return Promise.race([p,new Promise(function(_,ko){setTimeout(function(){ko({reseau:true})},25000)})])}
function mesEnvois(){return OUT.filter(function(o){return !o.par||!PROFIL||o.par===PROFIL.id})}
function vider(){
  if(envoiEnCours&&Date.now()-debutEnvoi>60000)envoiEnCours=false;
  if(!SB||envoiEnCours||!OUT.length||!PROFIL){majStatut();return}
  envoiEnCours=true;debutEnvoi=Date.now();
  (function suivant(){
    var op=OUT.find(function(o){return !o.par||o.par===PROFIL.id});
    if(!op){envoiEnCours=false;ETAT.horsLigne=false;majStatut();rafraichir();return}
    debutEnvoi=Date.now();
    avecDelai(envoyer(op)).then(function(ligne){
      OUT.splice(OUT.indexOf(op),1);sauverOut();
      if(ligne&&op.l){STATE.rows[op.l][ligne.id]=ligne;if(ligne.annule&&op.l!=="dep")delete STATE.rows[op.l][ligne.id];enCache()}
      ETAT.horsLigne=false;suivant();
    },function(e){
      if(e&&e.definitif){
        OUT.splice(OUT.indexOf(op),1);
        /* Si une photo est refusée, la saisie qui l'attend reste valable */
        sauverOut();ETAT.rejets.push(e.message);toast(e.message);construireD();suivant();return}
      envoiEnCours=false;
      if(e&&e.session){SB.auth.refreshSession().then(function(r){if(r.error&&/refresh|banned|invalid|not found/i.test(r.error.message||""))perteSession();else setTimeout(vider,1500)},function(){ETAT.horsLigne=true;majStatut()})}
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
    listes.forEach(function(l,i){var m={};(res[i+3]||[]).forEach(function(b){if(!b.annule||l==="dep")m[b.id]=b});STATE.rows[l]=m});
    STATE.charge=Date.now();enCache();ETAT.recu=true;ETAT.horsLigne=false;chargeEnCours=null;
    var p=STATE.profils.find(function(x){return x.id===PROFIL.id});
    if(!p||p.bloque||p.retire){perteSession(p&&(p.bloque||p.retire)?"Accès bloqué par le DG.":"");return}
    if(p.code_a_changer!==PROFIL.code_a_changer||p.nom!==PROFIL.nom){PROFIL=Object.assign({},PROFIL,{code_a_changer:!!p.code_a_changer,nom:p.nom});ecrireLS(CLE_PROFIL,PROFIL)}
    construireD();rafraichir();vider();
  },function(e){chargeEnCours=null;
    /* Session expirée (téléphone resté longtemps en veille) : on la renouvelle puis on recharge et on renvoie */
    if(e&&e.session){SB.auth.refreshSession().then(function(r){if(r.error&&/refresh|banned|invalid|not found/i.test(r.error.message||""))perteSession();else setTimeout(function(){recharger();vider()},800)})}
    else ETAT.horsLigne=true;majStatut()});
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
    else{var l=LISTE_DE[t];if(!l)return;if(b.annule&&l!=="dep")delete STATE.rows[l][b.id];else STATE.rows[l][b.id]=b}
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
      return res.json().catch(function(){return {}}).then(function(j){
        if(!res.ok){
          /* Session fermée côté serveur (code changé, compte bloqué) : on revient proprement à l'écran d'entrée */
          if(avecJeton&&res.status===401){perteSession("Pour votre sécurité, reconnectez-vous avec votre code.");throw {message:"Reconnectez-vous avec votre code, puis recommencez."}}
          throw {message:j.erreur||"Erreur du serveur.",status:res.status,info:j}}
        if(j&&j.session&&SB)return SB.auth.setSession({access_token:j.session.access_token,refresh_token:j.session.refresh_token}).then(function(){return j},function(){return j});
        return j})},
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
