import re,base64,sys
s=open('ref.html',encoding='utf-8').read()
# photo -> fichier
m=re.search(r'var PHOTO="(data:image/jpeg;base64,([A-Za-z0-9+/=]+))"',s)
open('dist/ferme.jpg','wb').write(base64.b64decode(m.group(2)))
s=s.replace(m.group(0),'var PHOTO="ferme.jpg"')
i=s.index('<script>');j=s.index('</script>',i)
head=s[:i];js=s[i+8:j];tail=s[j+9:]
def rep(a,b,n=1):
    global js
    c=js.count(a)
    if c!=n: sys.exit("ANCRE %r trouvée %d fois"%(a[:70],c))
    js=js.replace(a,b)
def coupe(debut,fin,b,incl_fin=True):
    global js
    a=js.index(debut);z=js.index(fin,a)+(len(fin) if incl_fin else 0)
    js=js[:a]+b+js[z:]
donnees=open('src/donnees.js',encoding='utf-8').read()
coupe('/* =====================================================================\n   DONNÉES','window.addEventListener("online",function(){vider()});',donnees)
rep('function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}',
 'function uid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=Array.prototype.map.call(b,function(x){return (x+256).toString(16).slice(1)}).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)}')
a=js.index('function moi(){');z=js.index('\n',js.index('function estDG(){'))
js=js[:a]+'function moi(){if(!PROFIL||!D)return null;var u=D.users.find(function(x){return x.id===PROFIL.id});if(u)return u.bloque?null:u;return {id:PROFIL.id,nom:PROFIL.nom,role:ROLE_APP[PROFIL.role]||"gest"}}\n/* Seul le DG gère l\'équipe et les réglages */\nfunction estDG(){var u=moi();return !!u&&u.role==="proprio"}'+js[z:]
# statut
rep("""  if(ETAT.refus)return '<span class="statut"><span class="point orange"></span>Saisies non envoyées</span>';\n""","""  if(!ETAT.recu&&!STATE.charge)return '<span class="statut"><span class="point orange"></span>Connexion…</span>';\n""")
rep('var b=document.getElementById("bandeauRefus");if(b)b.style.display=ETAT.refus?"":"none"}','majBandeaux()}')
# rendu
rep("if(!u){app.innerHTML=vueConnexion();return}","if(!u){app.innerHTML=vueConnexion();return}\n  if(PROFIL&&PROFIL.code_a_changer&&u.role===\"proprio\"){app.innerHTML=vueNouveauCode();return}")
rep('if(V.page==="reglages"&&u.id==="proprio")','if(V.page==="reglages"&&u.role==="proprio")')
rep('if(u.id==="proprio"&&V.page!=="reglages")','if(u.role==="proprio"&&V.page!=="reglages")')
a=js.index('<div class="bandeau" id="bandeauRefus"');z=js.index("</div>'+corps",a)
js=js[:a]+'<div id="bandeaux">\'+bandeauxTelephone()+\''+js[z:]
coupe('/* ---------- Connexion ---------- */','/* ---------- Aides communes ---------- */','',incl_fin=False)
rep('function peutAnnuler(it){var u=moi();if(!u)return false;if(u.role==="proprio")return true;return it.x.par===u.nom&&it.x.date===auj()}',
    'function peutAnnuler(it){var u=moi();if(!u)return false;if(u.role==="proprio")return true;return it.x.parId===u.id&&it.x.date===auj()}')
# équipe
a=js.index('  if(s==="equipe"){');z=js.index('  if(s==="saisies")',a)
js=js[:a]+'  if(s==="equipe")h+=vueEquipe();\n'+js[z:]
rep('function ligneDate(){return bandeauDate()}','')
rep('comp:c||(type==="vaccin"?"TOUS":"B1C1")','comp:c||(type==="vaccin"?"TOUS":"B1")')
rep('if(type==="codeUser"){F.uid=id;F.pin=""}','if(type==="codeUser"){F.uid=id;F.pin=(PROFIL&&id===PROFIL.id)?"":codeAuHasard()}')
a=js.index('/* Envoie la photo (stockage de l');z=js.index('\n',js.index('function srcRecu(x){',a))
js=js[:a]+js[z:]
# feuille code
a=js.index('function fCodeUser(){');z=js.index('\n',js.index('\n',a)+1)
js=js[:a]+'''function fCodeUser(){var u=D.users.find(function(x){return x.id===V.F.uid});if(!u)return '';var soi=PROFIL&&u.id===PROFIL.id;
  return '<div class="resume">Nouveau code pour <b>'+esc(u.nom)+'</b></div><div class="champ"><label for="cU">Code secret (6 chiffres)</label><input id="cU" data-k="pin" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" autocomplete="off" value="'+esc(V.F.pin)+'" style="font-size:32px;letter-spacing:10px;text-align:center"></div><p class="aide">'+(soi?"Ne donnez ce code à personne.":"Notez ce code et donnez-le à "+esc(u.nom)+" en main propre. L\\'ancien code ne marchera plus.")+'</p>'}'''+js[z:]
