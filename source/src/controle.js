/* ---------- Contrôle de cohérence (réservé au DG) ----------
   Compare chaque jour ce qui est saisi avec ce qui est normal pour une ferme de pondeuses :
   ponte, aliment par poule, sacs donnés, stocks, argent. Personne n'a rien à saisir en plus. */
var G_MIN=105,G_MAX=130;
function prixSacReel(){
  var L=D.alimIn.filter(function(a){return n0(a.sacs)>0&&n0(a.montant)>0}).sort(function(a,b){return a.date<b.date?1:-1}).slice(0,5);
  var s=somme(L,function(a){return a.sacs});return s>0?somme(L,function(a){return a.montant})/s:n0(D.reglages.prixSac);
}
function signe(n){return (n>0?"+":"")+nb(n)}
function controleJour(d){
  var R=D.reglages,oeufs=oeufsJour(null,d),cas=cassesJour(null,d),alv=alvDe(oeufs,cas),sacs=alimJour(null,d),eff=effectifTotal(d);
  var poules=eff>0?eff:n0(R.poulesRef),ponteV=poules>0?oeufs/poules:NaN,g=poules>0?sacs*n0(R.kgSac)*1000/poules:NaN;
  var prixS=prixSacReel(),coutAlim=sacs*prixS,valeur=alv*n0(R.prix),mo=morts(null,d),pts=[];
  var prodOk=D.prod.some(function(p){return p.date===d}),alimOk=D.alimOut.some(function(a){return a.date===d});
  if(eff>0&&n0(R.poulesRef)>0&&Math.abs(eff-R.poulesRef)/R.poulesRef>0.03)
    pts.push({n:1,t:"Poules comptées : <b>"+nb(eff)+"</b>, mais "+nb(R.poulesRef)+" déclarées ("+signe(eff-R.poulesRef)+"). Faites un comptage."});
  if(prodOk&&isFinite(ponteV)){
    var pp=ponteV*100;
    if(pp<R.ponteMin-10)pts.push({n:2,t:"Ponte très basse : <b>"+Math.round(pp)+" %</b> (normal : au moins "+R.ponteMin+" %)."});
    else if(pp<R.ponteMin)pts.push({n:1,t:"Ponte basse : <b>"+Math.round(pp)+" %</b> (normal : au moins "+R.ponteMin+" %)."});
    var m7=ponteMoy7(null,d);if(isFinite(m7)&&m7>0&&ponteV<m7*0.9)pts.push({n:1,t:"La ponte a baissé de <b>"+pct(1-ponteV/m7)+"</b> par rapport aux 7 jours d'avant."});
  }
  if(!prodOk&&d<auj())pts.push({n:2,t:"Aucun ramassage saisi ce jour."});
  if(!alimOk&&d<auj())pts.push({n:1,t:"Aucun aliment saisi ce jour."});
  if(alimOk){
    if(sacs<R.sacsMin)pts.push({n:2,t:"<b>"+nb(sacs)+" sacs</b> donnés : moins que le minimum de "+nb(R.sacsMin)+" sacs."});
    else if(sacs>R.sacsMax)pts.push({n:2,t:"<b>"+nb(sacs)+" sacs</b> donnés : plus que le maximum de "+nb(R.sacsMax)+" sacs."});
    if(isFinite(g)){
      if(g<G_MIN)pts.push({n:1,t:"Ration faible : <b>"+Math.round(g)+" g</b> par poule. Une pondeuse a besoin de 110 à 125 g pour bien pondre."});
      else if(g>G_MAX)pts.push({n:1,t:"Ration très forte : <b>"+Math.round(g)+" g</b> par poule. Vérifiez les sacs ou le nombre de poules."});
      if(prodOk&&g>=110&&isFinite(ponteV)&&ponteV*100<R.ponteMin-10)pts.push({n:2,t:"Les poules mangent normalement mais la ponte est très basse : des œufs peuvent manquer au ramassage."});
    }
  }
  var st=stockAliment(d);if(st<0&&D.reglages.ouvDate)pts.push({n:2,t:"On a donné <b>"+nb(-st)+" sacs</b> de plus que ce qui a été acheté : un achat d'aliment n'est pas saisi."});
  var so=stockOeufs(d);if(so<0&&D.reglages.ouvDate)pts.push({n:2,t:"<b>"+nb(Math.ceil(-so/R.oeufsAlv))+" alvéoles</b> vendues de plus que ce qui a été ramassé : un ramassage n'est pas saisi."});
  if(oeufs>0&&cas/oeufs>0.03)pts.push({n:1,t:"<b>"+pct(cas/oeufs)+" d'œufs cassés</b> ce jour (normal : moins de 3 %)."});
  if(poules>0&&mo/poules>0.002)pts.push({n:1,t:"<b>"+nb(mo)+" poules mortes</b> : plus que la normale (environ 1 pour 1 000 par jour)."});
  return {d:d,alv:alv,oeufs:oeufs,sacs:sacs,poules:poules,eff:eff,ponte:ponteV,g:g,prixS:prixS,coutAlim:coutAlim,valeur:valeur,reste:valeur-coutAlim,coutAlv:alv>0?coutAlim/alv:NaN,
    stockAlim:st,stockAlv:stockAlv(d),pts:pts.sort(function(a,b){return b.n-a.n}),etat:pts.some(function(p){return p.n===2})?2:pts.length?1:0,prodOk:prodOk,alimOk:alimOk};
}
var ETATS_CTRL=[["ok","Cohérent"],["att","À surveiller"],["alr","Incohérent"]];
function pastille(e){return '<span class="ctrl-p ctrl-'+ETATS_CTRL[e][0]+'">'+ETATS_CTRL[e][1]+'</span>'}
function carteControle(){
  if(!estDG())return "";
  var K=controleJour(auj()),H=controleJour(decal(auj(),-1)),SC=sectionsComptable(auj()),e=Math.max(K.etat,H.etat,SC.etat),n=K.pts.length+H.pts.length+SC.n,on=V.ouvertP==="ctrl";
  return '<button class="ctrl-carte ctrl-b'+e+(on?" on":"")+'" data-act="menuOuvrir" data-v="ctrl" aria-pressed="'+(on?"true":"false")+'"><span class="rub-ic">'+IC.loupe+'</span><span class="x"><b>Contrôle de cohérence</b><small>'+(n?n+" point"+(n>1?"s":"")+" à vérifier":"Tout est cohérent")+'</small></span>'+pastille(e)+'</button>';
}
function contenuControle(){
  var d=jourChoisi(),R=D.reglages,K=controleJour(d),h='';
  h+='<div class="temps-date"><button class="ico" data-act="bordJour" data-v="-1" aria-label="Jour d\'avant">'+ICO.retour+'</button><div><b>'+nomJour(d)+'</b><span>'+dComplete(d)+'</span></div><button class="ico" data-act="bordJour" data-v="1" aria-label="Jour d\'après" '+(d>=auj()?"disabled":"")+' style="transform:scaleX(-1)">'+ICO.retour+'</button></div>';
  var pp=isFinite(K.ponte)?Math.round(K.ponte*100):null,gg=isFinite(K.g)?Math.round(K.g):null;
  h+='<div class="ctrl-kpis">'+
    kCtrl(pp==null?"–":pp+" %","Taux de ponte","normal : "+R.ponteMin+" % et plus",pp==null?0:pp<R.ponteMin-10?2:pp<R.ponteMin?1:0)+
    kCtrl(K.alimOk?nb(K.sacs):"–","Sacs donnés","entre "+nb(R.sacsMin)+" et "+nb(R.sacsMax),!K.alimOk?0:(K.sacs<R.sacsMin||K.sacs>R.sacsMax)?2:0)+
    kCtrl(gg==null||!K.alimOk?"–":gg+" g","Aliment par poule","normal : 110 à 125 g",gg==null||!K.alimOk?0:(gg<G_MIN||gg>G_MAX)?1:0)+
    kCtrl(nb(K.poules),"Poules",K.eff>0?"déclarées : "+nb(R.poulesRef):"chiffre déclaré",K.eff>0&&Math.abs(K.eff-R.poulesRef)/R.poulesRef>0.03?1:0)+'</div>';
  h+='<h3 class="sous-t">Ce qu\'il faut vérifier ce jour</h3>';
  if(!K.pts.length)h+='<div class="ctrl-pt ctrl-ok">'+IC.ok+'<span>Tout est cohérent pour ce jour.</span></div>';
  else K.pts.forEach(function(p){h+='<div class="ctrl-pt ctrl-'+(p.n===2?"alr":"att")+'">'+IC.alerte+'<span>'+p.t+'</span></div>'});
  h+=sectionsComptable(d).html;
  h+='<h3 class="sous-t">L\'argent du jour</h3><table class="t"><tbody>'+
    '<tr><td>Alvéoles ramassées × '+nb(R.prix)+'</td><td class="n">'+nb(K.alv)+' alv. = <b>'+gnf(K.valeur)+'</b></td></tr>'+
    '<tr><td>Aliment donné × '+nb(Math.round(K.prixS))+' le sac</td><td class="n">'+nb(K.sacs)+' sacs = <b>'+gnf(K.coutAlim)+'</b></td></tr>'+
    '<tr><td><b>Reste après l\'aliment</b></td><td class="n"><b'+(K.reste<0?' class="rouge"':'')+'>'+gnf(K.reste)+'</b></td></tr>'+
    '<tr><td>Aliment pour une alvéole</td><td class="n">'+(isFinite(K.coutAlv)?gnf(K.coutAlv):"–")+'</td></tr></tbody></table>';
  h+='<p class="aide">Les salaires, vaccins et autres dépenses ne sont pas comptés ici : ils sont dans le menu Dépenses.</p>';
  h+='<h3 class="sous-t">Ce qui doit rester en stock</h3><table class="t"><tbody>'+
    '<tr><td>Sacs d\'aliment (achetés − donnés)</td><td class="n"><b'+(K.stockAlim<0?' class="rouge"':'')+'>'+nb(K.stockAlim)+' sacs</b></td></tr>'+
    '<tr><td>Alvéoles (ramassées − cassées − vendues)</td><td class="n"><b>'+nb(K.stockAlv)+' alv.</b></td></tr></tbody></table>';
  h+='<p class="aide">Comptez ce qu\'il y a vraiment au magasin : s\'il y a moins, quelque chose est sorti sans être saisi.</p>';
  h+='<h3 class="sous-t">Les 7 derniers jours</h3><div class="defile"><table class="t ctrl-7"><thead><tr><th>Jour</th><th>Alv.</th><th>Ponte</th><th>Sacs</th><th>g/poule</th><th></th></tr></thead><tbody>';
  for(var i=0;i<7;i++){var j=decal(d,-i),C=controleJour(j);
    h+='<tr><td>'+dateCourte(j)+'</td><td class="n">'+(C.prodOk?nb(C.alv):"–")+'</td><td class="n">'+(C.prodOk&&isFinite(C.ponte)?Math.round(C.ponte*100)+" %":"–")+'</td><td class="n">'+(C.alimOk?nb(C.sacs):"–")+'</td><td class="n">'+(C.alimOk&&isFinite(C.g)?Math.round(C.g):"–")+'</td><td>'+pastille(C.etat)+'</td></tr>'}
  h+='</tbody></table></div>';
  h+='<p class="aide">Références : '+nb(R.poulesRef)+' poules, '+nb(R.sacsMin)+' à '+nb(R.sacsMax)+' sacs de '+nb(R.kgSac)+' kg par jour, '+gnf(R.prixSac)+' le sac, ponte d\'au moins '+R.ponteMin+' %. À changer dans Réglages → Ferme.</p>';
  return h;
}
function kCtrl(v,l,s,e){return '<div class="ctrl-k ctrl-b'+e+'"><b>'+v+'</b><span>'+l+'</span><small>'+s+'</small></div>'}
IC.loupe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M8 10.5l2 2 3.5-4"/></svg>';

