/* =====================================================================
   CLIENTS (numéro de téléphone) et ANNULATION DES DÉPENSES
   ===================================================================== */
IC.clients='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.4.1 4.2 1.8 4.8 4.4"/></svg>';
IC.tel='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
TITRES.annulation="Annuler une dépense";

/* ---------- Téléphone ---------- */
function telPropre(t){return String(t||"").replace(/[^\d+]/g,"")}
function telValide(t){var d=telPropre(t).replace(/^\+/,"");return d.length>=8&&d.length<=15}
function telLisible(t){var d=telPropre(t);if(/^\d{9}$/.test(d))return d.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/,"$1 $2 $3 $4");return d}
function telInternational(t){var d=telPropre(t).replace(/^\+/,"").replace(/^00/,"");if(/^\d{9}$/.test(d))d="224"+d;return d}
function cleClient(n){return String(n||"").trim().toLowerCase().replace(/\s+/g," ")}
/* Dernier numéro connu pour ce client (pour le remplir tout seul) */
function telConnu(nom){var k=cleClient(nom);if(!k)return "";var L=D.ventes.filter(function(v){return v.tel&&cleClient(v.client)===k}).sort(function(a,b){return (b.t||0)-(a.t||0)});return L.length?L[0].tel:""}
function champTel(){
  var F=V.F;if(!F.telTouche)F.tel=telConnu(F.client);
  return '<div class="champ"><label for="vtel">Téléphone du client</label><input id="vtel" data-k="tel" type="tel" inputmode="tel" autocomplete="off" maxlength="20" placeholder="Ex. : 620 00 00 00" value="'+esc(F.tel||"")+'"><span class="hint">Pour le rappeler, surtout s\'il prend à crédit. Rempli tout seul pour un client déjà connu.</span></div>';
}
function boutonsContact(tel){
  if(!tel)return '';
  var i=telInternational(tel);
  return '<span class="contact"><a class="btn sec petit" href="tel:+'+i+'">'+IC.tel+' Appeler</a><a class="btn sec petit" href="https://wa.me/'+i+'" target="_blank" rel="noopener">WhatsApp</a></span>';
}

/* ---------- Liste des clients (à partir des ventes) ---------- */
function listeClients(){
  var M={};
  D.ventes.slice().sort(function(a,b){return (a.t||0)-(b.t||0)}).forEach(function(v){
    var k=cleClient(v.client);if(!k)return;var c=M[k]=M[k]||{nom:v.client.trim(),tel:"",n:0,alv:0,total:0,reste:0,derniere:""};
    c.nom=v.client.trim();if(v.tel)c.tel=v.tel;c.n++;c.alv+=n0(v.alv);c.total+=venteTotal(v);c.reste+=venteReste(v);if(v.date>c.derniere)c.derniere=v.date});
  return Object.keys(M).map(function(k){return M[k]});
}
function contenuClients(){
  var h='',tri=V.triClient||"recent",tous=listeClients(),sansTel=tous.filter(function(c){return !c.tel}).length;
  h+=kpis([[nb(tous.length),"client"+(tous.length>1?"s":"")],[nb(somme(tous,function(c){return c.reste})),"GNF de crédits",somme(tous,function(c){return c.reste})>0],[nb(sansTel),"sans numéro",sansTel>0]]);
  h+='<div class="champ" style="margin:10px 0 6px"><input id="rechClient" type="search" placeholder="Chercher un client ou un numéro" value="'+esc(V.rechClient||"")+'" autocomplete="off"></div>';
  h+='<div class="chips j-fil">'+[["recent","Derniers achats"],["credit","Crédits d'abord"],["achats","Plus gros clients"]].map(function(x){return '<button class="chip '+(tri===x[0]?"on":"")+'" data-act="triClient" data-v="'+x[0]+'">'+x[1]+'</button>'}).join("")+'</div>';
  return h+'<div id="lc-zone">'+listeClientsHtml()+'</div>';
}
function listeClientsHtml(){
  var tous=listeClients(),L=tous.slice(),q=cleClient(V.rechClient||""),tq=telPropre(V.rechClient||""),tri=V.triClient||"recent",h="";
  if(q)L=L.filter(function(c){return cleClient(c.nom).indexOf(q)>=0||(tq.length>=3&&telPropre(c.tel).indexOf(tq)>=0)});
  L.sort(function(a,b){return tri==="credit"?b.reste-a.reste:tri==="achats"?b.total-a.total:(a.derniere<b.derniere?1:-1)});
  if(!L.length)return h+'<div class="vide">'+(tous.length?"Aucun client ne correspond.":"Aucun client pour l'instant. Ils apparaissent ici dès la première vente.")+'</div>';
  h+='<ul class="liste-clients">';
  L.forEach(function(c){
    h+='<li><div class="lc-h"><span class="avatar">'+esc(initiales(c.nom))+'</span><span class="x"><b>'+esc(c.nom)+'</b><small>'+(c.tel?telLisible(c.tel):'<span class="rouge">pas de numéro</span>')+'</small></span>'+(c.reste?'<span class="ctrl-p ctrl-alr">doit '+nb(c.reste)+'</span>':'<span class="ctrl-p ctrl-ok">à jour</span>')+'</div>';
    h+='<div class="lc-c"><span>'+nb(c.n)+' achat'+(c.n>1?"s":"")+'</span><span>'+nb(c.alv)+' alv.</span><span>'+gnf(c.total)+'</span><span>dernier : '+dateCourte(c.derniere)+'</span></div>'+boutonsContact(c.tel)+'</li>'});
  return h+'</ul>';
}