# valider
rep('  var F=V.F,R=D.reglages,suite=null,msg="",ok=true;\n  F.date=auj();','  var F=V.F,R=D.reglages,suite=null,msg="",ok=true;\n  if(!(estDG()&&F.changerDate&&F.date&&F.date<=auj()))F.date=auj();')
rep('''    remplacer("prod",F.date,"p_"+F.comp+"_"+F.r,function(x){return x.comp===F.comp&&x.r===F.r});
    ok=ecrire(F.date,"prod","p_"+F.comp+"_"+F.r,{date:F.date,comp:F.comp,r:F.r,oeufs:tot,casses:n0(F.casses)});''',
'''    var exP=D.prod.find(function(x){return x.date===F.date&&x.comp===F.comp&&x.r===F.r});
    ok=ecrire(F.date,"prod",exP?exP.id:uid(),{date:F.date,comp:F.comp,r:F.r,alv:n0(F.alv),plus:n0(F.plus),casses:n0(F.casses)});''')
rep('''    remplacer("mouv",F.date,"mort_"+F.comp,function(x){return x.type==="mort"&&x.comp===F.comp});
    ok=ecrire(F.date,"mouv","mort_"+F.comp,''','''    var exM=D.mouv.find(function(x){return x.type==="mort"&&x.comp===F.comp&&x.date===F.date});
    ok=ecrire(F.date,"mouv",exM?exM.id:uid(),''')
rep('''    remplacer("alimOut",F.date,"alim_"+F.comp,function(x){return x.comp===F.comp});
    ok=ecrire(F.date,"alimOut","alim_"+F.comp,''','''    var exA=D.alimOut.find(function(x){return x.comp===F.comp&&x.date===F.date});
    ok=ecrire(F.date,"alimOut",exA?exA.id:uid(),''')
rep('ecrire(F.date,"dep","dep_"+aid,','ecrire(F.date,"dep",uid(),')
a=js.index('  else if(F.type==="codeUser"){');z=js.index('ok=true}',a)+len('ok=true}')
js=js[:a]+'''  else if(F.type==="codeUser"){if(!estDG())return toast("Seul le DG peut changer les codes");var uc=D.users.find(function(x){return x.id===F.uid}),pc=String(F.pin||"").replace(/\\s/g,"");
    if(!/^\\d{6}$/.test(pc))return toast("Le code doit avoir 6 chiffres");if(codeFaible(pc))return toast("Ce code est trop facile à deviner");
    var soi=PROFIL&&uc.id===PROFIL.id;
    actionEquipe("changer_code",{id:uc.id,code:pc},"",function(){V.F={type:"ok",msg:soi?"Votre code est changé. Ne le donnez à personne.":"Nouveau code de "+esc(uc.nom)+" : <b style=\\"font-size:26px;letter-spacing:3px\\">"+codeLisible(pc)+"</b><br>Donnez-le-lui en main propre."};rendre()});return}'''+js[z:]
# actions
a=js.index('  else if(a==="pin"){');z=js.index('  else if(a==="sortir")',a)
js=js[:a]+'''  else if(a==="pin"){if(V.attente)return;if(V.pin.length<6)V.pin+=v;V.erreurPin="";
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
'''+js[z:]
rep('''  else if(a==="sortir"){try{localStorage.removeItem(CLE_SESSION)}catch(x){}V.choixUser=null;V.page="accueil";rendre();window.scrollTo(0,0)}''','''  else if(a==="sortir"){sortir()}''')
a=js.index('  else if(a==="aucuneMorte"){var F=V.F;remplacer(');z=js.index('return;',a)+len('return;')
js=js[:a]+'''  else if(a==="aucuneMorte"){var F=V.F;if(!(estDG()&&F.changerDate&&F.date&&F.date<=auj()))F.date=auj();var exM2=D.mouv.find(function(x){return x.type==="mort"&&x.comp===F.comp&&x.date===F.date});if(!ecrire(F.date,"mouv",exM2?exM2.id:uid(),{date:F.date,comp:F.comp,type:"mort",n:0,note:""}))return;'''+js[z:]
a=js.index('  else if(a==="bloquer"){');z=js.index('\n',js.index('  else if(a==="supprUser"){',a))
js=js[:a]+'''  else if(a==="bloquer"){if(!estDG())return;var ub=D.users.find(function(x){return x.id===b.getAttribute("data-id")});if(!ub||ub.role==="proprio")return;
    if(!ub.bloque&&!confirm("Bloquer "+ub.nom+" ? Il sera sorti de l'application tout de suite."))return;var nb2=!ub.bloque;actionEquipe("bloquer",{id:ub.id,bloque:nb2},ub.nom+(nb2?" est bloqué":" est débloqué"))}
  else if(a==="supprUser"){if(!estDG())return;var ur=D.users.find(function(x){return x.id===b.getAttribute("data-id")});if(!ur||ur.role==="proprio")return;if(!confirm("Retirer "+ur.nom+" de l'équipe ? Ses saisies restent enregistrées."))return;actionEquipe("retirer",{id:ur.id},ur.nom+" est retiré de l'équipe")}'''+js[z:]