/* ================= Contrôles réels : inventaires, caisse, réception de l'aliment ================= */
var INV={alveoles:["Alvéoles en stock","alvéoles","oeuf"],aliment:["Sacs d'aliment au magasin","sacs","aliment"],caisse:["Argent chez le commercial","GNF","ventes"]};
TITRES.inventaire="Comptage";TITRES.reception="Réception d'aliment";
function caisseTheorique(){
  return n0(D.reglages.ouvCaisse)+somme(D.ventes,function(v){return v.paye})+somme(D.regl,function(r){return r.montant})-somme(D.dep,function(x){return x.montant})-somme(D.vers,function(v){return v.montant});
}
function theoriqueInv(t){return t==="alveoles"?stockAlv(auj()):t==="aliment"?stockAliment(auj()):caisseTheorique()}
function dernierInv(t){var L=D.inv.filter(function(x){return x.type===t}).sort(function(a,b){return a.date===b.date?b.t-a.t:(a.date<b.date?1:-1)});return L[0]||null}
function joursDepuis(d){return Math.round((new Date(auj()+"T12:00:00")-new Date(d+"T12:00:00"))/864e5)}
function valeurEcart(t,e){return t==="caisse"?e:t==="alveoles"?e*n0(D.reglages.prix):e*prixSacReel()}
function receptionsAttente(){return D.alimIn.filter(function(a){return a.sacsRecus==null}).sort(function(a,b){return a.date<b.date?-1:1})}
/* Comptage des poules : écart entre le nouveau comptage et ce que le calcul attendait */
function ecartComptage(c){
  var L=D.comptages.filter(function(k){return k.comp===c}).sort(function(a,b){return a.date===b.date?a.t-b.t:(a.date<b.date?-1:1)});
  if(L.length<2)return null;var k=L[L.length-1],p=L[L.length-2],n=n0(p.n);
  var apres=function(m,x){return m.date>x.date||(m.date===x.date&&m.t>x.t)};
  D.mouv.forEach(function(m){if(m.comp===c&&apres(m,p)&&!apres(m,k))n+=(m.type==="arrivee"?1:-1)*n0(m.n)});
  return {k:k,theorique:n,ecart:n0(k.n)-n};
}
function fInventaire(){
  var F=V.F,t=INV[F.kind],h='<div class="resume">'+IC[t[2]]+' <b>'+t[0]+'</b></div>';
  h+=F.kind==="caisse"?champMontant("n","Argent compté dans la caisse du commercial (GNF)"):compteur("n",F.kind==="alveoles"?"Alvéoles comptées au magasin":"Sacs comptés au magasin",1,[-10,10],F.kind==="aliment");
  h+='<div class="champ"><label for="invNote">Remarque (facultatif)</label><input id="invNote" data-k="note" maxlength="200" value="'+esc(F.note||"")+'"></div>';
  h+='<p class="aide">Comptez ce qui est vraiment là, sans regarder les chiffres de l\'application.'+(F.kind==="caisse"?" Le commercial ne voit pas ce comptage.":" Le DG compare ensuite avec ses chiffres.")+'</p>';
  return h;
}
function fReception(){
  var F=V.F,a=D.alimIn.find(function(x){return x.id===F.achat});if(!a)return '<p class="aide">Achat introuvable.</p>';
  return '<div class="resume">Achat '+quand(a.date)+' par '+esc(a.par||"le commercial")+' : <b>'+nb(a.sacs)+' sacs</b> payés.</div>'+compteur("n","Sacs vraiment arrivés au magasin",1,[-10,10],true)+'<p class="aide">Comptez les sacs un par un. Si le nombre est différent, le DG est prévenu.</p>';
}
function validerControle(F){
  var u=moi();if(!u)return;
  if(F.type==="inventaire"){
    if(F.kind==="caisse"&&!estDG())return toast("Seul le DG compte la caisse");
    if(String(F.n)===""||n0(F.n)<0)return toast("Indiquez ce que vous avez compté");
    var th=theoriqueInv(F.kind),c=n0(F.n);
    if(!ecrire(auj(),"inv",uid(),{date:auj(),type:F.kind,compte:c,theorique:th,note:F.note||""}))return;
    var e=c-th,t=INV[F.kind];
    V.F={type:"ok",msg:estDG()?(e===0?"Comptage conforme : "+nb(c)+" "+t[1]+".":"Compté : "+nb(c)+" "+t[1]+", attendu : "+nb(th)+".<br><b class=\"rouge\">Écart : "+signe(e)+" "+t[1]+(F.kind==="caisse"?"":" ("+gnf(valeurEcart(F.kind,e))+")")+"</b>"):"Comptage enregistré : "+nb(c)+" "+t[1]+"."};
    vibrer();rendre();return;
  }
  if(F.type==="ouverture"){
    if(!estDG())return toast("Réservé au DG");
    if(String(F.sacs)===""||String(F.n)==="")return toast("Indiquez les sacs et l'argent, même 0");
    /* Le DG compte ce qui est là MAINTENANT ; l'application retire ce qui a été saisi depuis le démarrage
       pour retrouver ce qui existait avant le premier jour. */
    var Ro=D.reglages;Ro.ouvAlv=0;Ro.ouvSacs=0;Ro.ouvCaisse=0;
    var sansA=Math.floor(stockOeufs(auj())/Ro.oeufsAlv),sansS=stockAliment(auj()),sansC=caisseTheorique();
    Ro.ouvDate=Ro.ouvDate||auj();Ro.ouvAlv=Math.max(0,Math.round(n0(F.alv)-sansA));Ro.ouvSacs=Math.max(0,n0(F.sacs)-sansS);Ro.ouvCaisse=Math.max(0,Math.round(n0(F.n)-sansC));

    var invOuv=[["alveoles",n0(F.alv),Ro.ouvAlv+sansA],["aliment",n0(F.sacs),Ro.ouvSacs+sansS],["caisse",n0(F.n),Ro.ouvCaisse+sansC]];
    ecrireConfig();
    /* Si on a compté MOINS que ce qui a été saisi depuis le démarrage, le départ reste à 0 et l'écart est gardé comme un comptage */
    invOuv.forEach(function(x){
      ecrire(auj(),"inv",uid(),{date:auj(),type:x[0],compte:x[1],theorique:Math.max(x[2],0),note:"Inventaire d'ouverture"})});
    Ro=D.reglages;
    V.F={type:"ok",msg:"Inventaire enregistré.<br>Il y avait au démarrage : "+nb(Ro.ouvAlv)+" alvéoles, "+nb(Ro.ouvSacs)+" sacs, "+gnf(Ro.ouvCaisse)+" chez le commercial.<br>Les contrôles partent maintenant de là."};vibrer();rendre();return;
  }
  if(F.type==="reception"){
    var a=D.alimIn.find(function(x){return x.id===F.achat});if(!a)return toast("Achat introuvable");
    if(String(F.n)===""||n0(F.n)<0)return toast("Indiquez les sacs arrivés");
    if(!ecrire(a.date,"alimIn",a.id,{_rpc:"confirmer_reception",args:{p_id:a.id,p_sacs:n0(F.n)}}))return;
    var m=n0(F.n)-n0(a.sacs);
    V.F={type:"ok",msg:m===0?"Réception confirmée : "+nb(F.n)+" sacs, comme payé.":"Réception confirmée : "+nb(F.n)+" sacs pour "+nb(a.sacs)+" payés.<br><b class=\"rouge\">Il manque "+nb(-m)+" sac"+(-m>1?"s":"")+". Le DG est prévenu.</b>"};
    vibrer();rendre();return;
  }
}
function boutonInv(t,lib){var L=dernierInv(t),j=L?joursDepuis(L.date):null,late=j==null||j>7;
  return '<button class="ctrl-inv'+(late?" en-retard":"")+'" data-act="ouvrirInv" data-v="'+t+'"><span class="rub-ic">'+IC[INV[t][2]]+'</span><span class="x"><b>'+lib+'</b><small>'+(L?"Dernier comptage : "+dateCourte(L.date):"Jamais compté")+(late&&t!=="caisse"?" · à faire":"")+'</small></span><span class="fl">Compter</span></button>'}