/* ---------- Annuler une dépense (avec un motif) ---------- */
function peutAnnulerDep(x){var u=moi();if(!u)return false;if(u.role==="proprio")return true;return u.role==="com"&&x.parId===u.id&&x.date===auj()}
function boutonAnnulerDep(x){return peutAnnulerDep(x)?'<button class="lien rouge" data-act="annulerDep" data-id="'+x.id+'">Annuler</button>':''}
var MOTIFS=["Erreur de saisie","Mauvais montant","Saisie en double","Dépense pas faite"];
function fAnnulation(){
  var F=V.F,x=D.dep.find(function(d){return d.id===F.dep});if(!x)return '<p class="aide">Dépense introuvable.</p>';
  var h='<div class="resume"><b>'+esc(x.cat)+' · '+gnf(x.montant)+'</b><br>'+(x.note?esc(x.note)+'<br>':'')+'Saisie '+quand(x.date)+' à '+heure(x.t)+' par '+esc(x.par||"")+'.</div>';
  h+='<div class="champ"><span class="etiq">Pourquoi l\'annuler ?</span><div class="chips">'+MOTIFS.map(function(m){return '<button type="button" class="chip '+(F.motif===m?"on":"")+'" data-act="set" data-k="motif" data-v="'+esc(m)+'">'+esc(m)+'</button>'}).join("")+'</div></div>';
  h+='<div class="champ"><label for="motif">Motif</label><input id="motif" data-k="motif" maxlength="200" value="'+esc(F.motif||"")+'" placeholder="Écrivez le motif"></div>';
  h+='<p class="aide">La dépense n\'est pas effacée : elle reste visible par le DG comme « annulée », avec le motif, la date et le nom de la personne.'+(x.auto?" L'achat d'aliment lié est annulé aussi.":"")+'</p>';
  return h;
}
function validerAnnulation(F){
  var x=D.dep.find(function(d){return d.id===F.dep});if(!x)return toast("Dépense introuvable");
  if(!peutAnnulerDep(x))return toast("Seul le DG peut annuler cette dépense");
  var m=String(F.motif||"").trim();if(m.length<3)return toast("Indiquez le motif de l'annulation");
  OUT.push({k:"maj",l:"dep",id:x.id,patch:{annule:true,motif_annulation:m},par:PROFIL.id,quand:Date.now()});
  if(x.auto)OUT.push({k:"maj",l:"alimIn",id:x.auto,patch:{annule:true,motif_annulation:m},par:PROFIL.id,quand:Date.now()});
  sauverOut();construireD();vider();
  V.F={type:"ok",msg:"Dépense annulée : "+esc(x.cat)+" "+gnf(x.montant)+".<br>Motif : "+esc(m)+"."};vibrer();rendre();
}
/* Chez le commercial : ses dépenses d'aujourd'hui, qu'il peut annuler */
function mesDepensesDuJour(d){
  var u=moi();if(!u||d!==auj())return "";
  var L=D.dep.filter(function(x){return x.date===d&&(u.role==="proprio"||x.parId===u.id)}).sort(function(a,b){return (b.t||0)-(a.t||0)});
  if(!L.length)return "";
  var h='<h3>Dépenses d\'aujourd\'hui</h3><div class="bloc"><ul class="hist">';
  L.forEach(function(x){h+='<li>'+icone(((CATS.find(function(c){return c[0]===x.cat})||["","note"])[1]),"arg")+'<span class="x"><b>'+esc(x.cat)+' · '+gnf(x.montant)+'</b><small>'+heure(x.t)+(x.note?' · '+esc(x.note):'')+'</small></span>'+boutonAnnulerDep(x)+'</li>'});
  return h+'</ul><p class="aide" style="margin:8px 0 0">Vous pouvez annuler vos propres dépenses du jour. Après, seul le DG peut le faire.</p></div>';
}
/* Chez le DG : les dépenses annulées de la période */
function depensesAnnulees(Q){
  var L=(D.depAnnulees||[]).filter(function(x){return x.date>=Q.deb&&x.date<=Q.fin});
  if(!L.length)return "";
  var h='<h3 class="sous-t">Dépenses annulées ('+L.length+')</h3><ul class="hist annulees">';
  L.forEach(function(x){h+='<li>'+icone("note","arg")+'<span class="x"><b><s>'+esc(x.cat)+' · '+gnf(x.montant)+'</s></b><small>Saisie '+quand(x.date)+' par '+esc(x.par||"")+' · annulée'+(x.annulePar?' par '+esc(x.annulePar):'')+(x.motif?' : « '+esc(x.motif)+' »':'')+'</small></span></li>'});
  return h+'</ul>';
}