rep('''else if(a==="copierSauv"){copier(JSON.stringify(STATE),"Sauvegarde copiée")}''','''else if(a==="copierSauv"){copier(JSON.stringify(STATE.rows),"Sauvegarde copiée")}''')
# formulaires
a=js.index('  if(type==="user"){');z=js.index('  if(type==="ferme"){',a)
js=js[:a]+'''  if(type==="user"){if(!estDG())return toast("Seul le DG peut ajouter une personne");var cp=g("pin").replace(/\\s/g,""),nm=g("nom"),rl=g("role")||"com";
    if(nm.length<2)return toast("Indiquez le nom");if(!/^\\d{6}$/.test(cp))return toast("Le code doit avoir 6 chiffres");if(codeFaible(cp))return toast("Ce code est trop facile à deviner");
    actionEquipe("ajouter",{nom:nm,role:ROLE_BASE[rl],code:cp},"",function(){V.viderAjout=true;V.viderNom=true;V.F={type:"ok",msg:esc(nm)+" est ajouté comme "+ROLES[rl].toLowerCase()+".<br>Son code : <b style=\\"font-size:26px;letter-spacing:3px\\">"+codeLisible(cp)+"</b><br>Donnez-le-lui en main propre."};rendre()});return}
'''+js[z:]
rep("""  if(type==="ferme"){var R=D.reglages;""","""  if(type==="ferme"){if(!estDG())return;var R=D.reglages;""")
rep("  h+=carteAction(actionTechnicien(d));\n","  h+=carteAction(actionTechnicien(d))+rappelsVaccins(d);\n")
import sys as _s;_s.path.insert(0,'src');import brancher_controle as _bc;_bc.appliquer(rep)
# fin
extra=open('src/acces.js',encoding='utf-8').read()+'\n'+open('src/telephone.js',encoding='utf-8').read()+'\n'+open('src/controle.js',encoding='utf-8').read()
rep('construireD();rendre();demarrerPartage();',extra+'\nconstruireD();rendre();demarrerPartage();')
assert 'remplacer(' not in js.replace('function remplacer(',''), 'remplacer encore utilisé'
open('dist/app.js','w',encoding='utf-8').write('"use strict";\n'+js.replace('"use strict";','',1))
# HTML
css_add='''
.pin-pts{gap:12px}
.pin-msg{text-align:center;min-height:24px;margin:-6px 0 10px;font-size:15px}
.bandeau.b-action,.bandeau.b-refus{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bandeau.b-action svg,.bandeau.b-refus svg{width:22px;height:22px;flex:none}
.bandeau.b-action>span:first-of-type,.bandeau.b-refus>span:first-of-type{flex:1 1 180px}
.bandeau .b-btns{display:flex;gap:8px}
.bandeau.b-refus{background:var(--alerte-doux);color:var(--encre)}
.btn svg{width:20px;height:20px;vertical-align:-4px;margin-right:6px}
'''
head=head.replace('</style>',css_add+_bc.CSS+'</style>')
head=head.replace('<meta name="theme-color" content="#9C4A2B">','''<meta name="theme-color" content="#9C4A2B">
<meta name="description" content="Gestion et contrôle de la ferme avicole de M. Konaté, Kankan">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone-192.png">
<link rel="apple-touch-icon" href="icone-192.png">
<meta name="mobile-web-app-capable" content="yes">''')
html=head+'<script src="supabase.js"></script>\n<script src="app.js"></script>\n'+tail
open('dist/index.html','w',encoding='utf-8').write(html)
print("OK", len(js), len(html))