/* Chez le technicien : sacs à confirmer et comptages de la semaine */
function blocControleTech(){
  var h='',R=receptionsAttente();
  R.forEach(function(a){h+='<div class="alerte"><b>Aliment acheté '+quand(a.date)+' : '+nb(a.sacs)+' sacs.</b> Comptez les sacs arrivés au magasin. <button class="btn petit" style="margin-top:8px" data-act="ouvrirRecep" data-id="'+a.id+'">Confirmer la réception</button></div>'});
  h+='<h2 class="sec-titre c-elev">Comptage de la semaine</h2><div class="ctrl-invs">'+boutonInv("alveoles","Compter les alvéoles")+boutonInv("aliment","Compter les sacs d'aliment")+'</div>';
  return h;
}
/* ---------- Signaux d'alerte d'un comptable (30 derniers jours) ---------- */
function signaux(){
  var R=D.reglages,deb=decal(auj(),-30),S=[],dans=function(x){return x.date>=deb};
  /* Inventaires */
  ["alveoles","aliment","caisse"].forEach(function(t){var L=dernierInv(t),T=INV[t];
    if(!L){if(t!=="caisse")S.push({n:1,t:"<b>"+T[0]+"</b> : jamais comptés. Faites un comptage réel."});return}
    if(L.theorique!=null&&D.reglages.ouvDate){var e=L.compte-L.theorique;if(Math.abs(e)>=(t==="caisse"?1000:1))S.push({n:e<0?2:1,t:"<b>"+T[0]+"</b> "+quand(L.date)+" : compté "+nb(L.compte)+", attendu "+nb(L.theorique)+" → écart <b>"+signe(e)+" "+T[1]+"</b>"+(t==="caisse"?"":" ("+gnf(valeurEcart(t,e))+")")+"."})}
    if(t!=="caisse"&&joursDepuis(L.date)>7)S.push({n:1,t:"<b>"+T[0]+"</b> : dernier comptage il y a "+joursDepuis(L.date)+" jours. Il en faut un par semaine."});
  });
  /* Réception de l'aliment */
  D.alimIn.forEach(function(a){
    if(a.sacsRecus==null){if(joursDepuis(a.date)>=2)S.push({n:1,t:"Achat d'aliment "+quand(a.date)+" ("+nb(a.sacs)+" sacs) : réception pas encore confirmée par le technicien."})}
    else if(a.sacsRecus<a.sacs)S.push({n:2,t:"Achat d'aliment "+quand(a.date)+" : <b>"+nb(a.sacs)+" sacs payés, "+nb(a.sacsRecus)+" reçus</b> → "+gnf((a.sacs-a.sacsRecus)*(a.montant/a.sacs||R.prixSac))+" perdus."});
    if(dans(a)&&a.sacs>0&&a.montant/a.sacs>R.prixSac*1.05)S.push({n:1,t:"Aliment acheté "+quand(a.date)+" à <b>"+gnf(a.montant/a.sacs)+" le sac</b>, plus cher que la référence ("+gnf(R.prixSac)+")."});
  });
  /* Poules : dernier comptage comparé au calcul */
  R.comps.forEach(function(c){var E=ecartComptage(c.id);if(E&&dans(E.k)&&Math.abs(E.ecart)>Math.max(10,E.theorique*0.01))S.push({n:E.ecart<0?2:1,t:"<b>"+c.nom+"</b> compté "+quand(E.k.date)+" : "+nb(E.k.n)+" poules, le calcul en attendait "+nb(E.theorique)+" → <b>"+signe(E.ecart)+"</b> sans mort ni sortie saisie."})});
  /* Ventes sous le prix */
  var bas=D.ventes.filter(function(v){return dans(v)&&v.prix<R.prix});
  if(bas.length)S.push({n:1,t:"<b>"+bas.length+" vente"+(bas.length>1?"s":"")+" sous le prix de "+nb(R.prix)+"</b> : "+bas.slice(0,3).map(function(v){return esc(v.client)+" ("+nb(v.prix)+")"}).join(", ")+(bas.length>3?"…":"")+". Manque à gagner : "+gnf(somme(bas,function(v){return (R.prix-v.prix)*v.alv}))+"."});
  /* Casses */
  var oe=0,ca=0;D.prod.forEach(function(p){if(dans(p)){oe+=n0(p.oeufs);ca+=n0(p.casses)}});
  if(oe>0&&ca/oe>0.03)S.push({n:1,t:"<b>"+pct(ca/oe)+" d'œufs cassés</b> sur 30 jours (normal : moins de 3 %). Les « casses » peuvent cacher des ventes."});
  /* Crédits anciens */
  var vieux=D.ventes.filter(function(v){return venteReste(v)>0&&joursDepuis(v.date)>30});
  if(vieux.length)S.push({n:1,t:"<b>"+vieux.length+" crédit"+(vieux.length>1?"s":"")+" de plus de 30 jours</b> : "+gnf(somme(vieux,venteReste))+" ("+vieux.slice(0,3).map(function(v){return esc(v.client)}).join(", ")+")."});
  /* Dépenses sans reçu et inhabituelles */
  var dep=D.dep.filter(function(x){return dans(x)&&!x.auto}),sans=dep.filter(function(x){return !x.recu});
  if(sans.length)S.push({n:1,t:"<b>"+sans.length+" dépense"+(sans.length>1?"s":"")+" sans reçu</b> : "+gnf(somme(sans,function(x){return x.montant}))+"."});
  var parCat={};D.dep.forEach(function(x){if(x.auto)return;(parCat[x.cat]=parCat[x.cat]||[]).push(n0(x.montant))});
  dep.forEach(function(x){var L=parCat[x.cat]||[];if(L.length<4)return;var moy=L.reduce(function(a,b){return a+b},0)/L.length;if(x.montant>2*moy)S.push({n:1,t:"Dépense inhabituelle "+quand(x.date)+" : <b>"+esc(x.cat)+" "+gnf(x.montant)+"</b> (plus de 2 fois la moyenne de "+gnf(moy)+")."})});
  /* Versements en retard */
  try{var nv=cyclesNonVerses();if(nv.length)S.push({n:2,t:"<b>"+nv.length+" versement"+(nv.length>1?"s":"")+" en retard</b> : "+gnf(somme(nv,function(c){return calcCycle(c).reste}))+" restent chez le commercial."})}catch(e){}
  return S.sort(function(a,b){return b.n-a.n});
}
/* ---------- Le mois en chiffres ---------- */
function chiffresMois(d){
  var R=D.reglages,deb=d.slice(0,8)+"01",fin=d,jours=[],j=deb;while(j<=fin){jours.push(j);j=decal(j,1)}
  var alv=0,oeufs=0,sacs=0,mo=0;jours.forEach(function(x){var o=oeufsJour(null,x);oeufs+=o;alv+=alvDe(o,cassesJour(null,x));sacs+=alimJour(null,x);mo+=morts(null,x)});
  var dans=function(x){return x.date>=deb&&x.date<=fin},dep=somme(D.dep.filter(dans),function(x){return x.montant}),ventes=somme(D.ventes.filter(dans),venteTotal);
  var p0=effectifTotal(decal(deb,-1))||effectifTotal(deb)||n0(R.poulesRef);
  return {deb:deb,alv:alv,dep:dep,ventes:ventes,benef:ventes-dep,cout:alv>0?dep/alv:NaN,ic:oeufs>0?(sacs*n0(R.kgSac))/(oeufs*0.06):NaN,mort:p0>0?mo/p0:NaN,mo:mo,sacs:sacs};
}
function sectionsComptable(d){
  var R=D.reglages,h='',S=signaux();
  if(estDG())h+=blocOuverture();
  h+='<h3 class="sous-t">Comptages réels</h3><div class="ctrl-invs">'+(estDG()?boutonInv("caisse","Compter l'argent du commercial"):"")+boutonInv("alveoles","Compter les alvéoles")+boutonInv("aliment","Compter les sacs d'aliment")+'</div>';
  h+='<p class="aide">Attendu maintenant : '+nb(stockAlv(auj()))+' alvéoles, '+nb(stockAliment(auj()))+' sacs, '+gnf(caisseTheorique())+' chez le commercial.</p>';
  var R2=receptionsAttente();if(R2.length)h+='<div class="ctrl-pt ctrl-att">'+IC.aliment+'<span><b>'+R2.length+' achat'+(R2.length>1?"s":"")+' d\'aliment</b> à confirmer par le technicien. <button class="lien" data-act="ouvrirRecep" data-id="'+R2[0].id+'">Confirmer moi-même</button></span></div>';
  h+='<h3 class="sous-t">Signaux d\'alerte · 30 derniers jours</h3>';
  if(!S.length)h+='<div class="ctrl-pt ctrl-ok">'+IC.ok+'<span>Aucun signal d\'alerte.</span></div>';
  else S.forEach(function(p){h+='<div class="ctrl-pt ctrl-'+(p.n===2?"alr":"att")+'">'+IC.alerte+'<span>'+p.t+'</span></div>'});
  var M=chiffresMois(d),icE=isFinite(M.ic)?(M.ic>2.6?2:M.ic>2.4?1:0):0;
  h+='<h3 class="sous-t">Le mois de '+nomMois(M.deb)+'</h3><div class="ctrl-kpis">'+
    kCtrl(isFinite(M.cout)?gnf(M.cout):"–","Coût d'une alvéole","toutes dépenses · vendue "+nb(R.prix),isFinite(M.cout)&&M.cout>R.prix?2:0)+
    kCtrl(gnf(M.benef),"Bénéfice du mois","ventes − dépenses",M.benef<0?2:0)+
    kCtrl(isFinite(M.ic)?nb(Math.round(M.ic*100)/100):"–","Indice de consommation","kg d'aliment pour 1 kg d'œufs · normal 2,1 à 2,4",icE)+
    kCtrl(isFinite(M.mort)?(Math.round(M.mort*1000)/10).toLocaleString("fr-FR")+" %":"–","Mortalité du mois",nb(M.mo)+" poules · normal : moins de 1 %",isFinite(M.mort)&&M.mort>0.01?1:0)+'</div>';
  return {html:h,n:S.length,etat:S.some(function(p){return p.n===2})?2:S.length?1:0};
}
var CSS_CTRL2=1;