/* Recherche dans les clients et téléphone tapé à la main */
document.addEventListener("input",function(e){var t=e.target;if(!t)return;
  if(t.id==="rechClient"){V.rechClient=t.value;var z=document.getElementById("lc-zone");if(z)z.innerHTML=listeClientsHtml()}
  if(t.id==="vtel"&&V.F)V.F.telTouche=true});
document.addEventListener("change",function(e){var t=e.target;if(t&&t.id==="vc"&&V.F&&!V.F.telTouche){var n=telConnu(t.value),i=document.getElementById("vtel");if(i&&n){i.value=n;V.F.tel=n}}});

/* ================= Onglet « Annuler » =================
   Ce qu'on peut annuler, puis tout ce qui a déjà été annulé : quand, par qui, pourquoi. */
var CLE_ANN_VU="fermeKonate.annVu";
function annulNonVues(){var vu=n0(lireLS(CLE_ANN_VU,0));return (D.depAnnulees||[]).filter(function(x){return Date.parse(x.annuleLe||"")>vu}).length}
TITRES.dAnnuler="Annuler une dépense";DET.dAnnuler=["arg","note"];
function contenuAnnuler(){
  var u=moi();if(!u)return "";var dg=u.role==="proprio",deb=decal(auj(),-30),h='';
  var A=D.dep.filter(function(x){return peutAnnulerDep(x)&&(dg?x.date>=deb:true)}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(b.t||0)-(a.t||0)});
  var Z=(D.depAnnulees||[]).filter(function(x){return dg||x.parId===u.id});
  h+=kpis([[nb(A.length),"à annuler possible"],[nb(Z.length),"annulée"+(Z.length>1?"s":""),Z.length>0],[nb(somme(Z,function(x){return x.montant})),"GNF annulés"]]);
  h+='<h3 class="sous-t">Déjà annulées</h3>';
  if(!Z.length)h+='<div class="vide">Aucune dépense annulée.</div>';
  else{
  var vu=n0(lireLS(CLE_ANN_VU,0));
  h+='<ul class="hist annulees">';Z.forEach(function(x){var nv=dg&&Date.parse(x.annuleLe||"")>vu;
    h+='<li class="'+(nv?"nouv":"")+'">'+icone("note","arg")+'<span class="x"><b><s>'+esc(x.cat)+' · '+gnf(x.montant)+'</s>'+(nv?' <span class="ctrl-p ctrl-alr">nouveau</span>':'')+'</b>'+
      '<small><b class="rouge">Annulée</b> '+(x.annuleLe?quand(x.annuleLe.slice(0,10))+' à '+heure(Date.parse(x.annuleLe)):"")+(x.annulePar?' par '+esc(x.annulePar):'')+'</small>'+
      '<small>Motif : <b>« '+esc(x.motif||"non indiqué")+' »</b></small><small>Dépense saisie '+quand(x.date)+' par '+esc(x.par||"")+(x.note?' · '+esc(x.note):'')+'</small></span></li>'});
  h+='</ul>'}
  h+='<h3 class="sous-t">Ce que vous pouvez annuler</h3><p class="aide" style="margin-top:0">'+(dg?"Toutes les dépenses des 30 derniers jours.":"Vos dépenses d'aujourd'hui. Après minuit, seul le DG peut annuler.")+'</p>';
  if(!A.length)h+='<div class="vide">Rien à annuler.</div>';
  else{h+='<ul class="hist">';A.forEach(function(x){h+='<li>'+icone(((CATS.find(function(c){return c[0]===x.cat})||["","note"])[1]),"arg")+'<span class="x"><b>'+esc(x.cat)+' · '+gnf(x.montant)+'</b><small>'+quand(x.date)+' à '+heure(x.t)+' · '+esc(x.par||"")+(x.note?' · '+esc(x.note):'')+'</small></span><button class="btn dang petit" data-act="annulerDep" data-id="'+x.id+'">Annuler</button></li>'});h+='</ul>'}
  return h;
}
function dAnnuler(){return contenuAnnuler()}
