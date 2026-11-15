// Ferme avicole de M. Konaté — connexion par code et gestion de l'équipe par le DG.
// Cette fonction vérifie elle-même l'identité de l'appelant (pas de JWT imposé à l'entrée,
// car l'écran de connexion doit pouvoir l'appeler avant toute connexion).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const URL_PROJET = Deno.env.get("SUPABASE_URL")!;
const CLE_SERVEUR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SANS_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const rep = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...cors, "Content-Type": "application/json" } });

const serveur = () => createClient(URL_PROJET, CLE_SERVEUR, SANS_SESSION);

// Le vrai mot de passe = empreinte (secret du serveur + identifiant + code). Le code seul ne sert à rien hors de cette fonction.
async function motDePasse(secret: string, id: string, code: string): Promise<string> {
  const enc = new TextEncoder();
  const cle = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cle, enc.encode(`${id}:${code}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function codeValide(code: unknown): string | null {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return "Le code doit avoir 6 chiffres.";
  if (/^(\d)\1{5}$/.test(code) || code === "123456" || code === "654321") return "Ce code est trop facile à deviner.";
  return null;
}
function nomValide(nom: unknown): string | null {
  if (typeof nom !== "string") return null;
  const n = nom.trim().replace(/\s+/g, " ");
  return n.length >= 2 && n.length <= 40 ? n : null;
}
const estUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function creerCompte(db: SupabaseClient, nom: string, role: string, code: string) {
  const email = `u-${crypto.randomUUID()}@ferme-konate.app`;
  const { data, error } = await db.auth.admin.createUser({ email, password: crypto.randomUUID() + crypto.randomUUID(), email_confirm: true });
  if (error || !data.user) throw new Error("Création du compte impossible.");
  const id = data.user.id;
  try {
    const { data: secret, error: e1 } = await db.rpc("connexion_secret");
    if (e1 || !secret) throw new Error("secret");
    const { error: e2 } = await db.auth.admin.updateUserById(id, { password: await motDePasse(secret, id, code) });
    if (e2) throw new Error("mot de passe");
    const { error: e3 } = await db.from("profils").insert({ id, nom, role });
    if (e3) throw new Error("profil");
  } catch (_e) {
    await db.auth.admin.deleteUser(id);
    throw new Error("Création du compte impossible.");
  }
  return id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return rep({ erreur: "Méthode refusée." }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return rep({ erreur: "Demande invalide." }, 400); }
  const db = serveur();
  const action = b.action;

  try {
    // ---------- Écran d'entrée : qui êtes-vous ? ----------
    if (action === "liste") {
      const { data, error } = await db.rpc("connexion_liste");
      if (error) return rep({ erreur: "Service indisponible." }, 500);
      return rep(data);
    }

    // ---------- Entrer avec son code ----------
    if (action === "entrer") {
      if (!estUuid(b.id) || typeof b.code !== "string" || !/^\d{6}$/.test(b.code)) return rep({ erreur: "Code incorrect." }, 401);
      const { data: v, error } = await db.rpc("connexion_verifier", { p_id: b.id });
      if (error) return rep({ erreur: "Service indisponible." }, 500);
      if (v.etat === "bloque") return rep({ erreur: "Accès bloqué par le DG.", bloque: true }, 403);
      if (v.etat === "attendre") return rep({ erreur: "Trop d'essais. Réessayez plus tard.", secondes: v.secondes }, 429);
      if (v.etat !== "ok" || !v.email) return rep({ erreur: "Code incorrect." }, 401);
      const essai = createClient(URL_PROJET, CLE_SERVEUR, SANS_SESSION);
      const { data: s, error: e } = await essai.auth.signInWithPassword({ email: v.email, password: await motDePasse(v.secret, b.id, b.code) });
      if (e || !s.session) {
        const { data: r } = await db.rpc("connexion_resultat", { p_id: b.id, p_ok: false });
        if (r && r.restant === 0) return rep({ erreur: "Trop d'essais. Réessayez dans 15 minutes.", secondes: r.secondes }, 429);
        return rep({ erreur: "Code incorrect.", restant: r?.restant ?? null }, 401);
      }
      await db.rpc("connexion_resultat", { p_id: b.id, p_ok: true });
      const { data: p } = await db.from("profils").select("id, nom, role, code_a_changer").eq("id", b.id).single();
      return rep({ session: { access_token: s.session.access_token, refresh_token: s.session.refresh_token, expires_at: s.session.expires_at }, profil: p });
    }

    // ---------- Première mise en service : créer le DG (possible une seule fois) ----------
    if (action === "initialiser") {
      const { count } = await db.from("profils").select("id", { count: "exact", head: true }).eq("role", "dg");
      if ((count ?? 1) > 0) return rep({ erreur: "Déjà initialisé." }, 403);
      const nom = nomValide(b.nom); const ec = codeValide(b.code);
      if (!nom) return rep({ erreur: "Nom invalide." }, 400);
      if (ec) return rep({ erreur: ec }, 400);
      const id = await creerCompte(db, nom, "dg", b.code as string);
      await db.from("journal_audit").insert({ qui: id, table_nom: "profils", ligne_id: id, action: "creation_dg", apres: { nom } });
      return rep({ ok: true, id });
    }

    // ---------- Tout le reste est réservé au DG ----------
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jeton) return rep({ erreur: "Connexion requise." }, 401);
    const { data: u, error: eu } = await db.auth.getUser(jeton);
    if (eu || !u.user) return rep({ erreur: "Connexion requise." }, 401);
    const { data: moi } = await db.from("profils").select("id, role, bloque, retire").eq("id", u.user.id).maybeSingle();
    if (!moi || moi.role !== "dg" || moi.bloque || moi.retire) return rep({ erreur: "Réservé au DG." }, 403);
    // Client qui agit au nom du DG : les règles de la base et le journal d'audit s'appliquent
    const dg = createClient(URL_PROJET, CLE_SERVEUR, { ...SANS_SESSION, global: { headers: { Authorization: `Bearer ${jeton}` } } });
    const trace = (ligne: string, act: string, apres: unknown) =>
      db.from("journal_audit").insert({ qui: moi.id, table_nom: "profils", ligne_id: ligne, action: act, apres });

    if (action === "ajouter") {
      const nom = nomValide(b.nom); const ec = codeValide(b.code);
      if (!nom) return rep({ erreur: "Indiquez le nom (2 à 40 lettres)." }, 400);
      if (b.role !== "commercial" && b.role !== "technicien") return rep({ erreur: "Rôle invalide." }, 400);
      if (ec) return rep({ erreur: ec }, 400);
      const { count } = await db.from("profils").select("id", { count: "exact", head: true }).eq("retire", false);
      if ((count ?? 0) >= 30) return rep({ erreur: "Trop de personnes dans l'équipe." }, 400);
      const id = await creerCompte(db, nom, b.role, b.code as string);
      await trace(id, "ajout", { nom, role: b.role });
      return rep({ ok: true, id });
    }

    if (!estUuid(b.id)) return rep({ erreur: "Personne inconnue." }, 400);
    const { data: cible } = await db.from("profils").select("id, nom, role, retire").eq("id", b.id).maybeSingle();
    if (!cible || cible.retire) return rep({ erreur: "Personne inconnue." }, 404);

    if (action === "changer_code") {
      const ec = codeValide(b.code);
      if (ec) return rep({ erreur: ec }, 400);
      const { data: secret } = await db.rpc("connexion_secret");
      const { error } = await db.auth.admin.updateUserById(cible.id, { password: await motDePasse(secret, cible.id, b.code as string) });
      if (error) return rep({ erreur: "Changement du code impossible." }, 500);
      await db.rpc("connexion_resultat", { p_id: cible.id, p_ok: true });
      // Le DG a choisi lui-même son code : il n'a plus à le changer
      if (cible.id === moi.id) await db.from("profils").update({ code_a_changer: false }).eq("id", moi.id);
      await trace(cible.id, "changement_code", { nom: cible.nom });
      return rep({ ok: true });
    }

    if (cible.role === "dg") return rep({ erreur: "Le DG ne peut pas être bloqué ni retiré." }, 400);

    if (action === "bloquer") {
      const bloque = b.bloque !== false;
      const { error } = await dg.from("profils").update({ bloque }).eq("id", cible.id);
      if (error) return rep({ erreur: "Action impossible." }, 500);
      await db.auth.admin.updateUserById(cible.id, { ban_duration: bloque ? "876000h" : "none" });
      return rep({ ok: true, bloque });
    }

    if (action === "retirer") {
      const { error } = await dg.from("profils").update({ retire: true, bloque: true }).eq("id", cible.id);
      if (error) return rep({ erreur: "Action impossible." }, 500);
      await db.auth.admin.updateUserById(cible.id, { ban_duration: "876000h" });
      return rep({ ok: true });
    }

    return rep({ erreur: "Action inconnue." }, 400);
  } catch (e) {
    return rep({ erreur: e instanceof Error ? e.message : "Erreur du serveur." }, 500);
  }
});