function quand(d){return d===auj()?"aujourd'hui":d===decal(auj(),-1)?"hier":"le "+dateCourte(d)}

/* ---------- Menus qui clignotent chez le DG ----------
   « Aujourd'hui » clignote toujours ; « Dépenses » clignote dès qu'une dépense arrive,
   jusqu'à ce que le DG ouvre le menu Dépenses sur ce téléphone. */
var CLE_DEP_VU="fermeKonate.depVu";
function depNonVues(){var vu=n0(lireLS(CLE_DEP_VU,0));return D.dep.filter(function(x){return n0(x.t)>vu}).length}
/* « Aujourd'hui » et « Dépenses » clignotent en permanence ; la pastille dit combien de dépenses sont nouvelles */
function doitClignoter(k){return k==="jour"||k==="dep"}
function majClignote(){
  if(V.ouvertP==="dep"&&depNonVues())ecrireLS(CLE_DEP_VU,Date.now());
  document.querySelectorAll(".grille-rub .rub").forEach(function(b){var k=b.getAttribute("data-v"),c=doitClignoter(k);b.classList.toggle("clignote",c);
    if(k==="dep"){var n=depNonVues(),s=b.querySelector(".rub-nouv");if(n&&!s){s=document.createElement("span");s.className="rub-nouv";b.appendChild(s)}if(s){if(n)s.textContent=n+" nouvelle"+(n>1?"s":"");else s.remove()}b.classList.toggle("a-nouv",!!n)}});
}
setInterval(majClignote,3000);

/* ---------- Inventaire d'ouverture (une fois, au démarrage) ---------- */
TITRES.ouverture="Inventaire d'ouverture";
function fOuverture(){
  return '<div class="resume">Comptez <b>maintenant</b> ce qui est vraiment là. L\'application retire elle-même ce qui a été saisi depuis le démarrage, pour retrouver le point de départ. À faire une seule fois.</div>'+
    compteur("alv","Alvéoles en stock maintenant",1,[-10,10])+compteur("sacs","Sacs d'aliment au magasin maintenant",1,[-10,10],true)+champMontant("n","Argent que le commercial a en main maintenant (GNF)")+
    '<p class="aide">Faites compter l\'argent devant vous. Ensuite, les comptages de chaque semaine montreront les écarts.</p>';
}
function blocOuverture(){
  var R=D.reglages;
  if(!R.ouvDate)return '<div class="ctrl-pt ctrl-alr">'+IC.alerte+'<span><b>Inventaire d\'ouverture à faire.</b> Sans lui, les stocks partent de zéro et les alertes de stock et de caisse sont fausses. <button class="btn petit" style="margin-top:8px" data-act="ouvrirOuv">Faire l\'inventaire d\'ouverture</button></span></div>';
  return '<p class="aide">Inventaire d\'ouverture du '+dateCourte(R.ouvDate)+' : '+nb(R.ouvAlv)+' alv., '+nb(R.ouvSacs)+' sacs, '+gnf(R.ouvCaisse)+'. <button class="lien" data-act="ouvrirOuv">Corriger</button></p>';
}

/* L'heure d'un ramassage est arrivée (et le retard n'a pas encore commencé) */
function aLHeure(d,r){if(d!==auj())return false;var h=heureRam(r);return !!h&&maintenantMin()>=minutesDe(h)}

/* ---------- Contrôle de la ponte chez le commercial ----------
   Le commercial voit seulement la ponte (pas la caisse ni les comptages) : normal, un peu bas, anormal. */
function etatPonte(p){var m=n0(D.reglages.ponteMin);return !isFinite(p)?-1:p*100>=m?0:p*100>=m-10?1:2}
var LIB_PONTE=[["ok","Normal"],["att","Un peu bas"],["alr","Anormal"]];
function pillPonte(e,encours){return encours?'<span class="ctrl-p ctrl-cours">En cours</span>':e<0?'<span class="ctrl-p ctrl-cours">–</span>':'<span class="ctrl-p ctrl-'+LIB_PONTE[e][0]+'">'+LIB_PONTE[e][1]+'</span>'}
function ponteBat(c,d){var e=effectif(c,d)||0;return e>0?oeufsJour(c,d)/e:NaN}
function blocPonteCommercial(d){
  var R=D.reglages,fait=ramFaits(d),total=NR(),fini=fait>=total||d<auj(),poules=effectifTotal(d)||n0(R.poulesRef),oe=oeufsJour(null,d),p=poules>0?oe/poules:NaN,e=etatPonte(p);
  var h='<h2 class="sec-titre c-prod">Contrôle de la ponte</h2><div class="bloc ponte-com">';
  h+='<div class="pc-haut"><div><b class="pc-v'+(!fini?" pc-neutre":e>0?" pc-"+LIB_PONTE[e][0]:"")+'">'+(isFinite(p)&&fait?Math.round(p*100)+" %":"–")+'</b><span>des poules ont pondu '+(fini?"aujourd'hui":"jusqu'ici")+'</span></div>'+pillPonte(e,!fini&&fait>0)+'</div>';
  h+='<p class="aide" style="margin:6px 0 10px">'+nb(oe)+' œufs pour '+nb(poules)+' poules · '+fait+'/'+total+' ramassages. Normal : <b>'+R.ponteMin+' % et plus</b>.'+(fini?"":" Le verdict tombe après le dernier ramassage.")+'</p>';
  h+='<div class="pc-bats">';R.comps.forEach(function(c){var pb=ponteBat(c.id,d),eb=etatPonte(pb);h+='<div class="pc-bat"><small>'+esc(c.nom)+'</small><b>'+(isFinite(pb)&&fait?Math.round(pb*100)+" %":"–")+'</b>'+(fini?pillPonte(eb):"")+'</div>'});h+='</div>';
  h+='<table class="t ctrl-7" style="margin-top:10px"><thead><tr><th>Jour</th><th>Alv.</th><th>Ponte</th><th></th></tr></thead><tbody>';
  for(var i=1;i<=7;i++){var j=decal(d,-i),o=oeufsJour(null,j),pj=effectifTotal(j)||n0(R.poulesRef),pp=pj>0&&o>0?o/pj:NaN;
    h+='<tr><td>'+dateCourte(j)+'</td><td class="n">'+(o?nb(alvDe(o,cassesJour(null,j))):"–")+'</td><td class="n">'+(isFinite(pp)?Math.round(pp*100)+" %":"–")+'</td><td>'+pillPonte(etatPonte(pp))+'</td></tr>'}
  h+='</tbody></table>';
  if(fini&&e===2)h+='<div class="ctrl-pt ctrl-alr" style="margin-top:10px">'+IC.alerte+'<span>Ponte anormale : vérifiez qu\'aucun ramassage n\'a été oublié, et prévenez le technicien (aliment, eau, poules malades).</span></div>';
  return h+'</div>';
}

/* ---------- Bandeau de la ponte, bien visible chez le DG ---------- */
function bandeauPonteDG(){
  if(!estDG())return "";
  var R=D.reglages,a=auj(),h=decal(a,-1),fait=ramFaits(a),fini=fait>=NR();
  var pj=function(d){var o=oeufsJour(null,d),p=effectifTotal(d)||n0(R.poulesRef);return p>0&&o>0?o/p:NaN};
  var pA=pj(a),pH=pj(h),eA=etatPonte(pA),eH=etatPonte(pH);
  /* Verdict mis en avant : aujourd'hui si la journée est finie, sinon hier */
  var dV=fini?a:h,pV=fini?pA:pH,eV=fini?eA:eH,cls=eV<0?"neutre":LIB_PONTE[eV][0];
  var titre=eV<0?"Ponte : pas encore de chiffres":eV===0?"Ponte normale":eV===1?"Ponte un peu basse":"Ponte anormale";
  var h1='<div class="pdg pdg-'+cls+'" role="status"><div class="pdg-g"><span class="pdg-ic">'+IC.oeuf+'</span><div><small>'+(fini?"Aujourd'hui":"Hier")+' · '+dComplete(dV)+'</small><b>'+titre+'</b></div><span class="pdg-v">'+(isFinite(pV)?Math.round(pV*100)+" %":"–")+'</span></div>';
  h1+='<p>Normal : '+R.ponteMin+' % et plus.'+(eV===2?" <b>Vérifiez les ramassages, l'aliment, l'eau et les poules malades.</b>":eV===1?" À surveiller dans les prochains jours.":"")+'</p>';
  if(!fini)h1+='<div class="pdg-auj">Aujourd\'hui, en cours : <b>'+(isFinite(pA)&&fait?Math.round(pA*100)+" %":"–")+'</b> · '+fait+'/'+NR()+' ramassages</div>';
  return h1+'</div>';
}
