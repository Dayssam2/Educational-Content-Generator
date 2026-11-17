#!/usr/bin/env python3
"""Evaluation automatique des modeles d'IA du projet (quiz, SLU, ASR, TTS, vision, images, assistant, bout en bout).

Exemples :
    python evaluation.py                          # tout (sections 1 a 8)
    python evaluation.py --sections 3,8 --whisper medium
    python evaluation.py --sections 7             # apres avoir recharge les credits Gemini
    python evaluation.py --pause 0                # compte Gemini payant
"""
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*google.generativeai.*")

import argparse
import base64
import contextlib
import difflib
import io
import json
import logging
import math
import os
import random
import re
import statistics
import sys
import time
import traceback
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
for _chemin in (str(ROOT), str(BACKEND)):
    if _chemin not in sys.path:
        sys.path.insert(0, _chemin)

os.environ["VALIDATION_IA"] = "0"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
if os.name == "nt":
    os.system("")


UTILISER_COULEURS = True
RESET, GRAS, GRIS, CYAN, JAUNE = "\033[0m", "\033[1m", "\033[90m", "\033[96m", "\033[93m"
COULEUR_NIVEAU = {
    "EXCELLENT": "\033[92m",
    "BON": "\033[32m",
    "MOYEN": "\033[33m",
    "FAIBLE": "\033[91m",
    "INFO": "\033[36m",
    "N/A": "\033[90m",
}


def col(texte, code):
    return f"{code}{texte}{RESET}" if UTILISER_COULEURS else str(texte)


def classer(valeur, seuils, plus_haut_mieux=True):
    exc, bon, moy = seuils
    if plus_haut_mieux:
        if valeur >= exc:
            return "EXCELLENT"
        if valeur >= bon:
            return "BON"
        if valeur >= moy:
            return "MOYEN"
        return "FAIBLE"
    if valeur <= exc:
        return "EXCELLENT"
    if valeur <= bon:
        return "BON"
    if valeur <= moy:
        return "MOYEN"
    return "FAIBLE"


def wilson(k, n, z=1.96):
    if not n:
        return 0.0, 0.0
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    marge = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return 100 * max(0.0, centre - marge), 100 * min(1.0, centre + marge)


class Rapport:
    def __init__(self):
        self.sections = {}
        self.courante = None
        self.debut = datetime.now()

    def section(self, numero, titre):
        self.courante = f"{numero}. {titre}"
        self.sections.setdefault(self.courante, {"metriques": [], "notes": []})
        print()
        print(col("=" * 80, GRAS))
        print(col(f" {self.courante}", GRAS))
        print(col("=" * 80, GRAS))

    def sous_titre(self, texte):
        print()
        print(col(f"--- {texte} ---", CYAN))

    def info(self, texte):
        print(col(f"  i  {texte}", GRIS))

    def alerte(self, texte):
        print(col(f"  !  {texte}", JAUNE))
        if self.courante:
            self.sections[self.courante]["notes"].append(texte)

    def metrique(self, nom, valeur, unite="", seuils=None, plus_haut_mieux=True,
                 definition="", bien="", mal="", decimales=1, n=None, ic=None):
        if valeur is None or (isinstance(valeur, float) and math.isnan(valeur)):
            niveau = "N/A"
            interpretation = "Non calculable (aucune donnee exploitable pour cette metrique)."
            valeur_txt = "N/A"
        else:
            niveau = classer(valeur, seuils, plus_haut_mieux) if seuils else "INFO"
            if isinstance(valeur, float):
                valeur_txt = f"{valeur:.{decimales}f}{unite}"
            else:
                valeur_txt = f"{valeur}{unite}"
            if ic and ic[1]:
                bas, haut = wilson(*ic)
                valeur_txt += f" [IC95 {bas:.0f}-{haut:.0f}%]"
            if niveau == "EXCELLENT":
                interpretation = "Excellent. " + bien
            elif niveau == "BON":
                interpretation = "Bon. " + bien
            elif niveau == "MOYEN":
                interpretation = "Moyen. " + mal
            elif niveau == "FAIBLE":
                interpretation = "Faible. " + mal
            else:
                interpretation = bien or ""

        seuils_txt = ""
        if seuils:
            signe = ">=" if plus_haut_mieux else "<="
            e, b, m = seuils
            seuils_txt = f"Seuils : excellent {signe} {e}{unite}, bon {signe} {b}{unite}, moyen {signe} {m}{unite}"

        nom_aff = nom + (f" (n={n})" if n is not None else "")
        print()
        print(f"  > {col(nom_aff, GRAS)} : {col(valeur_txt, GRAS)}   "
              f"{col('[' + niveau + ']', COULEUR_NIVEAU.get(niveau, ''))}")
        if definition:
            print(col(f"      Definition     : {definition}", GRIS))
        if seuils_txt:
            print(col(f"      {seuils_txt}", GRIS))
        if interpretation:
            print(f"      Interpretation : {interpretation}")

        if self.courante:
            self.sections[self.courante]["metriques"].append({
                "nom": nom,
                "valeur": valeur if not isinstance(valeur, float) else round(valeur, 4),
                "affichage": valeur_txt, "niveau": niveau, "n": n,
                "definition": definition, "seuils": seuils_txt, "interpretation": interpretation,
            })

    def tableau(self, entetes, lignes):
        largeurs = [len(str(h)) for h in entetes]
        for ligne in lignes:
            for i, v in enumerate(ligne):
                largeurs[i] = max(largeurs[i], len(str(v)))
        fmt = "  " + " | ".join("{:<" + str(w) + "}" for w in largeurs)
        print(fmt.format(*entetes))
        print("  " + "-+-".join("-" * w for w in largeurs))
        for ligne in lignes:
            print(fmt.format(*[str(v) for v in ligne]))

    def resume_final(self):
        print()
        print(col("=" * 80, GRAS))
        print(col(" RESUME GENERAL", GRAS))
        print(col("=" * 80, GRAS))
        for nom_section, contenu in self.sections.items():
            print()
            print(col(nom_section, GRAS))
            if not contenu["metriques"]:
                print(col("   (aucune metrique -- section ignoree ou en erreur, voir plus haut)", GRIS))
                continue
            for m in contenu["metriques"]:
                print(f"   - {m['nom']:<55} {m['affichage']:>24}  "
                      f"{col(m['niveau'], COULEUR_NIVEAU.get(m['niveau'], ''))}")

    def sauvegarder(self, dossier, extra):
        dossier.mkdir(parents=True, exist_ok=True)
        fichier = dossier / "rapport_evaluation.json"
        anciennes = {}
        if fichier.exists():
            try:
                anciennes = json.loads(fichier.read_text(encoding="utf-8")).get("sections", {})
            except Exception:
                anciennes = {}
        date = self.debut.isoformat(timespec="seconds")
        for contenu in self.sections.values():
            contenu["date"] = date
        nouvelles = {k: v for k, v in self.sections.items() if v["metriques"] or k not in anciennes}
        fusion = {**anciennes, **nouvelles}

        def numero(cle):
            try:
                return int(cle.split(".", 1)[0])
            except ValueError:
                return 99

        fusion = dict(sorted(fusion.items(), key=lambda kv: numero(kv[0])))
        donnees = {
            "date": date,
            "duree_secondes": round((datetime.now() - self.debut).total_seconds(), 1),
            "sections": fusion,
            **extra,
        }
        fichier.write_text(json.dumps(donnees, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

        md = ["# Rapport d'evaluation des modeles d'IA", "", f"Derniere mise a jour : {date}", ""]
        for nom_section, contenu in fusion.items():
            md += [f"## {nom_section}", ""]
            if contenu.get("date"):
                md += [f"_Mesure du {contenu['date'].replace('T', ' a ')}_", ""]
            if contenu["metriques"]:
                md += ["| Metrique | Valeur | Niveau | Interpretation |", "|---|---|---|---|"]
                for m in contenu["metriques"]:
                    nom = m["nom"] + (f" (n={m['n']})" if m["n"] is not None else "")
                    interp = (m["interpretation"] or "").replace("|", "/")
                    md.append(f"| {nom} | {m['affichage']} | {m['niveau']} | {interp} |")
                md.append("")
            for note in contenu["notes"]:
                md += [f"> {note}", ""]
        (dossier / "rapport_evaluation.md").write_text("\n".join(md), encoding="utf-8")


R = Rapport()


def moyenne(xs):
    xs = [x for x in xs if x is not None]
    return statistics.mean(xs) if xs else None


def en_ms(xs):
    m = moyenne(xs)
    return None if m is None else m * 1000


def p95(xs):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    return xs[max(0, math.ceil(0.95 * len(xs)) - 1)]


def pct(num, den):
    return 100.0 * num / den if den else None


def distance_edition(a, b):
    prec = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cour = [i]
        for j, y in enumerate(b, 1):
            cour.append(min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (x != y)))
        prec = cour
    return prec[-1]


def prf(tp, fp, fn):
    precision = tp / (tp + fp) if tp + fp else 0.0
    rappel = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * rappel / (precision + rappel) if precision + rappel else 0.0
    return precision, rappel, f1


def prf_par_classe(gold, pred, labels):
    res = {}
    for lab in labels:
        tp = sum(1 for g, p in zip(gold, pred) if g == lab and p == lab)
        fp = sum(1 for g, p in zip(gold, pred) if g != lab and p == lab)
        fn = sum(1 for g, p in zip(gold, pred) if g == lab and p != lab)
        precision, rappel, f1 = prf(tp, fp, fn)
        res[lab] = {"precision": precision, "rappel": rappel, "f1": f1, "support": tp + fn}
    return res


def lignes_prf(dico):
    return [[k, f"{v['precision']:.2f}", f"{v['rappel']:.2f}", f"{v['f1']:.2f}", v["support"]]
            for k, v in dico.items()]


def extraire_json(texte):
    if texte is None:
        return None
    t = str(texte).strip()
    t = re.sub(r"^```(?:json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    for motif in (r"\[.*\]", r"\{.*\}"):
        m = re.search(motif, t, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return None


def vrai(v):
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("true", "1", "oui", "yes", "vrai")


def capturer(fonction, *args, **kwargs):
    tampon = io.StringIO()
    niveau = logging.root.manager.disable
    logging.disable(logging.WARNING)
    try:
        with warnings.catch_warnings(), contextlib.redirect_stdout(tampon), contextlib.redirect_stderr(tampon):
            warnings.simplefilter("ignore")
            resultat = fonction(*args, **kwargs)
    finally:
        logging.disable(niveau)
    return resultat, tampon.getvalue()


def silencieux(fonction, *args, **kwargs):
    return capturer(fonction, *args, **kwargs)[0]


def moyenne_cle(notes, cle):
    vals = []
    for d in notes:
        try:
            if d.get(cle) is not None:
                vals.append(float(d[cle]))
        except (TypeError, ValueError):
            pass
    return moyenne(vals), len(vals)


def taux_cle(notes, cle):
    vals = [vrai(d.get(cle)) for d in notes if d.get(cle) is not None]
    return pct(sum(vals), len(vals)), (sum(vals), len(vals))


MESSAGE_CREDITS = ("Credits Gemini EPUISES (429 prepayment) : ce n'est pas un quota temporaire. Rechargez sur "
                   "https://ai.studio/projects puis relancez la section concernee.")


def credit_epuise(texte):
    """True si le message d'erreur indique des credits prepayes epuises (inutile de reessayer)."""
    t = str(texte).lower()
    return "prepayment" in t or "credits are depleted" in t or "depleted" in t


class Gemini:
    def __init__(self, pause):
        self.pause = pause
        self.dernier = 0.0
        self.nb_appels = 0
        self.nb_erreurs = 0
        self.attente_cumulee = 0.0
        self.generate = None
        self.original = None
        self.credits_epuises = False

    def signaler_credits(self):
        if not self.credits_epuises:
            print(col(f"  !  {MESSAGE_CREDITS}", JAUNE))
        self.credits_epuises = True

    def attendre(self):
        ecoule = time.time() - self.dernier
        if ecoule < self.pause:
            t0 = time.perf_counter()
            time.sleep(self.pause - ecoule)
            self.attente_cumulee += time.perf_counter() - t0
        self.dernier = time.time()

    def chrono(self):
        return time.perf_counter(), self.attente_cumulee

    def duree(self, depart):
        t0, a0 = depart
        return max(0.0, time.perf_counter() - t0 - (self.attente_cumulee - a0))

    def installer(self):
        try:
            import services.gemini_service as gs
        except Exception as e:
            R.info(f"services.gemini_service introuvable ({e}) -- appels Gemini directs impossibles.")
            return
        if self.original is not None:
            return
        self.original = gs.generate_content

        def generate_limite(prompt, *a, **k):
            if self.credits_epuises:
                raise RuntimeError("Credits Gemini epuises : appel annule.")
            for essai in range(3):
                self.attendre()
                self.nb_appels += 1
                try:
                    return self.original(prompt, *a, **k)
                except Exception as e:
                    msg = str(e).lower()
                    if credit_epuise(msg):
                        self.nb_erreurs += 1
                        self.signaler_credits()
                        raise
                    quota = "429" in msg or "quota" in msg or "rate" in msg or "resource" in msg
                    if quota and essai < 2:
                        print(col("  !  Quota Gemini atteint (429) -- pause de 60 s puis nouvel essai...", JAUNE))
                        t0 = time.perf_counter()
                        time.sleep(60)
                        self.attente_cumulee += time.perf_counter() - t0
                        continue
                    self.nb_erreurs += 1
                    raise
            return None

        gs.generate_content = generate_limite
        self.generate = generate_limite
        self.brancher()

    def brancher(self):
        if self.generate is None:
            return
        for nom in ("quiz_engine", "pdf_quiz_engine", "assistant_engine", "validation"):
            m = sys.modules.get(nom)
            if m is not None and hasattr(m, "generate_content"):
                m.generate_content = self.generate


GEM = Gemini(pause=13)
VISION_404 = {}


def alerte_modele_vision():
    import image_analysis_service as ias
    R.alerte(f"Le modele vision '{ias.MODELE_ANALYSE}' n'est plus disponible (404). Cela casse AUSSI "
             "image_analysis_service.py dans l'application. Correction : ajoutez dans le .env la ligne "
             "GEMINI_MODEL_VISION=<modele indique par Google dans le message ci-dessus>, puis relancez.")


def appel_vision(prompt, data_uri):
    import requests
    import image_analysis_service as ias
    cle = ias._cle_api()
    if not cle:
        return None
    if GEM.credits_epuises:
        return None
    decode = ias._decoder_data_uri(data_uri)
    if decode is None:
        return None
    mime, b64 = decode
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inlineData": {"mimeType": mime, "data": b64}}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    for essai in range(3):
        GEM.attendre()
        GEM.nb_appels += 1
        try:
            r = requests.post(ias._ENDPOINT, headers={"x-goog-api-key": cle, "Content-Type": "application/json"},
                              json=payload, timeout=120)
        except Exception as e:
            print(col(f"      juge vision : erreur reseau ({e})", JAUNE))
            return None
        if r.status_code == 429:
            if credit_epuise(r.text):
                GEM.signaler_credits()
                return None
            delai = ias._delai_retry(r)
            print(col(f"      juge vision : quota 429, nouvel essai dans {delai:.0f}s ({essai + 1}/3)", JAUNE))
            time.sleep(delai)
            continue
        if r.status_code != 200:
            msg = ias._message_erreur(r) or r.text[:200]
            print(col(f"      juge vision : erreur {r.status_code} -- {msg}", JAUNE))
            if r.status_code == 404:
                VISION_404["msg"] = msg
            return None
        try:
            parts = r.json()["candidates"][0]["content"]["parts"]
            texte = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        except Exception as e:
            print(col(f"      juge vision : reponse inattendue ({e}) -- {r.text[:200]}", JAUNE))
            return None
        d = extraire_json(texte)
        if isinstance(d, list) and d and isinstance(d[0], dict):
            d = d[0]
        if not isinstance(d, dict):
            print(col(f"      juge vision : JSON illisible -- {texte[:200]}", JAUNE))
            return None
        return d
    return None


TYPES_DEMANDES = [
    ["qcm", "vrai_faux", "ouverte"],
    ["qcm", "texte_trous", "vrai_faux"],
    ["qcm", "vrai_faux", "ouverte", "texte_trous", "association"],
]
NB_QUESTIONS = [5, 8, 10]

PROMPT_JUGE_QUIZ = """Tu es inspecteur pedagogique de l'enseignement primaire tunisien, rigoureux mais juste.
Ton role est de TROUVER LES VRAIS DEFAUTS de cet examen genere automatiquement par une IA.
Verifie chaque reponse attendue toi-meme (refais les calculs, verifie la grammaire et l'orthographe arabe/francaise).
Ne signale pas de simples preferences de style : un defaut doit avoir une consequence reelle sur l'eleve ou la correction.

Matiere : <<MATIERE>> -- Niveau : <<NIVEAU>>e annee primaire -- Chapitre : <<CHAPITRE>>

EXTRAIT DU COURS OFFICIEL (reference) :
<<<
<<COURS>>
>>>

QUESTIONS (JSON) :
<<QUESTIONS>>

Pour CHAQUE question, donne un objet :
{"id": "q1",
 "exacte": true/false        (contenu scientifiquement / linguistiquement correct),
 "fidele_au_cours": true/false (porte sur des notions presentes dans l'extrait du cours),
 "correction_juste": true/false/null (la reponse attendue est correcte ; null si pas de reponse unique, ex. redaction),
 "clarte": 1-5               (enonce clair et sans ambiguite pour un enfant),
 "adaptee_niveau": 1-5       (difficulte adaptee au niveau scolaire),
 "distracteurs": 1-5 ou null (QCM seulement : plausibilite des mauvaises options),
 "gravite": "aucune" | "mineure" | "majeure",
     (majeure = reponse fausse, question ambigue avec plusieurs bonnes reponses, hors programme, erreur de langue qui change le sens ;
      mineure = formulation perfectible, sans consequence sur la note de l'eleve ; aucune = irreprochable),
 "problemes": ["liste des defauts trouves, vide si aucun"]}

Coherence obligatoire : si "exacte" ou "correction_juste" vaut false, alors "gravite" doit etre "majeure".

Reponds UNIQUEMENT avec un tableau JSON de ces objets, sans texte autour."""


def texte_question(q):
    return (q.get("question") or q.get("texte_dictee") or "").strip()


def tokeniser(texte):
    return re.findall(r"\w+", (texte or "").lower())


def extrait_aleatoire(contenu, rng, nb_mots=20):
    texte = contenu or ""
    if "NOTIONS:" in texte:
        texte = texte.split("NOTIONS:", 1)[1]
    texte = re.sub(r"(MATI[EÈ]RE|NIVEAU|TYPE|TITRE|PAGE)\s*:\s*\S*", " ", texte)
    mots = texte.split()
    if len(mots) <= nb_mots:
        return " ".join(mots)
    debut = rng.randint(0, len(mots) - nb_mots)
    return " ".join(mots[debut:debut + nb_mots])


def titres_uniques(resultats):
    titres = []
    for r in (resultats or {}).get("results", []):
        t = (r.get("metadata") or {}).get("titre")
        if t and t not in titres:
            titres.append(t)
    return titres


def classement_vectoriel(rag, requete, m, n, nb):
    return titres_uniques(silencieux(rag.search, query=requete, matiere=m, niveau=n, n_results=nb))


class IndexBM25:
    def __init__(self, loader):
        self.loader = loader
        self.cache = {}

    def get(self, m, n):
        cle = (m, n)
        if cle not in self.cache:
            from rank_bm25 import BM25Okapi
            docs = self.loader.get_by_matiere_niveau(m, n)
            self.cache[cle] = (docs, BM25Okapi([tokeniser(d.content) for d in docs]))
        return self.cache[cle]

    def classement(self, requete, m, n):
        docs, bm25 = self.get(m, n)
        scores = bm25.get_scores(tokeniser(requete))
        ordre = sorted(range(len(docs)), key=lambda i: -scores[i])
        titres = []
        for i in ordre:
            t = docs[i].metadata.get("titre")
            if t and t not in titres:
                titres.append(t)
        return titres


def classement_hybride(rag, index_bm25, requete, m, n, nb):
    lexical = index_bm25.classement(requete, m, n)
    vectoriel = classement_vectoriel(rag, requete, m, n, 30)
    score = defaultdict(float)
    for liste in (lexical, vectoriel):
        for pos, titre in enumerate(liste, 1):
            score[titre] += 1.0 / (60 + pos)
    return [t for t, _ in sorted(score.items(), key=lambda x: -x[1])][:nb]


def charger_corpus(quiz_engine):
    loader = quiz_engine.get_document_loader()
    corpus = []
    for m in quiz_engine.MATIERE_DISPLAY:
        for n in "123456":
            try:
                for d in loader.get_by_matiere_niveau(m, n):
                    corpus.append((m, n, d))
            except Exception:
                pass
    return loader, corpus


def filtrer_uniques(corpus):
    titres_par_mn = defaultdict(Counter)
    for m, n, d in corpus:
        titres_par_mn[(m, n)][d.metadata.get("titre")] += 1
    return [(m, n, d) for m, n, d in corpus
            if d.metadata.get("titre") and titres_par_mn[(m, n)][d.metadata.get("titre")] == 1]


def modes_rag(args, index_bm25_disponible):
    modes = [
        ("titre", "requete = titre exact (test FACILE : en production, l'application retrouve deja les "
                  "chapitres par titre, sans passer par le RAG)", True),
        ("extrait", f"requete = {args.mots_extrait} mots tires au hasard dans le cours (test de ROBUSTESSE "
                    "DIFFICILE : recherche libre, non utilisee par l'application actuelle)", False),
    ]
    if args.rag_hybride and index_bm25_disponible:
        modes.append(("extrait_hybride", "memes extraits, recherche HYBRIDE BM25 + vecteurs (fusion RRF)", False))
    return modes


def metriques_rag(mode, libelle, avec_seuils, rangs, latences, hasard, k):
    nq = len(rangs)
    if not nq:
        R.alerte(f"RAG ({mode}) : aucune requete exploitable.")
        return
    print()
    R.info(f"Mode : {libelle}")
    r1 = pct(sum(1 for r in rangs if r == 1), nq)
    r3 = pct(sum(1 for r in rangs if r and r <= 3), nq)
    rk = pct(sum(1 for r in rangs if r and r <= k), nq)
    mrr = sum(1.0 / r for r in rangs if r) / nq
    s1, s3, sk, sm = ((90, 75, 50), (95, 85, 65), (98, 90, 70), (0.9, 0.75, 0.5)) if avec_seuils \
        else (None, None, None, None)
    R.metrique(f"RAG [{mode}] Recall@1", r1, "%", s1, n=nq,
               definition="% de requetes ou le BON chapitre arrive en 1re position.",
               bien="Le moteur retrouve directement le bon chapitre.",
               mal="Le bon chapitre n'est pas souvent en tete.")
    R.metrique(f"RAG [{mode}] Recall@3", r3, "%", s3, n=nq,
               definition="% de requetes ou le bon chapitre est dans les 3 premiers resultats.",
               bien="Le bon chapitre est presque toujours dans le haut de la liste.",
               mal="Meme en regardant 3 resultats, le bon chapitre manque souvent.")
    R.metrique(f"RAG [{mode}] Recall@{k}", rk, "%", sk, n=nq,
               definition=f"% de requetes ou le bon chapitre est dans les {k} resultats renvoyes.",
               bien="La couverture de la recherche est bonne.",
               mal="Le bon chapitre est parfois totalement absent des resultats.")
    R.metrique(f"RAG [{mode}] MRR", mrr, "", sm, decimales=3, n=nq,
               definition="Mean Reciprocal Rank = moyenne de 1/rang du bon chapitre (1 = toujours 1er, 0 = jamais trouve).",
               bien="Classement tres pertinent.", mal="Le bon chapitre est trouve mais souvent mal classe.")
    R.metrique(f"RAG [{mode}] Recall@1 d'un tirage au hasard", pct(sum(hasard), len(hasard)), "%",
               definition="Score qu'obtiendrait un choix aleatoire parmi les chapitres du meme niveau/matiere.",
               bien=f"Le RAG doit etre nettement au-dessus de cette valeur (ici Recall@1 = {r1:.1f}%).")
    R.metrique(f"RAG [{mode}] Latence moyenne", en_ms(latences), " ms", n=len(latences),
               definition="Temps moyen d'une recherche (encodage de la requete par le modele d'embedding inclus).",
               bien="Information : sans impact sur l'utilisateur, la generation de quiz dure plusieurs secondes.")
    if not avec_seuils:
        R.info(f"Mode « {mode} » presente SANS note (INFO) : test de stress, a citer comme limite de la "
               "recherche libre et non comme defaut de l'application.")


def evaluer_rag(args, rng, quiz_engine, loader, uniques, nb_candidats):
    R.sous_titre("1.1 Recherche documentaire (RAG / SimpleRAG.search)")
    try:
        rag = quiz_engine.get_rag_engine()
        try:
            n_chunks = rag.vector_store.collection.count()
            R.info(f"Index vectoriel : {n_chunks} chunks")
            if n_chunks == 0:
                R.alerte("Index vectoriel vide : seule la recherche exacte est evaluee.")
        except Exception:
            pass

        index_bm25 = None
        if args.rag_hybride:
            try:
                import rank_bm25  # noqa: F401
                index_bm25 = IndexBM25(loader)
            except ImportError:
                R.alerte("rank-bm25 absent : mode hybride ignore (pip install rank-bm25).")

        echantillon = rng.sample(uniques, min(args.nb_rag, len(uniques)))
        extraits = [extrait_aleatoire(d.content, rng, args.mots_extrait) for _, _, d in echantillon]
        R.info(f"Test sur {len(echantillon)} chapitres (les messages internes du RAG sont masques).")

        for mode, libelle, avec_seuils in modes_rag(args, index_bm25 is not None):
            rangs, latences, hasard = [], [], []
            for (m, n, d), extrait in zip(echantillon, extraits):
                titre = d.metadata.get("titre")
                requete = titre if mode == "titre" else extrait
                if not requete or not titre:
                    continue
                t0 = time.perf_counter()
                try:
                    if mode == "extrait_hybride":
                        titres = classement_hybride(rag, index_bm25, requete, m, n, args.k)
                    else:
                        titres = classement_vectoriel(rag, requete, m, n, args.k)
                except Exception as e:
                    R.info(f"Erreur RAG sur « {titre} » : {e}")
                    continue
                latences.append(time.perf_counter() - t0)
                rangs.append(titres.index(titre) + 1 if titre in titres else None)
                hasard.append(1.0 / max(1, nb_candidats[(m, n)]))
            metriques_rag(mode, libelle, avec_seuils, rangs, latences, hasard, args.k)
    except Exception as e:
        R.alerte(f"Evaluation RAG impossible : {e}")


def choisir_cas_quiz(uniques, nb_quiz, rng):
    par_matiere = defaultdict(list)
    for item in uniques:
        par_matiere[item[0]].append(item)
    for lst in par_matiere.values():
        rng.shuffle(lst)
    cas, matieres, i = [], list(par_matiere), 0
    while len(cas) < nb_quiz and any(par_matiere.values()):
        m = matieres[i % len(matieres)]
        if par_matiere[m]:
            cas.append(par_matiere[m].pop())
        i += 1
    return cas


def generer_quiz(args, quiz_engine, validation, cas):
    original_image = quiz_engine.image_service.generer_image
    if not args.quiz_avec_images:
        quiz_engine.image_service.generer_image = lambda *a, **k: None
        R.info("Generation d'images DESACTIVEE pendant cette section (evaluee a part en section 6). "
               "Option --quiz-avec-images pour la garder.")
    resultats = []
    try:
        for idx, (m, n, doc) in enumerate(cas):
            titre = doc.metadata.get("titre", "")
            nb = NB_QUESTIONS[idx % len(NB_QUESTIONS)]
            types = TYPES_DEMANDES[idx % len(TYPES_DEMANDES)]
            repart = {types[0]: nb // 2, types[1]: nb - nb // 2} if idx % 2 == 1 else None
            print(f"  Quiz {idx + 1}/{len(cas)} : {m}, {n}e annee, « {titre[:50]} », {nb} questions, "
                  f"types={types}{', repartition=' + str(repart) if repart else ''} ...", flush=True)
            rec = {"matiere": m, "niveau": n, "chapitre": titre, "nb_demande": nb, "types_demandes": types,
                   "repartition": repart, "ok": False, "contenu_cours": doc.content}
            depart = GEM.chrono()
            try:
                ex, logs = capturer(quiz_engine.generer_quiz_pour_wizard,
                                    matiere_key=m, niveau=n, chapitres=[titre], nb_questions=nb,
                                    types_questions=types, repartition_types=repart)
                rec["latence"] = GEM.duree(depart)
                rec["examen"] = ex
                rec["ok"] = True
                rec["questions_rejetees"] = logs.count("ignoree")
                v = validation.valider_examen(ex, nb_questions_attendu=nb, niveau_attendu=n)
                rec["validation"] = v
                rejet = f", {rec['questions_rejetees']} question(s) rejetee(s) par Pydantic" \
                    if rec["questions_rejetees"] else ""
                print(col(f"      OK en {rec['latence']:.1f}s -- {len(ex.get('questions', []))} questions, "
                          f"score validation {v['score']}/100{rejet}", GRIS))
            except Exception as e:
                rec["latence"] = GEM.duree(depart)
                rec["erreur"] = str(e)
                print(col(f"      ECHEC : {str(e)[:150]}", JAUNE))
                if credit_epuise(e):
                    GEM.signaler_credits()
                    resultats.append(rec)
                    break
            resultats.append(rec)
    finally:
        quiz_engine.image_service.generer_image = original_image
    return resultats


def sauver_quiz(sortie, resultats):
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / "quiz_generes.json").write_text(json.dumps(
        [{k: v for k, v in r.items() if k != "contenu_cours"} for r in resultats],
        ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def metriques_generation(reussis, total):
    nb_ok = len(reussis)
    R.metrique("Taux de generation reussie", pct(nb_ok, total), "%", (95, 85, 70), n=total, ic=(nb_ok, total),
               definition="% d'appels qui renvoient un quiz exploitable (JSON valide + au moins une question acceptee par Pydantic).",
               bien="Gemini respecte bien le format JSON attendu : le systeme est fiable.",
               mal="Trop d'echecs (JSON invalide, quota 429, contenu introuvable) : voir les messages ECHEC ci-dessus.")
    rejetees = sum(r.get("questions_rejetees", 0) for r in reussis)
    total_q = sum(len(r["examen"].get("questions", [])) for r in reussis)
    R.metrique("Questions rejetees par la validation Pydantic", pct(rejetees, rejetees + total_q), "%",
               (2, 5, 10), False, n=rejetees + total_q,
               definition="% des questions produites par Gemini ignorees car mal formees (champ manquant, mauvais type...).",
               bien="Presque toutes les questions generees respectent le schema.",
               mal="Gemini produit souvent des questions mal formees : preciser le format dans le prompt.")
    lat = [r["latence"] for r in reussis]
    R.metrique("Latence moyenne de generation", moyenne(lat), " s", (15, 30, 60), False, n=len(lat),
               definition="Temps moyen pour generer un quiz complet (RAG + Gemini + conversion), pause anti-quota du script exclue.",
               bien="Temps d'attente acceptable pour un enseignant.",
               mal="Attente longue pour l'utilisateur (prevoir un indicateur de chargement / reduire le prompt).")
    R.metrique("Latence p95 de generation", p95(lat), " s", (25, 45, 90), False, n=len(lat),
               definition="95 % des generations prennent moins que cette duree (pire cas realiste).",
               bien="Meme les cas lents restent raisonnables.",
               mal="Certaines generations sont tres lentes (souvent des pauses de quota 429).")
    scores = [r["validation"]["score"] for r in reussis]
    R.metrique("Score moyen de validation (validation.py)", moyenne(scores), "/100", (90, 80, 60), n=len(scores),
               definition="Score deterministe de validation.py : 100 - 20 points par regle non respectee.",
               bien="Les quiz generes respectent les regles pedagogiques de base (controle de non-regression).",
               mal="Plusieurs regles echouent souvent : voir le detail par regle ci-dessous.")
    nb_valid = sum(1 for r in reussis if r["validation"]["peut_valider"])
    R.metrique("Quiz validables sans correction", pct(nb_valid, nb_ok), "%", (90, 75, 50), n=nb_ok,
               ic=(nb_valid, nb_ok),
               definition="% de quiz qui passent TOUTES les regles (peut_valider = True) des la 1re generation.",
               bien="Les quiz sont directement exploitables.", mal="Les quiz doivent souvent etre corriges ou regeneres.")


def metriques_regles(reussis):
    print()
    R.info("Detail par regle de validation.py :")
    par_regle = defaultdict(list)
    for r in reussis:
        for c in r["validation"]["checks"]:
            par_regle[c["label"].split(" (")[0]].append(c["ok"])
    R.tableau(["Regle", "Respectee", "%"],
              [[k, f"{sum(v)}/{len(v)}", f"{pct(sum(v), len(v)):.0f}%"] for k, v in par_regle.items()])
    for k, v in par_regle.items():
        if k.startswith("Nombre de questions"):
            R.metrique("Respect du nombre de questions demande", pct(sum(v), len(v)), "%", (95, 80, 60), n=len(v),
                       definition="% de quiz contenant exactement le nombre de questions demande.",
                       bien="Gemini respecte la consigne de quantite.",
                       mal="Gemini ajoute ou oublie des questions (ou certaines sont rejetees par Pydantic).")


def metriques_structure(reussis):
    q_types_ok = q_types_tot = rep_ok = rep_tot = quasi = paires = 0
    nb_types, sims = [], []
    for r in reussis:
        qs = r["examen"].get("questions", [])
        types_sortie = [q.get("type") for q in qs]
        q_types_tot += len(types_sortie)
        q_types_ok += sum(1 for t in types_sortie if t in r["types_demandes"])
        nb_types.append(len(set(types_sortie)))
        if r["repartition"]:
            rep_tot += 1
            attendu = Counter({k: v for k, v in r["repartition"].items() if v})
            rep_ok += int(Counter(types_sortie) == attendu)
        textes = [texte_question(q).lower() for q in qs if texte_question(q)]
        for a in range(len(textes)):
            for b in range(a + 1, len(textes)):
                s = difflib.SequenceMatcher(None, textes[a], textes[b]).ratio()
                sims.append(s)
                paires += 1
                quasi += int(s >= 0.85)

    R.metrique("Respect des types de questions demandes", pct(q_types_ok, q_types_tot), "%", (95, 85, 70),
               n=q_types_tot,
               definition="% des questions dont le type fait partie des types choisis par l'enseignant.",
               bien="Gemini n'invente pas de types non demandes.",
               mal="Gemini produit des types non demandes : renforcer la consigne dans le prompt.")
    if rep_tot:
        R.metrique("Respect exact de la repartition par type", pct(rep_ok, rep_tot), "%", (80, 60, 40), n=rep_tot,
                   definition="% de quiz ou le nombre de questions de chaque type correspond EXACTEMENT a la repartition demandee.",
                   bien="La repartition demandee est bien suivie.", mal="La repartition n'est qu'approximativement suivie.")
    R.metrique("Nombre moyen de types differents par quiz", moyenne(nb_types), "", decimales=2, n=len(nb_types),
               definition="Diversite des formats de questions dans un meme quiz.",
               bien="Information descriptive : plus c'est eleve, plus le quiz est varie.")
    R.metrique("Similarite moyenne entre questions d'un meme quiz", (moyenne(sims) * 100) if sims else None, "%",
               (30, 45, 60), False, n=paires,
               definition="Similarite textuelle moyenne (difflib) entre toutes les paires de questions d'un quiz.",
               bien="Les questions sont bien differentes les unes des autres.",
               mal="Les questions se ressemblent trop (formulations repetitives).")
    R.metrique("Taux de quasi-doublons", pct(quasi, paires), "%", (1, 3, 8), False, n=paires,
               definition="% de paires de questions similaires a plus de 85 % (presque la meme question).",
               bien="Pas de repetition de questions.", mal="Des questions quasi identiques apparaissent dans un meme quiz.")


def questions_pour_juge(examen):
    qs = []
    for q in examen.get("questions", []):
        qq = {c: v for c, v in q.items() if c not in ("image", "points")}
        if isinstance(qq.get("support"), str):
            qq["support"] = qq["support"][:500]
        qs.append(qq)
    return qs


def collecter_notes_juge(reussis):
    notes = []
    for k, r in enumerate(reussis):
        if GEM.credits_epuises:
            break
        prompt = (PROMPT_JUGE_QUIZ
                  .replace("<<MATIERE>>", r["matiere"])
                  .replace("<<NIVEAU>>", str(r["niveau"]))
                  .replace("<<CHAPITRE>>", r["chapitre"])
                  .replace("<<COURS>>", (r["contenu_cours"] or "")[:6000])
                  .replace("<<QUESTIONS>>", json.dumps(questions_pour_juge(r["examen"]), ensure_ascii=False)))
        print(f"  Juge quiz {k + 1}/{len(reussis)} ...", flush=True)
        try:
            data = extraire_json(GEM.generate(prompt))
        except Exception as e:
            data = None
            print(col(f"      echec juge : {str(e)[:120]}", JAUNE))
            if credit_epuise(e):
                GEM.signaler_credits()
        if isinstance(data, dict):
            data = data.get("questions") or data.get("evaluations") or [data]
        if isinstance(data, list):
            for d in data:
                if isinstance(d, dict):
                    d["_quiz"] = k
                    notes.append(d)
            r["juge"] = data
    return notes


def metriques_juge(notes):
    v, (kk, nn) = taux_cle(notes, "exacte")
    R.metrique("[juge] Exactitude du contenu", v, "%", (95, 90, 80), n=nn, ic=(kk, nn),
               definition="% de questions jugees correctes sur le fond (aucune erreur scientifique / de langue).",
               bien="Tres peu d'erreurs de fond.", mal="Des erreurs de fond apparaissent : relecture par l'enseignant necessaire.")
    v, (kk, nn) = taux_cle(notes, "fidele_au_cours")
    R.metrique("[juge] Fidelite au cours (faithfulness)", v, "%", (90, 80, 65), n=nn, ic=(kk, nn),
               definition="% de questions portant sur des notions presentes dans le chapitre fourni (mesure les hors-programme).",
               bien="Gemini s'appuie bien sur le contexte fourni.", mal="Gemini sort souvent du chapitre fourni.")
    v, (kk, nn) = taux_cle(notes, "correction_juste")
    R.metrique("[juge] Justesse du corrige", v, "%", (95, 90, 80), n=nn, ic=(kk, nn),
               definition="% de questions dont la reponse attendue est correcte.",
               bien="Le corrige genere est fiable.", mal="Le corrige contient des erreurs : danger pour la notation des eleves.")
    for cle, nom, defn, bien, mal in (
        ("clarte", "Clarte des enonces", "Note moyenne (1-5) de clarte de l'enonce pour un enfant.",
         "Enonces clairs.", "Enonces parfois ambigus ou trop complexes."),
        ("adaptee_niveau", "Adaptation au niveau scolaire", "Note moyenne (1-5) d'adequation de la difficulte au niveau demande.",
         "La difficulte correspond au niveau.", "Difficulte mal calibree."),
        ("distracteurs", "Qualite des distracteurs (QCM)", "Note moyenne (1-5) de plausibilite des mauvaises options de QCM.",
         "Les mauvaises reponses sont credibles.", "Mauvaises reponses trop evidentes."),
    ):
        v, nn = moyenne_cle(notes, cle)
        R.metrique(f"[juge] {nom}", v, "/5", (4.5, 4.0, 3.0), decimales=2, n=nn, definition=defn, bien=bien, mal=mal)

    graves = [str(d.get("gravite", "")).strip().lower() for d in notes if d.get("gravite")]
    if graves:
        n_maj = sum(1 for g in graves if g.startswith("major"))
        n_min = sum(1 for g in graves if g.startswith("mineur"))
        R.metrique("[juge] Questions avec un defaut MAJEUR", pct(n_maj, len(graves)), "%", (3, 8, 15), False,
                   n=len(graves), ic=(n_maj, len(graves)),
                   definition="% de questions avec une erreur reelle (reponse fausse, ambiguite, hors programme, erreur de langue qui change le sens).",
                   bien="Peu de defauts reels.", mal="Des defauts reels apparaissent : voir la liste ci-dessous.")
        R.metrique("[juge] Questions avec une remarque mineure", pct(n_min, len(graves)), "%", n=len(graves),
                   definition="% de questions avec une simple remarque de formulation (sans consequence sur la note).",
                   bien="Information : ne pas presenter ce chiffre comme un taux d'erreur.")
    else:
        nb_def = sum(1 for d in notes if d.get("problemes"))
        R.metrique("[juge] Questions avec au moins une remarque", pct(nb_def, len(notes)), "%", n=len(notes),
                   definition="% de questions pour lesquelles le juge a liste un probleme (majorant : remarques mineures incluses).",
                   bien="Information : champ 'gravite' absent des reponses du juge.")
    majeurs = [(d.get("id"), p) for d in notes if str(d.get("gravite", "")).lower().startswith("major")
               for p in (d.get("problemes") or []) if str(p).strip()]
    if majeurs:
        R.info("Defauts MAJEURS releves par le juge (a verifier) :")
        for qid, p in majeurs[:10]:
            print(col(f"      {qid} : {str(p)[:150]}", GRIS))

    a_verifier = [d for d in notes
                  if (d.get("exacte") is not None and not vrai(d.get("exacte")))
                  or (d.get("correction_juste") is not None and not vrai(d.get("correction_juste")))]
    if a_verifier:
        R.alerte(f"{len(a_verifier)} question(s) signalee(s) fausses par le juge (exacte / correction_juste = false) : "
                 "a verifier A LA MAIN avant de citer le taux de defauts majeurs (incoherence possible avec 'gravite').")
        for d in a_verifier[:15]:
            probs = "; ".join(str(p)[:120] for p in (d.get("problemes") or []))
            print(col(f"      quiz {int(d.get('_quiz', -1)) + 1} / {d.get('id')} "
                      f"(gravite={d.get('gravite')}) : {probs}", GRIS))


def juger_quiz(args, reussis):
    R.sous_titre("1.3 Qualite du contenu -- LLM juge (Gemini) -- SCORES INDICATIFS, pas une verite terrain")
    if args.sans_juge or GEM.generate is None:
        R.info("LLM juge desactive (--sans-juge ou Gemini indisponible).")
        return
    if GEM.credits_epuises:
        R.alerte(MESSAGE_CREDITS)
        return
    R.alerte("Le juge (Gemini) est de la meme famille que le generateur : risque de biais d'auto-evaluation. "
             "Ces scores sont indicatifs et doivent etre presentes comme tels. Completez par une relecture humaine "
             "d'un echantillon (30 a 50 questions).")
    notes = collecter_notes_juge(reussis)
    if not notes:
        R.alerte("Le LLM juge n'a renvoye aucune note exploitable.")
        return
    metriques_juge(notes)


def section_quiz(args, rng, sortie, donnees):
    R.section(1, "GENERATION DE QUIZ (Gemini + RAG)")
    try:
        import quiz_engine
        import validation
    except Exception as e:
        R.alerte(f"Import de quiz_engine / validation impossible : {e}")
        return
    GEM.brancher()

    loader, corpus = charger_corpus(quiz_engine)
    if not corpus:
        R.alerte("Aucun chapitre trouve dans database_tunisienne/ -- section ignoree.")
        return
    R.info(f"{len(corpus)} chapitres trouves dans le programme (database_tunisienne/).")

    nb_candidats = Counter((m, n) for m, n, _ in corpus)
    uniques = filtrer_uniques(corpus)
    if len(uniques) < len(corpus):
        R.info(f"{len(corpus) - len(uniques)} chapitres ont un titre en double dans leur matiere/niveau : "
               "exclus des tests (le « bon » chapitre serait ambigu).")

    evaluer_rag(args, rng, quiz_engine, loader, uniques, nb_candidats)

    R.sous_titre("1.2 Generation des quiz (generer_quiz_pour_wizard + validation.py)")
    cas = choisir_cas_quiz(uniques, args.nb_quiz, rng)
    resultats = generer_quiz(args, quiz_engine, validation, cas)
    sauver_quiz(sortie, resultats)

    reussis = [r for r in resultats if r["ok"]]
    if not resultats or not reussis:
        R.metrique("Taux de generation reussie", pct(0, len(resultats)), "%", (95, 85, 70), n=len(resultats))
        R.alerte("Aucun quiz genere : impossible de calculer les autres metriques de la section 1.")
        return

    metriques_generation(reussis, len(resultats))
    metriques_regles(reussis)
    metriques_structure(reussis)
    juger_quiz(args, reussis)
    sauver_quiz(sortie, resultats)


JEU_SLU = [
    ("Crée un examen de maths pour la 3ème année avec 10 questions", "fr", "creer_examen",
     {"matiere": "mathematique", "niveau": 3, "nb_questions": 10}),
    ("Génère un devoir de sciences pour la cinquième année", "fr", "creer_examen",
     {"matiere": "science", "niveau": 5}),
    ("Prépare un contrôle de français niveau 2 avec des QCM", "fr", "creer_examen",
     {"matiere": "francais", "niveau": 2, "types": ["qcm"]}),
    ("Fais-moi un test d'histoire pour la 6ème année, 8 questions, texte à trous", "fr", "creer_examen",
     {"matiere": "histoire_geo", "niveau": 6, "nb_questions": 8, "types": ["texte_a_trous"]}),
    ("Je veux un quiz d'arabe pour la 1ère année", "fr", "creer_examen",
     {"matiere": "arabe", "niveau": 1}),
    ("Prépare un sujet de mathématiques pour la deuxième année avec cinq questions", "fr", "creer_examen",
     {"matiere": "mathematique", "niveau": 2, "nb_questions": 5}),
    ("Génère un examen de calcul pour la 3e avec 6 questions de QCM", "fr", "creer_examen",
     {"matiere": "mathematique", "niveau": 3, "nb_questions": 6, "types": ["qcm"]}),
    ("J'ai besoin d'un test de géographie pour des élèves de 5ème année avec des questions ouvertes", "fr",
     "creer_examen", {"matiere": "histoire_geo", "niveau": 5, "types": ["question_ouverte"]}),
    ("Crée un examen de sciences avec une légende d'image pour la 4ème année", "fr", "creer_examen",
     {"matiere": "science", "niveau": 4, "types": ["legende_image"]}),
    ("Un examen de sciences pour la 4ème année s'il te plaît", "fr", "creer_examen",
     {"matiere": "science", "niveau": 4}),
    ("Est-ce que tu peux créer un examen de maths ?", "fr", "creer_examen",
     {"matiere": "mathematique"}),
    ("Crée un examen à partir du document PDF", "fr", "creer_examen_pdf", {}),
    ("Génère une évaluation depuis ce fichier", "fr", "creer_examen_pdf", {}),
    ("Ouvre mes examens", "fr", "ouvrir_mes_examens", {}),
    ("Affiche la liste des examens", "fr", "ouvrir_mes_examens", {}),
    ("Montre-moi les examens enregistrés", "fr", "ouvrir_mes_examens", {}),
    ("Comment expliquer les fractions à des élèves de 4ème année ?", "fr", "question", {}),
    ("Pourquoi les élèves confondent le singulier et le pluriel ?", "fr", "question", {}),
    ("Quelle est la meilleure méthode pour enseigner la lecture ?", "fr", "question", {}),
    ("Donne-moi des idées d'activités pour la classe de sciences", "fr", "question", {}),
    ("Explique-moi comment corriger une rédaction", "fr", "question", {}),
    ("Merci beaucoup", "fr", "question", {}),
    ("Quels chapitres sont au programme de 6ème année en histoire ?", "fr", "question", {}),
    ("انشئ امتحان رياضيات للسنة الثالثة فيه 10 أسئلة", "ar", "creer_examen",
     {"matiere": "mathematique", "niveau": 3, "nb_questions": 10}),
    ("حضر لي اختبار في العلوم للسنة الخامسة", "ar", "creer_examen",
     {"matiere": "science", "niveau": 5}),
    ("اريد فرض في اللغة العربية للسنة الثانية", "ar", "creer_examen",
     {"matiere": "arabe", "niveau": 2}),
    ("اعمل امتحان تاريخ للسنة السادسة مع اختيار من متعدد", "ar", "creer_examen",
     {"matiere": "histoire_geo", "niveau": 6, "types": ["qcm"]}),
    ("اكتب اختبار جغرافيا للسنة الرابعة فيه خمسة أسئلة", "ar", "creer_examen",
     {"matiere": "histoire_geo", "niveau": 4, "nb_questions": 5}),
    ("ولد امتحان فرنسية للسنة الثالثة مع فراغات", "ar", "creer_examen",
     {"matiere": "francais", "niveau": 3, "types": ["texte_a_trous"]}),
    ("امتحان علوم للسنة الأولى من فضلك", "ar", "creer_examen",
     {"matiere": "science", "niveau": 1}),
    ("هل يمكنك إنشاء امتحان في الرياضيات؟", "ar", "creer_examen",
     {"matiere": "mathematique"}),
    ("انشئ امتحان من الملف", "ar", "creer_examen_pdf", {}),
    ("افتح امتحاناتي", "ar", "ouvrir_mes_examens", {}),
    ("اعرض امتحاناتي", "ar", "ouvrir_mes_examens", {}),
    ("كيف أشرح الكسور لتلاميذ السنة الرابعة؟", "ar", "question", {}),
    ("ما هي أفضل طريقة لتعليم القراءة؟", "ar", "question", {}),
    ("شكرا جزيلا", "ar", "question", {}),
    ("لماذا يخطئ التلاميذ في جدول الضرب؟", "ar", "question", {}),
]

JEU_SLU_VALIDATION = [
    ("salut, tu me fais un examen de maths niveau 4 stp", "fr", "creer_examen",
     {"matiere": "mathematique", "niveau": 4}),
    ("il me faut une évaluation en sciences pour mes élèves de sixième", "fr", "creer_examen",
     {"matiere": "science", "niveau": 6}),
    ("génère moi 12 questions sur la géographie pour la 5e année", "fr", "creer_examen",
     {"matiere": "histoire_geo", "niveau": 5, "nb_questions": 12}),
    ("je voudrais un controle de francais pour la troisieme annee avec 7 questions", "fr", "creer_examen",
     {"matiere": "francais", "niveau": 3, "nb_questions": 7}),
    ("examen d'arabe 2ème année 10 questions qcm", "fr", "creer_examen",
     {"matiere": "arabe", "niveau": 2, "nb_questions": 10, "types": ["qcm"]}),
    ("prépare-moi un test de calcul niveau 1", "fr", "creer_examen",
     {"matiere": "mathematique", "niveau": 1}),
    ("Pourrais-tu générer un examen d'histoire pour la 6ème ?", "fr", "creer_examen",
     {"matiere": "histoire_geo", "niveau": 6}),
    ("Crée un quiz de sciences de 15 questions avec des questions ouvertes pour la 3ème année", "fr",
     "creer_examen", {"matiere": "science", "niveau": 3, "nb_questions": 15, "types": ["question_ouverte"]}),
    ("créer examen maths 5e", "fr", "creer_examen", {"matiere": "mathematique", "niveau": 5}),
    ("fais moi un exam de sciences", "fr", "creer_examen", {"matiere": "science"}),
    ("fais un devoir de maths à partir du pdf que j'ai envoyé", "fr", "creer_examen_pdf", {}),
    ("Utilise le document joint pour créer une évaluation", "fr", "creer_examen_pdf", {}),
    ("je veux voir mes examens", "fr", "ouvrir_mes_examens", {}),
    ("où sont les examens que j'ai déjà créés ?", "fr", "ouvrir_mes_examens", {}),
    ("Affiche mes examens enregistrés", "fr", "ouvrir_mes_examens", {}),
    ("Comment puis-je rendre un examen plus facile pour les élèves en difficulté ?", "fr", "question", {}),
    ("Quelle est la différence entre un QCM et une question ouverte ?", "fr", "question", {}),
    ("Donne-moi un exemple d'exercice sur les fractions", "fr", "question", {}),
    ("explique moi la photosynthèse simplement", "fr", "question", {}),
    ("je ne veux pas d'examen maintenant, juste un conseil pour motiver ma classe", "fr", "question", {}),
    ("bonjour", "fr", "question", {}),
    ("c'est quoi le programme de maths en 2ème année ?", "fr", "question", {}),
    ("اعملي امتحان في الرياضيات للسنة الرابعة", "ar", "creer_examen",
     {"matiere": "mathematique", "niveau": 4}),
    ("نحب فرض علوم للسنة السادسة فيه 8 أسئلة", "ar", "creer_examen",
     {"matiere": "science", "niveau": 6, "nb_questions": 8}),
    ("حضرلي اختبار عربية للسنة الثانية", "ar", "creer_examen", {"matiere": "arabe", "niveau": 2}),
    ("أعطني امتحان جغرافيا للسنة الخامسة", "ar", "creer_examen", {"matiere": "histoire_geo", "niveau": 5}),
    ("أريد تقييما في التاريخ للسنة السادسة باختيار من متعدد", "ar", "creer_examen",
     {"matiere": "histoire_geo", "niveau": 6, "types": ["qcm"]}),
    ("نحب امتحان رياضيات سنة ثالثة عشرة أسئلة", "ar", "creer_examen",
     {"matiere": "mathematique", "niveau": 3, "nb_questions": 10}),
    ("ممكن تعملي فرض فرنسية للسنة الرابعة؟", "ar", "creer_examen", {"matiere": "francais", "niveau": 4}),
    ("جهزلي امتحان تاريخ للسنة السادسة", "ar", "creer_examen", {"matiere": "histoire_geo", "niveau": 6}),
    ("اصنع امتحانا من الوثيقة المرفقة", "ar", "creer_examen_pdf", {}),
    ("انشئ اختبار علوم من ملف pdf", "ar", "creer_examen_pdf", {}),
    ("اعرض لي الامتحانات التي حفظتها", "ar", "ouvrir_mes_examens", {}),
    ("افتح قائمة امتحاناتي", "ar", "ouvrir_mes_examens", {}),
    ("كيف أقيم تلاميذ السنة الأولى في القراءة؟", "ar", "question", {}),
    ("ما الفرق بين الفرض والامتحان؟", "ar", "question", {}),
    ("اشرح لي درس الكسور", "ar", "question", {}),
    ("عسلامة", "ar", "question", {}),
    ("هل توجد امتحانات جاهزة للسنة الخامسة؟", "ar", "question", {}),
    ("اعطيني نصيحة باش نحضر امتحان", "ar", "question", {}),
]

INTENTIONS = ["creer_examen", "creer_examen_pdf", "ouvrir_mes_examens", "question"]
SLOTS = ["matiere", "niveau", "nb_questions"]
ABREVIATIONS = {"creer_examen": "creer", "creer_examen_pdf": "pdf", "ouvrir_mes_examens": "ouvrir",
                "question": "question", "echec": "echec"}


def evaluer_slots(golds, preds):
    res = {}
    for slot in SLOTS + ["types"]:
        tp = fp = fn = 0
        for g, p in zip(golds, preds):
            if slot == "types":
                gs, ps = set(g.get("types") or []), set(p.get("types") or [])
                tp += len(gs & ps)
                fp += len(ps - gs)
                fn += len(gs - ps)
                continue
            gv, pv = g.get(slot), p.get(slot)
            if gv is not None and pv is not None and str(gv) == str(pv):
                tp += 1
            else:
                fp += int(pv is not None)
                fn += int(gv is not None)
        precision, rappel, f1 = prf(tp, fp, fn)
        res[slot] = {"precision": precision, "rappel": rappel, "f1": f1, "support": tp + fn}
    return res


def trame_exacte(g_int, g_par, p_int, p_par):
    if g_int != p_int:
        return False
    if g_int != "creer_examen":
        return True
    if any(str(g_par.get(s)) != str(p_par.get(s)) for s in SLOTS):
        return False
    return set(g_par.get("types") or []) == set(p_par.get("types") or [])


def predire_slu(ve, mode, texte, langue):
    try:
        if mode == "regles":
            return ve.comprendre(texte, utiliser_ia=False)
        if mode == "hybride":
            return ve.comprendre(texte, utiliser_ia=True)
        return ve._slu_gemini(texte, langue) or {"intention": "echec", "parametres": {}, "source": "ia"}
    except Exception as e:
        return {"intention": "echec", "parametres": {}, "erreur": str(e)}


def evaluer_jeu_slu(ve, nom_jeu, jeu, modes):
    lignes, details = [], {}
    for mode, libelle in modes:
        R.sous_titre(f"[{nom_jeu}] {libelle}")
        preds, lat, appels_ia = [], [], 0
        for texte, langue, _, _ in jeu:
            depart = GEM.chrono()
            r = predire_slu(ve, mode, texte, langue)
            lat.append(GEM.duree(depart))
            appels_ia += int(r.get("source") == "ia")
            preds.append(r)

        n = len(jeu)
        gold_i = [j[2] for j in jeu]
        pred_i = [p.get("intention") for p in preds]
        k_ok = sum(1 for g, p in zip(gold_i, pred_i) if g == p)
        acc = pct(k_ok, n)
        par_cl = prf_par_classe(gold_i, pred_i, INTENTIONS)
        macro = statistics.mean(v["f1"] for v in par_cl.values()) * 100
        pfx = f"[{nom_jeu}/{mode}]"

        R.metrique(f"{pfx} Exactitude de l'intention (accuracy)", acc, "%", (95, 85, 70), n=n, ic=(k_ok, n),
                   definition="% d'enonces dont l'intention (creer_examen, creer_examen_pdf, ouvrir_mes_examens, question) est correcte.",
                   bien="L'assistant comprend bien ce que veut l'enseignant.",
                   mal="Trop d'intentions mal comprises : l'assistant declenche la mauvaise action.")
        R.metrique(f"{pfx} F1-score macro des intentions", macro, "%", (90, 80, 65), n=n,
                   definition="Moyenne des F1 de chaque intention (meme poids pour les intentions rares).",
                   bien="Bonnes performances sur TOUTES les intentions.",
                   mal="Certaines intentions sont mal reconnues (voir le tableau par classe).")
        print()
        R.tableau(["Intention", "Precision", "Rappel", "F1", "Support"], lignes_prf(par_cl))
        print()
        R.info("Matrice de confusion (lignes = attendu, colonnes = predit) :")
        colonnes = INTENTIONS + (["echec"] if "echec" in pred_i else [])
        R.tableau(["attendu \\ predit"] + [ABREVIATIONS[c] for c in colonnes],
                  [[ABREVIATIONS[g]] + [sum(1 for a, b in zip(gold_i, pred_i) if a == g and b == c) for c in colonnes]
                   for g in INTENTIONS])

        idx_creer = [i for i, j in enumerate(jeu) if j[2] == "creer_examen"]
        sl = evaluer_slots([jeu[i][3] for i in idx_creer], [preds[i].get("parametres") or {} for i in idx_creer])
        print()
        R.info("Extraction des parametres (sur les enonces 'creer_examen') :")
        R.tableau(["Parametre", "Precision", "Rappel", "F1", "Support"], lignes_prf(sl))
        f1_slots = [v["f1"] for v in sl.values() if v["support"]]
        f1_p = statistics.mean(f1_slots) * 100 if f1_slots else None
        R.metrique(f"{pfx} F1 moyen d'extraction des parametres", f1_p, "%", (90, 80, 60), n=len(idx_creer),
                   definition="Moyenne des F1 de matiere, niveau, nb_questions et types (slot filling).",
                   bien="Les parametres de l'examen sont bien extraits de la phrase.",
                   mal="Parametres souvent rates ou faux.")
        k_em = sum(1 for i, j in enumerate(jeu)
                   if trame_exacte(j[2], j[3], pred_i[i], preds[i].get("parametres") or {}))
        em = pct(k_em, n)
        R.metrique(f"{pfx} Exact match (intention + tous les parametres)", em, "%", (90, 75, 50), n=n, ic=(k_em, n),
                   definition="% d'enonces ou TOUT est juste : intention et tous les parametres.",
                   bien="La commande est comprise entierement.",
                   mal="La comprehension complete d'une commande reste fragile.")
        seuils_lat = (50, 500, 3000) if mode == "regles" else (500, 2000, 5000)
        R.metrique(f"{pfx} Latence moyenne", en_ms(lat), " ms", seuils_lat, False, n=n,
                   definition="Temps moyen d'analyse d'un enonce" + (" (pause anti-quota exclue)" if mode != "regles" else "") + ".",
                   bien="Reponse rapide.", mal="Temps de reponse perceptible.")
        if mode == "hybride":
            R.metrique(f"{pfx} Part des enonces envoyes a Gemini", pct(appels_ia, n), "%", n=n,
                       definition="% d'enonces ou les regles hesitaient et ou Gemini a tranche.",
                       bien="Information : plus c'est bas, moins on consomme de quota Gemini.")

        erreurs = [(jeu[i][0], jeu[i][2], pred_i[i]) for i in range(n) if jeu[i][2] != pred_i[i]]
        if erreurs:
            print()
            R.info(f"Erreurs d'intention ({len(erreurs)}) :")
            for t, g, p in erreurs[:12]:
                print(col(f"      « {t} »  attendu={g}  predit={p}", GRIS))
        lignes.append([nom_jeu, libelle, f"{acc:.1f}%", f"{macro:.1f}%",
                       f"{f1_p:.1f}%" if f1_p is not None else "N/A", f"{em:.1f}%",
                       f"{(en_ms(lat) or 0):.0f} ms"])
        details[mode] = [{"texte": jeu[i][0], "attendu": jeu[i][2], "predit": preds[i]} for i in range(n)]
    return lignes, details


def charger_jeu_test(donnees, ve):
    fichier = donnees / "slu_tests.json"
    if not fichier.exists():
        return [], fichier
    jeu = []
    for it in json.loads(fichier.read_text(encoding="utf-8")):
        jeu.append((it["texte"], it.get("langue", ve.detecter_langue(it["texte"])),
                    it["intention"], it.get("parametres", {})))
    return jeu, fichier


def section_slu(args, rng, sortie, donnees):
    R.section(2, "COMPREHENSION DES COMMANDES VOCALES (SLU)")
    try:
        import voice_engine as ve
    except Exception as e:
        R.alerte(f"Import de voice_engine impossible : {e}")
        return
    jeu_dev = list(JEU_SLU)
    jeu_valid = list(JEU_SLU_VALIDATION)
    try:
        jeu_test, fichier_test = charger_jeu_test(donnees, ve)
    except Exception as e:
        R.alerte(f"slu_tests.json illisible : {e}")
        jeu_test, fichier_test = [], donnees / "slu_tests.json"

    R.info(f"Seuil de confiance avant appel a Gemini : {getattr(ve, 'SEUIL_CONFIANCE_IA', 0.5)}")
    R.info(f"Jeu DEV        : {len(jeu_dev)} enonces -- utilises pour ECRIRE les regles : score optimiste.")
    R.info(f"Jeu VALIDATION : {len(jeu_valid)} enonces -- les regles ont ete AJUSTEES en regardant leurs erreurs : "
           "score optimiste, a presenter comme jeu de validation.")
    if jeu_test:
        R.info(f"Jeu TEST inedit: {len(jeu_test)} enonces ({fichier_test.name}) -- a ne JAMAIS utiliser pour "
               "corriger les regles : c'est le score a citer (s'il vient d'un tiers, il est non biaise).")
        if len(jeu_test) < 30:
            R.alerte(f"Jeu TEST court ({len(jeu_test)} enonces, dont {sum(1 for j in jeu_test if j[2] == 'creer_examen')} "
                     "'creer_examen') : l'intervalle de confiance reste large (100 % sur 23 = IC95 86-100 %). "
                     "Visez 50+ phrases ecrites par un tiers, avec des formulations familieres et de la darija.")
    else:
        R.alerte(f"Aucun jeu TEST inedit ({fichier_test}) : aucun score SLU non biaise. Faites ecrire 15 a 20 "
                 "phrases par un collegue (sans lui montrer les regles) dans ce fichier.")

    R.sous_titre("Detection de la langue (detecter_langue) -- jeux VALIDATION + TEST")
    langue_jeu = jeu_valid + jeu_test
    ok = sum(1 for t, l, _, _ in langue_jeu if ve.detecter_langue(t) == l)
    R.metrique("[valid+test] Exactitude de la detection de langue", pct(ok, len(langue_jeu)), "%", (99, 95, 90),
               n=len(langue_jeu), ic=(ok, len(langue_jeu)),
               definition="% d'enonces dont la langue (fr/ar) est correctement detectee.",
               bien="La bonne voix / le bon modele de langue sera choisi.",
               mal="Erreurs de langue : la reponse vocale risque d'etre lue dans la mauvaise langue.")

    modes = [("regles", "Regles seules (_slu_regles)"),
             ("hybride", "Hybride regles + Gemini (comprendre(), comme en production)")]
    if args.slu_ia_pure:
        modes.append(("ia", "Gemini seul (_slu_gemini)"))
    else:
        total = len(jeu_dev) + len(jeu_valid) + len(jeu_test)
        R.info(f"Option --slu-ia-pure pour evaluer aussi Gemini seul (~{total} appels Gemini).")

    lignes, details = [], {}
    for nom, jeu in (("dev", jeu_dev), ("validation", jeu_valid), ("test", jeu_test)):
        if not jeu:
            continue
        l, d = evaluer_jeu_slu(ve, nom, jeu, modes)
        lignes += l
        details[nom] = d

    R.sous_titre("Comparaison des approches")
    R.tableau(["Jeu", "Approche", "Accuracy", "F1 macro", "F1 params", "Exact match", "Latence"], lignes)
    R.info("Dans le rapport : citer le jeu TEST inedit ; DEV et VALIDATION montrent seulement l'ecart "
           "(sur-ajustement) entre phrases connues et phrases nouvelles. Ici l'entree est du TEXTE PROPRE : "
           "voir la section 8 pour le test de bout en bout (voix -> transcription -> comprehension).")
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / "slu_predictions.json").write_text(json.dumps(details, ensure_ascii=False, indent=2), encoding="utf-8")


PHRASES_REFERENCE = {
    "fr": [
        "Crée un examen de mathématiques pour la troisième année.",
        "Je veux un devoir de sciences avec dix questions.",
        "Ouvre la liste de mes examens.",
        "Comment expliquer les fractions aux élèves ?",
        "Prépare un contrôle de français avec des questions à choix multiples.",
        "Génère une évaluation d'histoire pour la cinquième année.",
        "Les élèves doivent compléter le texte à trous.",
        "Quelle est la différence entre un nom et un verbe ?",
        "Ajoute une question sur le cycle de l'eau.",
        "Le chat dort sous la table de la cuisine.",
        "Ajoute trois questions sur les fractions.",
        "Je voudrais un examen d'arabe pour la deuxième année.",
        "Montre-moi les examens enregistrés.",
        "Quelle méthode utiliser pour enseigner la lecture ?",
        "Les plantes ont besoin de lumière et d'eau.",
        "Crée un quiz de géographie avec des questions ouvertes.",
        "Combien de questions contient cet examen ?",
        "Le soleil se lève à l'est.",
        "Explique la différence entre le singulier et le pluriel.",
        "Génère un exercice de calcul pour la première année.",
    ],
    "ar": [
        "أنشئ امتحان رياضيات للسنة الثالثة",
        "أريد فرضا في العلوم فيه عشرة أسئلة",
        "افتح قائمة امتحاناتي",
        "كيف أشرح الكسور للتلاميذ؟",
        "حضر اختبارا في اللغة العربية للسنة الثانية",
        "ما هو الفرق بين الاسم والفعل؟",
        "يجب على التلاميذ ملء الفراغات في النص",
        "أضف سؤالا عن دورة الماء",
        "القط نائم تحت طاولة المطبخ",
        "اكتب امتحان تاريخ وجغرافيا للسنة السادسة",
        "أضف ثلاثة أسئلة عن الكسور",
        "أريد امتحانا في اللغة الفرنسية للسنة الرابعة",
        "اعرض لي الامتحانات المحفوظة",
        "ما هي أفضل طريقة لتعليم القراءة؟",
        "تحتاج النباتات إلى الضوء والماء",
        "أنشئ اختبار جغرافيا بأسئلة مفتوحة",
        "كم سؤالا يحتوي هذا الامتحان؟",
        "تشرق الشمس من الشرق",
        "اشرح الفرق بين المفرد والجمع",
        "ولد تمرينا في الحساب للسنة الأولى",
    ],
}
EXT_AUDIO = (".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac", ".opus")
PROMPTS_ASR_DEFAUT = {
    "fr": "Examen, enseignant, primaire, QCM, mathématiques, année.",
    "ar": "امتحان، معلم، ابتدائي، رياضيات، علوم، السنة الثالثة.",
}
CACHE_AUDIO = {"tts": None, "transcriptions": {}}
TASHKEEL = re.compile(r"[\u064B-\u0652\u0670\u0640]")


def normaliser_arabe(t):
    t = TASHKEEL.sub("", t)
    t = re.sub(r"[أإآٱ]", "ا", t)
    return t.replace("ى", "ي").replace("ة", "ه")


def normaliser_asr(texte, ve):
    t = ve.normaliser(texte) if ve is not None else (texte or "").lower()
    t = normaliser_arabe(t)
    t = re.sub(r"[^\w\s]", " ", t)
    t = t.replace("_", " ")
    nombres = getattr(ve, "NOMBRES", {}) if ve is not None else {}
    return [str(nombres[m]) if m in nombres else m for m in t.split()]


def wer_cer(paires, ve):
    err_m = tot_m = err_c = tot_c = 0
    details = []
    for ref, hyp in paires:
        r, h = normaliser_asr(ref, ve), normaliser_asr(hyp, ve)
        em = distance_edition(r, h)
        rc, hc = " ".join(r), " ".join(h)
        err_m += em
        tot_m += len(r)
        err_c += distance_edition(rc, hc)
        tot_c += len(rc)
        details.append((em / max(1, len(r)), ref, hyp))
    return pct(err_m, tot_m), pct(err_c, tot_c), details


def duree_audio(ve, chemin):
    try:
        return len(ve._decoder_pcm_16k(str(chemin))) / 16000.0
    except Exception:
        return None


def prompt_asr(ve, langue):
    table = getattr(ve, "PROMPTS_ASR", None) or PROMPTS_ASR_DEFAUT
    return table.get(langue or "fr", table.get("fr"))


def transcrire_fichier(ve, chemin, langue):
    cle = (str(chemin), langue)
    if cle in CACHE_AUDIO["transcriptions"]:
        return CACHE_AUDIO["transcriptions"][cle]
    b64 = base64.b64encode(chemin.read_bytes()).decode()
    t0 = time.perf_counter()
    try:
        r = ve.transcrire(b64, langue)
    except ve.ModuleVocalIndisponible:
        raise
    except Exception:
        modele = ve._charger_whisper()
        segs, info = modele.transcribe(ve._decoder_pcm_16k(str(chemin)), language=langue, vad_filter=True,
                                       beam_size=5, initial_prompt=prompt_asr(ve, langue))
        r = {"texte": " ".join(s.text.strip() for s in segs).strip(), "langue": getattr(info, "language", langue)}
    res = (r, time.perf_counter() - t0)
    CACHE_AUDIO["transcriptions"][cle] = res
    return res


def preparer_tts(ve, sortie):
    if CACHE_AUDIO["tts"] is not None:
        return CACHE_AUDIO["tts"]
    dossier = sortie / "audio_tts"
    dossier.mkdir(parents=True, exist_ok=True)
    items = []
    for langue, phrases in PHRASES_REFERENCE.items():
        for i, texte in enumerate(phrases, 1):
            chemin = dossier / f"{langue}_{i:02d}.mp3"
            it = {"langue": langue, "texte": texte, "chemin": chemin, "ok": False}
            t0 = time.perf_counter()
            try:
                mp3 = ve.synthetiser(texte, langue)
                it["latence"] = time.perf_counter() - t0
                if mp3:
                    chemin.write_bytes(mp3)
                    it["ok"] = True
                    it["duree"] = duree_audio(ve, chemin)
            except ve.ModuleVocalIndisponible:
                raise
            except Exception as e:
                it["latence"] = time.perf_counter() - t0
                it["erreur"] = str(e)
            items.append(it)
            etat = "OK" if it["ok"] else "ECHEC " + it.get("erreur", "")[:80]
            print(col(f"      TTS {langue} {i:02d} : {etat} ({it['latence']:.2f}s)", GRIS), flush=True)
    CACHE_AUDIO["tts"] = items
    return items


def charger_whisper(ve):
    print(col("  Chargement du modele whisper (le 1er lancement peut telecharger le modele)...", GRIS), flush=True)
    t0 = time.perf_counter()
    ve._charger_whisper()
    R.info(f"Modele whisper '{os.getenv('WHISPER_MODEL', 'small')}' charge en {time.perf_counter() - t0:.1f}s "
           "(temps de chargement exclu des mesures).")


def lister_enregistrements(donnees):
    echantillons = []
    for langue in ("fr", "ar"):
        dossier = donnees / "asr" / langue
        if dossier.exists():
            for f in sorted(dossier.iterdir()):
                if f.suffix.lower() in EXT_AUDIO and f.with_suffix(".txt").exists():
                    echantillons.append({"langue": langue, "chemin": f,
                                         "texte": f.with_suffix(".txt").read_text(encoding="utf-8").strip()})
    return echantillons


def metriques_asr_langue(langue, lst, ve):
    R.sous_titre(f"Langue : {'francais' if langue == 'fr' else 'arabe'}")
    w, c, det = wer_cer([(x["ref"], x["hyp"]) for x in lst], ve)
    seuil_w = (10, 20, 35) if langue == "fr" else (15, 30, 45)
    R.metrique(f"[{langue}] WER (Word Error Rate)", w, "%", seuil_w, False, n=len(lst),
               definition="Taux d'erreur par mot = (substitutions + suppressions + insertions) / nb de mots de reference "
                          "(arabe : voyelles breves et variantes d'alef/ya/ta marbuta neutralisees).",
               bien="La transcription est fiable : la commande vocale sera bien comprise ensuite.",
               mal="Trop de mots mal reconnus (essayer un modele plus gros, ou verifier la qualite du micro).")
    R.metrique(f"[{langue}] CER (Character Error Rate)", c, "%", (5, 10, 20), False, n=len(lst),
               definition="Taux d'erreur par caractere, plus tolerant pour l'arabe (mots longs, prefixes colles).",
               bien="Tres peu de caracteres errones.", mal="Beaucoup d'erreurs au niveau des caracteres.")
    rtf = [x["temps"] / x["duree"] for x in lst if x["duree"]]
    R.metrique(f"[{langue}] RTF (Real-Time Factor)", moyenne(rtf), "", (0.3, 0.7, 1.0), False, decimales=2, n=len(rtf),
               definition="Temps de calcul / duree de l'audio. < 1 = plus rapide que le temps reel.",
               bien="Transcription plus rapide que la parole : utilisable en interactif.",
               mal="Transcription lente sur cette machine (GPU, --whisper small, ou compute_type int8).")
    lid = [x for x in lst if x["langue_auto"]]
    R.metrique(f"[{langue}] Identification automatique de la langue",
               pct(sum(1 for x in lid if x["langue_auto"] == langue), len(lid)), "%", (98, 90, 80), n=len(lid),
               definition="% d'audios dont whisper detecte seul la bonne langue.",
               bien="La langue est reconnue sans aide.",
               mal="Whisper se trompe de langue : toujours envoyer 'langue' depuis le frontend.")
    afficher_pires("Pires transcriptions (WER phrase, reference -> hypothese) :", det)


def afficher_pires(titre, details):
    pires = sorted(details, key=lambda x: -x[0])[:3]
    if pires and pires[0][0] > 0:
        R.info(titre)
        for e, ref, hyp in pires:
            print(col(f"      {e * 100:.0f}%  « {ref} »  ->  « {hyp} »", GRIS))


def section_asr(args, rng, sortie, donnees):
    R.section(3, "RECONNAISSANCE VOCALE (faster-whisper)")
    try:
        import voice_engine as ve
    except Exception as e:
        R.alerte(f"Import de voice_engine impossible : {e}")
        return
    echantillons = lister_enregistrements(donnees)
    source = "enregistrements reels"
    if not echantillons and not args.asr_synthetique:
        R.alerte(f"Aucun enregistrement reel dans {donnees / 'asr'}\\fr et \\ar : section ignoree. Un score mesure sur "
                 "des voix de synthese ne serait PAS un score reel.")
        R.info("Pour enregistrer vos phrases au micro : python enregistrer_asr.py --langue fr --locuteur prenom")
        R.info("(option --asr-synthetique pour forcer un test indicatif sur voix de synthese)")
        return
    if not echantillons:
        source = "audio SYNTHETIQUE (edge-tts) -- INDICATIF, ne pas citer comme score reel"
        R.alerte("Aucun enregistrement reel -- utilisation de voix synthetiques edge-tts. "
                 "Les scores seront OPTIMISTES (voix propre, sans bruit).")
        try:
            items = preparer_tts(ve, sortie)
        except Exception as e:
            R.alerte(f"Impossible de generer l'audio synthetique (edge-tts) : {e}")
            return
        echantillons = [{"langue": it["langue"], "chemin": it["chemin"], "texte": it["texte"]}
                        for it in items if it["ok"]]
    if not echantillons:
        R.alerte("Aucun echantillon audio exploitable.")
        return
    try:
        charger_whisper(ve)
    except Exception as e:
        R.alerte(f"faster-whisper indisponible : {e} -- installez-le : pip install faster-whisper")
        return
    if source == "enregistrements reels":
        locuteurs = {e["chemin"].stem.rsplit("_", 1)[0] for e in echantillons}
        txt_loc = f"{len(locuteurs)} locuteur(s) ({', '.join(sorted(locuteurs))})"
    else:
        txt_loc = "1 voix de synthese par langue"
    R.info(f"{len(echantillons)} echantillons ({source}), {txt_loc}.")
    if len(echantillons) < 20:
        R.alerte("Peu d'echantillons : les resultats ASR sont peu fiables statistiquement (a signaler dans le rapport).")

    par_langue = defaultdict(list)
    for k, e in enumerate(echantillons, 1):
        try:
            r, t = transcrire_fichier(ve, e["chemin"], e["langue"])
            r_auto, _ = transcrire_fichier(ve, e["chemin"], None)
        except Exception as ex:
            print(col(f"      echec transcription {e['chemin'].name} : {ex}", JAUNE))
            continue
        par_langue[e["langue"]].append({
            "ref": e["texte"], "hyp": r.get("texte", ""), "temps": t, "duree": duree_audio(ve, e["chemin"]),
            "langue_auto": (r_auto.get("langue") or "")[:2],
        })
        print(col(f"      {k}/{len(echantillons)} [{e['langue']}] {r.get('texte', '')[:70]}", GRIS), flush=True)

    tous = []
    for langue, lst in par_langue.items():
        tous.extend(lst)
        metriques_asr_langue(langue, lst, ve)
    if len(par_langue) > 1:
        w, c, _ = wer_cer([(x["ref"], x["hyp"]) for x in tous], ve)
        R.sous_titre("Global (toutes langues)")
        R.metrique("WER global", w, "%", (12, 25, 40), False, n=len(tous),
                   definition="WER sur l'ensemble des echantillons FR + AR.",
                   bien="Bonne reconnaissance globale.", mal="Reconnaissance globale insuffisante.")
        R.metrique("CER global", c, "%", (5, 10, 20), False, n=len(tous),
                   definition="CER sur l'ensemble des echantillons FR + AR.",
                   bien="Bonne reconnaissance globale.", mal="Reconnaissance globale insuffisante.")
    R.info(f"Source des donnees : {source}.")


def intelligibilite_tts(ve, items):
    R.sous_titre("4.2 Intelligibilite (aller-retour TTS -> whisper)")
    R.info(f"Mesure indirecte (modele whisper '{os.getenv('WHISPER_MODEL', 'small')}') : un mauvais score peut venir "
           "de la voix OU de whisper. Pour departager : comparer avec le WER whisper sur voix humaine (section 3). "
           "Le texte arabe est normalise (voyelles breves, alef, ya, ta marbuta).")
    R.info("Si la section 3 a ete lancee avec --asr-synthetique, ces chiffres sont IDENTIQUES (memes audios, "
           "memes transcriptions) : ne les presentez qu'une fois.")
    try:
        charger_whisper(ve)
    except Exception as e:
        R.alerte(f"Intelligibilite non mesuree (whisper indisponible : {e}).")
        return
    for langue in ("fr", "ar"):
        paires = []
        for it in (i for i in items if i["ok"] and i["langue"] == langue):
            try:
                r, _ = transcrire_fichier(ve, it["chemin"], langue)
                paires.append((it["texte"], r.get("texte", "")))
            except Exception:
                pass
        if not paires:
            continue
        w, c, det = wer_cer(paires, ve)
        R.metrique(f"[{langue}] Intelligibilite : WER whisper sur la voix de synthese", w, "%", (5, 12, 25), False,
                   n=len(paires),
                   definition="On fait relire l'audio synthetise par whisper : moins il fait d'erreurs, plus la voix "
                              "est intelligible (methode automatique classique en evaluation TTS).",
                   bien="La voix est claire et bien articulee.",
                   mal="Des mots sont mal reconnus : cause possible = la voix OU whisper.")
        R.metrique(f"[{langue}] Intelligibilite : CER", c, "%", (3, 8, 15), False, n=len(paires),
                   definition="Meme mesure au niveau des caracteres.", bien="Prononciation precise.",
                   mal="Des caracteres sont mal reconnus : cause possible = la voix OU whisper.")
        afficher_pires(f"[{langue}] Phrases les plus mal reconnues :", det)


def section_tts(args, rng, sortie, donnees):
    R.section(4, "SYNTHESE VOCALE (edge-tts)")
    try:
        import voice_engine as ve
    except Exception as e:
        R.alerte(f"Import de voice_engine impossible : {e}")
        return
    R.info(f"Voix : fr = {ve.VOIX['fr']}, ar = {ve.VOIX['ar']}")
    try:
        items = preparer_tts(ve, sortie)
    except Exception as e:
        R.alerte(f"edge-tts indisponible : {e} -- installez-le : pip install edge-tts")
        return

    R.sous_titre("4.1 Fiabilite et rapidite")
    R.metrique("Taux de synthese reussie", pct(sum(1 for i in items if i["ok"]), len(items)), "%", (99, 95, 90),
               n=len(items), definition="% de textes transformes en audio sans erreur.",
               bien="Le service de synthese est fiable.",
               mal="Echecs frequents (reseau, service indisponible) : prevoir un repli (speechSynthesis du navigateur).")
    for langue in ("fr", "ar"):
        lst = [i for i in items if i["ok"] and i["langue"] == langue]
        if not lst:
            continue
        R.metrique(f"[{langue}] Latence moyenne de synthese", moyenne([i["latence"] for i in lst]), " s",
                   (1.0, 2.0, 4.0), False, decimales=2, n=len(lst),
                   definition="Temps entre l'envoi du texte et la reception du MP3 complet.",
                   bien="L'audio arrive vite, la conversation reste fluide.",
                   mal="Delai perceptible avant la reponse vocale.")
        rtf = [i["latence"] / i["duree"] for i in lst if i.get("duree")]
        R.metrique(f"[{langue}] RTF de synthese", moyenne(rtf), "", (0.3, 0.6, 1.0), False, decimales=2, n=len(rtf),
                   definition="Temps de synthese / duree de l'audio produit (< 1 = plus rapide que la lecture).",
                   bien="Synthese plus rapide que le temps reel.", mal="Synthese lente par rapport a la duree audio.")

    intelligibilite_tts(ve, items)
    R.info(f"Fichiers audio generes : {sortie / 'audio_tts'}")


MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}


def creer_modele_verite(dossier):
    dossier.mkdir(parents=True, exist_ok=True)
    exemple = {
        "plante.png": {"reponse_correcte": ["racine", "tige", ["feuille", "feuillage"]], "langue": "fr",
                       "matiere": "science", "niveau": "3", "question": "Légende les parties de la plante."},
        "corps_humain.jpg": {"reponse_correcte": ["الرأس", "اليد", ["الرجل", "الساق"]], "langue": "ar",
                             "matiere": "science", "niveau": "2", "question": "سمّ أجزاء الجسم المرقمة"},
        "paysage_sans_numeros.jpg": {"reponse_correcte": [], "langue": "fr", "matiere": "science", "niveau": "3",
                                     "question": "Image SANS reperes : le modele doit refuser (cas negatif)."},
    }
    (dossier / "verite_exemple.json").write_text(json.dumps(exemple, ensure_ascii=False, indent=2), encoding="utf-8")


def image_en_data_uri(chemin):
    mime = MIME.get(chemin.suffix.lower(), "image/png")
    return f"data:{mime};base64,{base64.b64encode(chemin.read_bytes()).decode()}"


def normaliser_legende(t, ve):
    """Normalise une legende : casse, voyelles breves, alef/ya/ta marbuta, article arabe 'ال', pluriel francais simple."""
    mots = normaliser_asr(str(t), ve)
    res = []
    for m in mots:
        if m.startswith("ال") and len(m) > 4:
            m = m[2:]
        if len(m) > 4 and m.endswith(("s", "x")):
            m = m[:-1]
        res.append(m)
    return " ".join(res)


def legendes_similaires(pred, gold, ve):
    """True si `pred` correspond a `gold`. `gold` peut etre une chaine ou une LISTE de synonymes acceptes."""
    golds = gold if isinstance(gold, (list, tuple)) else [gold]
    np_ = normaliser_legende(pred, ve)
    for g in golds:
        ng = normaliser_legende(g, ve)
        if np_ == ng or difflib.SequenceMatcher(None, np_, ng).ratio() >= 0.8:
            return True
    return False


def section_analyse_image(args, rng, sortie, donnees):
    R.section(5, "ANALYSE D'IMAGES DE LEGENDE (Gemini vision)")
    try:
        import image_analysis_service as ias
        import voice_engine as ve
    except Exception as e:
        R.alerte(f"Import impossible : {e}")
        return
    R.info(f"Modele : {ias.MODELE_ANALYSE}")
    if not ias._cle_api():
        R.alerte("GEMINI_API_KEY absente du .env : section ignoree.")
        return
    dossier = donnees / "legende"
    verite = dossier / "verite.json"
    if not verite.exists():
        creer_modele_verite(dossier)
        R.alerte(f"Aucune verite terrain : creez {verite} (section non realisee, a indiquer dans le rapport).")
        R.info(f"Modele de fichier cree : {dossier / 'verite_exemple.json'}")
        R.info("Mettez 10 a 20 schemas numerotes (png/jpg) dans ce dossier, avec pour chacun la liste des "
               "bonnes legendes DANS L'ORDRE des numeros (une liste ['corps', 'tronc'] au lieu d'un mot = synonymes "
               "acceptes). Ajoutez 2-3 images SANS numeros avec \"reponse_correcte\": [] pour tester le refus.")
        return
    try:
        attendu = json.loads(verite.read_text(encoding="utf-8"))
    except Exception as e:
        R.alerte(f"{verite} illisible : {e}")
        return

    def similaire(pred, gold):
        return legendes_similaires(pred, gold, ve)

    pos_ok = pos_tot = tp = fp = fn = exact = couv_ok = couv_tot = 0
    reussis = positifs = negatifs = refus_ok = pannes = 0
    latences, intrus, lignes = [], [], []
    for nom, info in attendu.items():
        chemin = dossier / nom
        if not chemin.exists():
            R.info(f"Image absente, ignoree : {nom}")
            continue
        if GEM.credits_epuises:
            break
        gold = info.get("reponse_correcte") or []
        GEM.attendre()
        GEM.nb_appels += 1
        t0 = time.perf_counter()
        res, logs = capturer(ias.analyser_image_legende, image_en_data_uri(chemin), info.get("question", ""),
                             info.get("matiere", ""), str(info.get("niveau", "")), info.get("langue", "ar"))
        latences.append(time.perf_counter() - t0)
        if "Erreur 404" in logs:
            R.info(logs.strip()[:300])
            alerte_modele_vision()
            return
        if credit_epuise(logs):
            GEM.signaler_credits()
            R.alerte(MESSAGE_CREDITS)
            break
        if res is None and "pas confiant" not in logs:
            pannes += 1
            lignes.append([nom, "panne", f"echec technique, exclu des scores : {logs.strip()[:80]}"])
            continue
        if not gold:
            negatifs += 1
            refus_ok += int(res is None)
            lignes.append([nom, "negatif", "refus correct" if res is None else f"a invente : {res.get('reponse_correcte')}"])
            continue
        positifs += 1
        if res is None:
            fn += len(gold)
            pos_tot += len(gold)
            couv_tot += len(gold)
            lignes.append([nom, "positif", f"ECHEC ({logs.strip()[:80]})"])
            continue
        reussis += 1
        pred = [str(x) for x in res.get("reponse_correcte", [])]
        props = [str(x) for x in res.get("propositions", [])]
        for i, g in enumerate(gold):
            pos_tot += 1
            pos_ok += int(i < len(pred) and similaire(pred[i], g))
        restant = list(pred)
        for g in gold:
            m = next((p for p in restant if similaire(p, g)), None)
            if m is not None:
                tp += 1
                restant.remove(m)
            else:
                fn += 1
        fp += len(restant)
        exact += int(len(pred) == len(gold) and all(similaire(a, b) for a, b in zip(pred, gold)))
        for g in gold:
            couv_tot += 1
            couv_ok += int(any(similaire(p, g) for p in props))
        intrus.append(max(0, len(props) - len(pred)))
        lignes.append([nom, "positif", f"attendu={gold} predit={pred}"])

    if pannes:
        R.alerte(f"{pannes} image(s) exclue(s) des scores a cause d'une panne technique (quota, reseau, reponse "
                 "illisible) -- relancez plus tard ou augmentez --pause.")
    if not positifs and not negatifs:
        R.alerte("Aucune image exploitable.")
        return
    R.tableau(["Image", "Cas", "Resultat"], [[a, b, c[:100]] for a, b, c in lignes])
    if positifs < 15:
        R.alerte(f"Seulement {positifs} image(s) avec reperes : IC95 tres large (voir les intervalles). "
                 "Visez 15 a 20 schemas, dont des cas difficiles (reperes proches, schemas flous).")

    precision = tp / (tp + fp) if tp + fp else None
    rappel = tp / (tp + fn) if tp + fn else None
    if precision is not None and rappel is not None:
        f1 = 2 * precision * rappel / (precision + rappel) if precision + rappel else 0.0
    else:
        f1 = None
    if positifs:
        R.metrique("Taux d'analyse reussie", pct(reussis, positifs), "%", (90, 75, 50), n=positifs,
                   ic=(reussis, positifs),
                   definition="% d'images avec reperes pour lesquelles le modele renvoie une legende (pas None).",
                   bien="Le modele sait lire la plupart des schemas.",
                   mal="Le modele refuse ou echoue souvent : images trop floues ou reperes peu visibles ?")
        R.metrique("Exactitude positionnelle", pct(pos_ok, pos_tot), "%", (90, 75, 55), n=pos_tot, ic=(pos_ok, pos_tot),
                   definition="% de reperes dont la legende est correcte A LA BONNE POSITION (numero 1, 2, 3...). "
                              "Comparaison tolerante : article arabe, pluriel, synonymes de verite.json.",
                   bien="Les legendes sont dans le bon ordre : le corrige est utilisable tel quel.",
                   mal="Legendes justes mais mal ordonnees, ou fausses : le corrige serait faux pour l'eleve.")
        R.metrique("Precision des legendes", precision * 100 if precision is not None else None, "%", (90, 80, 60),
                   n=tp + fp, definition="Parmi les legendes proposees, % correctes (independamment de l'ordre).",
                   bien="Le modele invente peu de legendes fausses.", mal="Le modele propose des legendes fausses.")
        R.metrique("Rappel des legendes", rappel * 100 if rappel is not None else None, "%", (90, 80, 60), n=tp + fn,
                   definition="Parmi les legendes attendues, % retrouvees.",
                   bien="Le modele trouve presque tous les elements.", mal="Le modele oublie des elements.")
        R.metrique("F1-score des legendes", f1 * 100 if f1 is not None else None, "%", (90, 80, 60),
                   definition="Moyenne harmonique de la precision et du rappel.",
                   bien="Bon equilibre precision / rappel.", mal="Lecture d'image a ameliorer.")
        R.metrique("Exact match par image", pct(exact, positifs), "%", (80, 60, 40), n=positifs, ic=(exact, positifs),
                   definition="% d'images ou TOUTES les legendes sont justes et dans le bon ordre.",
                   bien="La plupart des questions sont directement exploitables.",
                   mal="Au moins une legende est souvent fausse.")
        R.metrique("Couverture de la banque de mots", pct(couv_ok, couv_tot), "%", (98, 90, 75), n=couv_tot,
                   definition="% des bonnes reponses presentes dans les 'propositions' donnees a l'eleve.",
                   bien="L'eleve a toujours les bons mots a sa disposition.",
                   mal="Des bonnes reponses manquent dans la banque : exercice impossible a reussir.")
        R.metrique("Nombre moyen d'intrus proposes", moyenne(intrus), "", decimales=2, n=len(intrus),
                   definition="Mots-pieges ajoutes a la banque (2 demandes par defaut).",
                   bien="Information : verifier que c'est proche de la valeur demandee (nb_intrus=2).")
    if negatifs:
        R.metrique("Specificite (refus correct sur images sans reperes)", pct(refus_ok, negatifs), "%", (95, 80, 60),
                   n=negatifs, ic=(refus_ok, negatifs),
                   definition="% d'images SANS reperes ou le modele refuse au lieu d'inventer une legende.",
                   bien="Le modele n'invente pas : il prefere dire qu'il ne sait pas.",
                   mal="Le modele invente des legendes sur des images inadaptees (hallucination).")
    R.metrique("Latence moyenne d'analyse", moyenne(latences), " s", (4, 8, 15), False, decimales=2, n=len(latences),
               definition="Temps moyen d'un appel d'analyse (hors pause anti-quota).",
               bien="Reponse rapide apres l'upload.", mal="Attente longue apres l'upload de l'image.")


PROMPTS_IMAGES = [
    ("trois pommes rouges posées sur une table", "three red apples on a table"),
    ("une plante avec sa racine, sa tige et ses feuilles", "a plant showing its roots, stem and leaves"),
    ("un chat qui dort sous une chaise", "a cat sleeping under a chair"),
    ("le cycle de l'eau : un nuage, de la pluie, une rivière et le soleil", "the water cycle with a cloud, rain, a river and the sun"),
    ("une horloge qui indique trois heures", "a clock showing three o'clock"),
    ("cinq oiseaux posés sur une branche", "five birds sitting on a branch"),
    ("un enfant qui se lave les mains avec du savon", "a child washing hands with soap"),
    ("un marché tunisien avec des fruits et des légumes", "a Tunisian market with fruits and vegetables"),
    ("un thermomètre qui indique une température élevée", "a thermometer showing a high temperature"),
    ("quatre crayons de couleurs différentes alignés", "four colored pencils in a row"),
    ("un papillon posé sur une fleur", "a butterfly on a flower"),
    ("une famille de trois personnes qui mange à table", "a family of three eating at a table"),
    ("une voiture arrêtée devant un feu rouge", "a car stopped at a red traffic light"),
    ("un poisson dans un aquarium", "a fish in an aquarium"),
    ("un livre ouvert posé sur un bureau", "an open book on a desk"),
]

PROMPT_JUGE_IMAGE = """Tu evalues une illustration generee par IA pour un exercice d'ecole primaire.
Description demandee : "<<DESC>>"

Reponds UNIQUEMENT avec ce JSON :
{"pertinence": 1-5 (l'image represente-t-elle fidelement la description ?),
 "elements_respectes": true/false (tous les elements demandes sont presents, avec les bonnes quantites),
 "texte_present": true/false (l'image contient-elle du texte, des mots ou des lettres superflus ? Les chiffres d'une horloge, d'une regle ou d'un calendrier demandes dans la description NE COMPTENT PAS),
 "cadrage_ok": true/false (le sujet est entier et bien cadre, SANS bandes grises ou colorees parasites, cadre, fond coupe ou grand vide inutile),
 "adaptee_enfants": 1-5 (style simple, clair, adapte a des enfants de 6 a 12 ans),
 "commentaire": "une phrase"}"""


def raison_echec(logs):
    l = logs.lower()
    if credit_epuise(l):
        return "credits Gemini epuises (a recharger)"
    if "image rejetee" in l:
        return "rejetee par la verification (toujours non conforme)"
    if "limit: 0" in l or "quota gratuit nul" in l:
        return "quota gratuit nul (facturation requise)"
    if "429" in l or "quota" in l:
        return "quota depasse (429)"
    if "finishreason" in l:
        return "refus / filtre de securite"
    if "reseau" in l:
        return "erreur reseau"
    if "absente" in l:
        return "cle API absente"
    if "erreur" in l:
        return "erreur API"
    return "autre"


def generer_images(args, image_service, dossier):
    resultats = []
    for i, (fr, en) in enumerate(PROMPTS_IMAGES[:args.nb_images], 1):
        print(f"  Image {i}/{args.nb_images} : « {fr} » ...", flush=True)
        GEM.attendre()
        t0 = time.perf_counter()
        uri, logs = capturer(image_service.generer_image, fr)
        lat = time.perf_counter() - t0
        rec = {"description": fr, "en": en, "latence": lat, "ok": bool(uri),
               "controle": dict(getattr(image_service, "DERNIERE_GENERATION", {}) or {})}
        if uri:
            m = re.match(r"^data:image/(\w+);base64,(.+)$", uri, re.S)
            ext = (m.group(1) if m else "png").replace("jpeg", "jpg")
            chemin = dossier / f"image_{i:02d}.{ext}"
            chemin.write_bytes(base64.b64decode(m.group(2) if m else uri.split(",", 1)[1]))
            rec["chemin"] = str(chemin)
            rec["uri"] = uri
            print(col(f"      OK en {lat:.1f}s -> {chemin.name}", GRIS))
        else:
            rec["raison"] = raison_echec(logs)
            print(col(f"      ECHEC ({rec['raison']}) : {logs.strip()[:150]}", JAUNE))
            if credit_epuise(logs):
                GEM.signaler_credits()
                resultats.append(rec)
                break
        resultats.append(rec)
    return resultats


def metriques_controle_images(resultats):
    controles = [r["controle"] for r in resultats if r.get("controle", {}).get("statut")]
    indispo = [c for c in controles if c["statut"] == "verification_indisponible"]
    if indispo:
        R.alerte(f"{len(indispo)} image(s) sans verification (modele vision indisponible) : exclues des taux de conformite.")
        if VISION_404:
            alerte_modele_vision()
    controles = [c for c in controles if c["statut"] not in ("verification_indisponible", "echec_generation")]
    if not controles or not any(c["statut"] != "non_verifiee" for c in controles):
        return
    R.sous_titre("Verification automatique des images (image_service.verifier_image)")
    statuts = Counter(c["statut"] for c in controles)
    R.tableau(["Statut", "Nombre"], [[k, v] for k, v in statuts.most_common()])
    n = len(controles)
    k1 = statuts.get("conforme", 0)
    R.metrique("Images conformes des la 1re generation", pct(k1, n), "%", (90, 75, 50), n=n, ic=(k1, n),
               definition="% d'images jugees conformes par la verification sans regeneration.",
               bien="Le modele d'image dessine juste du premier coup.",
               mal="Le modele d'image se trompe souvent : la verification est indispensable.")
    kc = statuts.get("conforme_apres_correction", 0)
    R.metrique("Images corrigees par regeneration", pct(kc, n), "%", n=n, ic=(kc, n),
               definition="% d'images fausses au 1er essai puis reussies apres regeneration.",
               bien="Information : part des erreurs rattrapees automatiquement.")
    kr = statuts.get("rejetee", 0)
    R.metrique("Images rejetees (pas d'image affichee)", pct(kr, n), "%", (5, 15, 30), False, n=n, ic=(kr, n),
               definition="% de descriptions pour lesquelles aucune image conforme n'a ete obtenue.",
               bien="Presque toutes les questions gardent une image correcte.",
               mal="Beaucoup de questions perdent leur image : simplifier les descriptions.")
    R.metrique("Nombre moyen de generations par image", moyenne([c.get("generations", 1) for c in controles]), "",
               (1.2, 1.6, 2.2), False, decimales=2, n=n,
               definition="Cout reel : chaque generation est facturee.",
               bien="Surcout faible.", mal="Surcout notable en appels factures.")
    R.alerte("Biais : le juge de qualite ci-dessous utilise le MEME modele vision que la verification. "
             "Son score est en partie mecanique ; il reste indicatif.")


def juger_images(ok):
    R.sous_titre("Qualite des images (juge Gemini vision)")
    notes = []
    for r in ok:
        if GEM.credits_epuises:
            break
        d = appel_vision(PROMPT_JUGE_IMAGE.replace("<<DESC>>", r["description"]), r["uri"])
        if isinstance(d, dict):
            r["juge"] = d
            notes.append(d)
    if not notes:
        R.alerte("Le juge vision n'a renvoye aucune note (voir les messages 'juge vision' ci-dessus).")
        if VISION_404:
            alerte_modele_vision()
        return
    v, n = moyenne_cle(notes, "pertinence")
    R.metrique("Pertinence image / description", v, "/5", (4.5, 4.0, 3.0), decimales=2, n=n,
               definition="Note (1-5) : l'image represente-t-elle fidelement ce qui etait demande ?",
               bien="Les images illustrent bien les questions.", mal="Images souvent a cote du sujet.")
    R.metrique("Elements et quantites respectes",
               pct(sum(1 for d in notes if vrai(d.get("elements_respectes"))), len(notes)), "%", (90, 75, 50),
               n=len(notes),
               definition="% d'images ou tous les elements demandes sont presents, en bon nombre.",
               bien="Les details importants (quantites, elements) sont respectes.",
               mal="Quantites ou elements faux : dangereux pour les exercices de calcul / legende.")
    R.metrique("Images sans texte incruste",
               pct(sum(1 for d in notes if not vrai(d.get("texte_present"))), len(notes)), "%", (95, 85, 70),
               n=len(notes),
               definition="% d'images qui respectent la consigne « aucun texte dans l'image ».",
               bien="La consigne anti-texte est respectee.",
               mal="Du texte (souvent deforme) apparait malgre la consigne.")
    cad = [d for d in notes if d.get("cadrage_ok") is not None]
    R.metrique("Cadrage correct (sujet entier, sans bandes parasites)",
               pct(sum(1 for d in cad if vrai(d.get("cadrage_ok"))), len(cad)), "%", (90, 75, 50), n=len(cad),
               definition="% d'images dont le sujet est entier, sans bande parasite ni fond coupe (juge Gemini vision).",
               bien="Les images sont directement utilisables dans un examen.",
               mal="Des images ont un cadrage defectueux (bandes, sujet coupe) : a verifier a l'oeil.")
    rates = [r for r in ok if isinstance(r.get("juge"), dict) and r["juge"].get("cadrage_ok") is not None
             and not vrai(r["juge"].get("cadrage_ok"))
             and r.get("controle", {}).get("statut") in ("conforme", "conforme_apres_correction")]
    if rates:
        R.alerte(f"{len(rates)} image(s) jugee(s) conforme(s) par verifier_image mais au cadrage defectueux "
                 "selon le juge : la verification ne controle pas le cadrage (ajouter « fond uniforme, sujet "
                 "entier, sans bandes » dans son prompt, dans image_service.py).")
        for r in rates:
            print(col(f"      cadrage a verifier : {Path(r.get('chemin', '?')).name} -- « {r['description']} »", GRIS))
    v, n = moyenne_cle(notes, "adaptee_enfants")
    R.metrique("Adaptation au jeune public", v, "/5", (4.5, 4.0, 3.0), decimales=2, n=n,
               definition="Note (1-5) : style simple, clair, adapte a des enfants de 6-12 ans.",
               bien="Style adapte a l'ecole primaire.", mal="Style trop complexe ou inadapte.")


def vision_sur_generees(ok):
    import image_analysis_service as ias
    R.sous_titre("Vision sur images generees (sans reperes : le modele doit refuser)")
    refus = pannes = 0
    for r in ok:
        if GEM.credits_epuises:
            pannes += 1
            continue
        GEM.attendre()
        GEM.nb_appels += 1
        res, logs = capturer(ias.analyser_image_legende, r["uri"], "Légende les éléments.", "science", "3", "fr")
        if "Erreur 404" in logs:
            alerte_modele_vision()
            return
        if credit_epuise(logs):
            GEM.signaler_credits()
            pannes += 1
            continue
        if res is None and "pas confiant" in logs:
            refus += 1
        elif res is None:
            pannes += 1
    n = len(ok) - pannes
    if pannes:
        R.alerte(f"{pannes} image(s) exclue(s) de cette mesure (panne technique ou credits epuises) : "
                 "relancez apres recharge.")
    R.metrique("Refus correct sur images generees sans reperes", pct(refus, n), "%", (95, 80, 60), n=n,
               ic=(refus, n),
               definition="% d'images generees (sans numeros) sur lesquelles la vision refuse de legender au lieu d'inventer.",
               bien="Pas d'hallucination de legendes.", mal="La vision invente des legendes sur des images sans reperes.")


def calculer_clip(ok):
    R.sous_titre("CLIPScore (similarite texte-image, modele CLIP d'OpenAI)")
    try:
        import torch
        from PIL import Image
        from transformers import CLIPModel, CLIPProcessor
        modele = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        proc = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        scores = []
        for r in ok:
            entree = proc(text=[r["en"]], images=Image.open(r["chemin"]).convert("RGB"), return_tensors="pt",
                          padding=True, truncation=True)
            with torch.no_grad():
                out = modele(**entree)
            a = out.image_embeds / out.image_embeds.norm(dim=-1, keepdim=True)
            b = out.text_embeds / out.text_embeds.norm(dim=-1, keepdim=True)
            scores.append(max(0.0, 100.0 * float((a * b).sum())))
        R.metrique("CLIPScore moyen", moyenne(scores), "", (32, 28, 24), decimales=1, n=len(scores),
                   definition="100 x cosinus entre l'embedding CLIP de l'image et celui de la description (en anglais). "
                              "Valeurs typiques : 25-35.",
                   bien="Forte correspondance texte-image.", mal="Faible correspondance texte-image.")
    except Exception as e:
        R.alerte(f"CLIPScore non calcule ({e}). pip install torch transformers pillow")


def section_generation_image(args, rng, sortie, donnees):
    R.section(6, "GENERATION D'IMAGES (modele du .env)")
    try:
        import image_service
    except Exception as e:
        R.alerte(f"Import de image_service impossible : {e}")
        return
    R.info(f"Modele : {image_service.MODELE_IMAGE}")
    if not image_service._cle_api():
        R.alerte("GEMINI_API_KEY absente du .env : section ignoree.")
        return
    R.alerte("Les modeles d'image peuvent etre factures (pas de quota gratuit selon le modele) : "
             f"{args.nb_images} images seront generees (option --nb-images).")
    dossier = sortie / "images_generees"
    dossier.mkdir(parents=True, exist_ok=True)

    resultats = generer_images(args, image_service, dossier)
    ok = [r for r in resultats if r["ok"]]
    R.metrique("Taux de generation reussie", pct(len(ok), len(resultats)), "%", (95, 80, 50), n=len(resultats),
               ic=(len(ok), len(resultats)),
               definition="% de descriptions pour lesquelles une image est effectivement renvoyee.",
               bien="Le service d'image est fiable.",
               mal="Beaucoup d'echecs : voir la repartition des causes ci-dessous.")
    echecs = Counter(r["raison"] for r in resultats if not r["ok"])
    if echecs:
        R.info("Causes des echecs :")
        R.tableau(["Cause", "Nombre"], [[k, v] for k, v in echecs.most_common()])
    if not ok:
        R.alerte("Aucune image generee : metriques de qualite non calculables.")
        return

    R.metrique("Latence moyenne de generation", moyenne([r["latence"] for r in ok]), " s", (8, 15, 30), False,
               n=len(ok), decimales=1,
               definition="Temps moyen pour obtenir une image (retries, verification et regenerations compris).",
               bien="Generation rapide.", mal="Generation lente : prevoir un indicateur de chargement.")

    metriques_controle_images(resultats)
    if not args.sans_juge:
        juger_images(ok)
    if args.vision_sur_generees:
        vision_sur_generees(ok)
    if args.clip:
        calculer_clip(ok)

    (sortie / "images_generees.json").write_text(json.dumps(
        [{k: v for k, v in r.items() if k != "uri"} for r in resultats], ensure_ascii=False, indent=2),
        encoding="utf-8")
    R.info(f"Images enregistrees dans {dossier}.")


QUESTIONS_ASSISTANT = [
    ("كيف أشرح الكسور لتلاميذ السنة الرابعة؟", "ar"),
    ("ما هي أفضل طريقة لتعليم القراءة للمبتدئين؟", "ar"),
    ("اقترح علي نشاطا حول دورة الماء للسنة الخامسة", "ar"),
    ("كيفاش نعاون تلميذ عندو صعوبات في الحساب؟", "ar"),
    ("كيف أصحح فرض الإيقاظ العلمي بسرعة؟", "ar"),
    ("ما الفرق بين QCM والسؤال المفتوح؟", "ar"),
    ("Comment expliquer la photosynthèse simplement ?", "fr"),
    ("Donne-moi une idée d'activité sur les fractions.", "fr"),
    ("Comment motiver un élève qui n'aime pas lire ?", "fr"),
    ("Quelle est la différence entre un nom et un adjectif ?", "fr"),
]


def respecte_mode_vocal(texte):
    if re.search(r"(^|\n)\s*(#|[-*+] |\d+\. )|\*\*|\|", texte):
        return False
    phrases = [p for p in re.split(r"[.!?؟]+", texte) if p.strip()]
    return len(phrases) <= 6


def section_assistant(args, rng, sortie, donnees):
    R.section(7, "ASSISTANT : COMPREHENSION ET REPONSE DANS LA LANGUE DE L'ENSEIGNANT")
    try:
        import assistant_engine as ae
        import voice_engine as ve
    except Exception as e:
        R.alerte(f"Import de assistant_engine impossible : {e}")
        return
    GEM.brancher()
    if GEM.generate is None:
        R.alerte("Gemini indisponible : section ignoree.")
        return
    correction_dispo = hasattr(ae, "_corriger_langue")
    brutes = {}
    original = None
    if correction_dispo:
        original = ae._corriger_langue

        def espion(reponse, langue):
            brutes["derniere"] = reponse
            return original(reponse, langue)

        ae._corriger_langue = espion
    else:
        R.info("Ancienne version d'assistant_engine.py (sans filet de traduction) : mesure de la version actuelle.")

    nb_ar = sum(1 for _, l in QUESTIONS_ASSISTANT if l == "ar")
    nb_fr = sum(1 for _, l in QUESTIONS_ASSISTANT if l == "fr")
    R.info(f"{len(QUESTIONS_ASSISTANT)} questions posees en MODE VOCAL ({nb_ar} en arabe dont darija, {nb_fr} en francais).")
    res = []
    try:
        for k, (q, langue) in enumerate(QUESTIONS_ASSISTANT, 1):
            if GEM.credits_epuises:
                break
            brutes.clear()
            depart = GEM.chrono()
            try:
                rep = capturer(ae.repondre, q, None, mode_vocal=True)[0]
            except Exception as e:
                print(col(f"      {k}. echec : {str(e)[:120]}", JAUNE))
                if credit_epuise(e):
                    GEM.signaler_credits()
                    break
                continue
            lat = GEM.duree(depart)
            brute = brutes.get("derniere", rep)
            if credit_epuise(rep):
                GEM.signaler_credits()
                break
            r = {"question": q, "attendue": langue, "finale": ve.detecter_langue(rep),
                 "brute": ve.detecter_langue(brute), "vocal": respecte_mode_vocal(rep), "latence": lat, "reponse": rep}
            res.append(r)
            traduite = " (traduite)" if r["brute"] != r["finale"] else ""
            print(col(f"      {k}. [{langue}] -> {r['finale']}{traduite} {lat:.1f}s : {rep[:90]}", GRIS), flush=True)
    finally:
        if correction_dispo:
            ae._corriger_langue = original

    if GEM.credits_epuises:
        R.alerte(MESSAGE_CREDITS)
    if not res:
        R.alerte("Aucune reponse obtenue.")
        return
    for langue, nom in (("ar", "arabe"), ("fr", "francais")):
        lst = [r for r in res if r["attendue"] == langue]
        if not lst:
            continue
        ok = sum(1 for r in lst if r["finale"] == langue)
        R.metrique(f"[{langue}] Reponses dans la bonne langue", pct(ok, len(lst)), "%", (100, 90, 75), n=len(lst),
                   ic=(ok, len(lst)),
                   definition=f"% de questions posees en {nom} auxquelles l'assistant repond en {nom} (reponse finale).",
                   bien=f"L'assistant repond toujours en {nom}.",
                   mal=f"L'assistant repond parfois dans l'autre langue a une question en {nom}.")
        if correction_dispo:
            ok_b = sum(1 for r in lst if r["brute"] == langue)
            R.metrique(f"[{langue}] Bonne langue des la 1re reponse de Gemini", pct(ok_b, len(lst)), "%",
                       (100, 90, 75), n=len(lst), ic=(ok_b, len(lst)),
                       definition="% de reponses deja dans la bonne langue AVANT le filet de traduction automatique.",
                       bien="Le prompt suffit : la traduction de secours n'est presque jamais utilisee.",
                       mal="Gemini se trompe souvent de langue : c'est le filet de traduction qui corrige.")
    okv = sum(1 for r in res if r["vocal"])
    R.metrique("Respect du format vocal", pct(okv, len(res)), "%", (95, 85, 70), n=len(res), ic=(okv, len(res)),
               definition="% de reponses lisibles a voix haute : pas de markdown, de tableau ni de liste, 6 phrases au plus.",
               bien="Les reponses sont faites pour etre ecoutees.",
               mal="Des reponses contiennent du markdown ou sont trop longues pour l'oral.")
    R.metrique("Latence moyenne de reponse", moyenne([r["latence"] for r in res]), " s", (3, 6, 10), False,
               n=len(res),
               definition="Temps entre la question et la reponse texte (pause anti-quota exclue ; traduction de secours comprise).",
               bien="Conversation fluide.", mal="Attente perceptible avant la reponse.")
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / "assistant_reponses.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    R.info(f"Reponses completes : {sortie / 'assistant_reponses.json'}")


def section_e2e(args, rng, sortie, donnees):
    """Bout en bout : texte -> voix de synthese -> whisper -> comprehension. Mesure ce que l'ASR fait perdre au SLU."""
    R.section(8, "BOUT EN BOUT : VOIX -> TRANSCRIPTION -> COMPREHENSION (ASR + SLU)")
    try:
        import voice_engine as ve
    except Exception as e:
        R.alerte(f"Import de voice_engine impossible : {e}")
        return
    try:
        jeu_test, _ = charger_jeu_test(donnees, ve)
    except Exception:
        jeu_test = []
    jeu = list(JEU_SLU_VALIDATION) + list(jeu_test)
    nb = min(args.nb_e2e, len(jeu))
    jeu = rng.sample(jeu, nb)
    mode = "hybride" if args.e2e_ia else "regles"
    R.alerte("Audio SYNTHETIQUE (edge-tts) : voix propre, sans bruit ni accent. Score OPTIMISTE et indicatif ; "
             "pour un vrai score, refaites ce test avec des enregistrements humains.")
    R.info(f"{nb} enonces (VALIDATION + TEST), comprehension en mode '{mode}' "
           "(--e2e-ia pour inclure Gemini ; defaut : regles seules, sans quota).")

    try:
        charger_whisper(ve)
    except Exception as e:
        R.alerte(f"faster-whisper indisponible : {e} -- installez-le : pip install faster-whisper")
        return
    dossier = sortie / "audio_e2e"
    dossier.mkdir(parents=True, exist_ok=True)

    paires, resultats, pannes = [], [], 0
    for k, (texte, langue, intention, params) in enumerate(jeu, 1):
        chemin = dossier / f"{k:02d}_{langue}.mp3"
        try:
            mp3 = ve.synthetiser(texte, langue)
            if not mp3:
                raise RuntimeError("synthese vide")
            chemin.write_bytes(mp3)
            r, _ = transcrire_fichier(ve, chemin, langue)
        except Exception as ex:
            pannes += 1
            print(col(f"      {k}/{nb} echec : {str(ex)[:100]}", JAUNE))
            continue
        hyp = r.get("texte", "")
        p_txt = predire_slu(ve, mode, texte, langue)
        p_asr = predire_slu(ve, mode, hyp, langue)
        paires.append((texte, hyp))
        resultats.append({"texte": texte, "hyp": hyp, "langue": langue, "attendu": intention, "params": params,
                          "txt": p_txt, "asr": p_asr})
        print(col(f"      {k}/{nb} [{langue}] {hyp[:70]}", GRIS), flush=True)

    if pannes:
        R.alerte(f"{pannes} enonce(s) exclu(s) (synthese ou transcription en echec).")
    if not resultats:
        R.alerte("Aucun enonce exploitable : section non mesuree.")
        return

    n = len(resultats)
    w, c, det = wer_cer(paires, ve)
    R.metrique("[bout en bout] WER sur les commandes", w, "%", (12, 25, 40), False, n=n,
               definition="WER whisper sur les enonces de commande (voix de synthese).",
               bien="Les commandes sont bien transcrites.", mal="Les commandes sont souvent mal transcrites.")
    afficher_pires("Pires transcriptions :", det)

    acc_txt = sum(1 for r in resultats if r["txt"].get("intention") == r["attendu"])
    acc_asr = sum(1 for r in resultats if r["asr"].get("intention") == r["attendu"])
    R.metrique("[bout en bout] Intention comprise depuis le TEXTE (reference)", pct(acc_txt, n), "%", (95, 85, 70),
               n=n, ic=(acc_txt, n),
               definition="Intention correcte quand le SLU recoit le texte exact (plafond atteignable).",
               bien="Point de comparaison.", mal="Le SLU se trompe deja sur du texte propre.")
    R.metrique("[bout en bout] Intention comprise depuis la VOIX", pct(acc_asr, n), "%", (95, 85, 70),
               n=n, ic=(acc_asr, n),
               definition="Intention correcte apres synthese vocale + transcription whisper + SLU (chaine complete).",
               bien="La chaine vocale complete comprend bien l'enseignant.",
               mal="Les erreurs de transcription font deraper la comprehension.")

    def exact(r, cle):
        return trame_exacte(r["attendu"], r["params"], r[cle].get("intention"), r[cle].get("parametres") or {})

    em_txt = sum(1 for r in resultats if exact(r, "txt"))
    em_asr = sum(1 for r in resultats if exact(r, "asr"))
    R.metrique("[bout en bout] Exact match depuis la VOIX (intention + parametres)", pct(em_asr, n), "%",
               (90, 75, 50), n=n, ic=(em_asr, n),
               definition="% de commandes entierement comprises (intention + tous les parametres) apres la chaine vocale.",
               bien="La commande vocale est comprise entierement.",
               mal="Parametres souvent faux apres transcription (niveau, nombre de questions...).")
    R.metrique("[bout en bout] Perte d'exact match due a la transcription", pct(em_txt - em_asr, n), " pts", n=n,
               definition="Exact match depuis le texte moins exact match depuis la voix.",
               bien="Information : la part des erreurs causee par whisper et non par les regles.")

    for langue, nom in (("fr", "francais"), ("ar", "arabe")):
        sous = [r for r in resultats if r["langue"] == langue]
        if sous:
            k_ok = sum(1 for r in sous if exact(r, "asr"))
            R.metrique(f"[bout en bout/{langue}] Exact match depuis la voix ({nom})", pct(k_ok, len(sous)), "%",
                       (90, 75, 50), n=len(sous), ic=(k_ok, len(sous)),
                       definition=f"Exact match de la chaine complete sur les commandes en {nom}.",
                       bien="Bonne comprehension vocale dans cette langue.",
                       mal="Comprehension vocale fragile dans cette langue.")

    casses = [r for r in resultats if exact(r, "txt") and not exact(r, "asr")]
    if casses:
        print()
        R.info(f"Commandes comprises depuis le texte mais PAS depuis la voix ({len(casses)}) :")
        for r in casses[:12]:
            print(col(f"      dit : « {r['texte']} »", GRIS))
            print(col(f"      entendu : « {r['hyp']} »  -> {r['asr'].get('intention')} "
                      f"{r['asr'].get('parametres') or {}}  (attendu {r['attendu']} {r['params']})", GRIS))
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / "e2e_resultats.json").write_text(json.dumps(resultats, ensure_ascii=False, indent=2, default=str),
                                               encoding="utf-8")


SECTIONS = {
    1: section_quiz,
    2: section_slu,
    3: section_asr,
    4: section_tts,
    5: section_analyse_image,
    6: section_generation_image,
    7: section_assistant,
    8: section_e2e,
}


def construire_parser():
    ap = argparse.ArgumentParser(description="Evaluation automatique des modeles d'IA du projet.")
    ap.add_argument("--sections", default="1,2,3,4,5,6,7,8",
                    help="sections a lancer, ex: 1,2,3 (defaut : toutes)")
    ap.add_argument("--nb-quiz", type=int, default=40, help="nombre de quiz a generer (section 1, defaut 40)")
    ap.add_argument("--nb-rag", type=int, default=80, help="nombre de requetes de test RAG (defaut 80)")
    ap.add_argument("--k", type=int, default=5, help="nombre de resultats RAG demandes (defaut 5)")
    ap.add_argument("--mots-extrait", type=int, default=40, help="longueur des extraits du test RAG (defaut 40)")
    ap.add_argument("--rag-hybride", action="store_true", help="evalue aussi la recherche hybride BM25 + vecteurs")
    ap.add_argument("--nb-images", type=int, default=12,
                    help=f"nombre d'images a generer (section 6, defaut 12, max {len(PROMPTS_IMAGES)})")
    ap.add_argument("--vision-sur-generees", action="store_true",
                    help="section 6 : teste le refus de la vision sur les images generees (sans reperes)")
    ap.add_argument("--nb-e2e", type=int, default=40,
                    help="section 8 : nombre d'enonces du test de bout en bout (defaut 40)")
    ap.add_argument("--e2e-ia", action="store_true",
                    help="section 8 : utilise aussi Gemini pour la comprehension (consomme du quota)")
    ap.add_argument("--pause", type=float, default=13,
                    help="pause minimale entre 2 appels Gemini en secondes (defaut 13 = niveau gratuit ; 0 si compte payant)")
    ap.add_argument("--whisper", default=None, help="force WHISPER_MODEL (ex: small, medium)")
    ap.add_argument("--sans-juge", action="store_true", help="desactive les evaluations par LLM juge")
    ap.add_argument("--slu-ia-pure", action="store_true", help="evalue aussi Gemini seul sur tout le jeu SLU")
    ap.add_argument("--asr-synthetique", action="store_true",
                    help="section 3 : accepte les voix de synthese si aucun enregistrement reel (scores indicatifs)")
    ap.add_argument("--quiz-avec-images", action="store_true", help="garde la generation d'images pendant la section 1")
    ap.add_argument("--clip", action="store_true", help="calcule aussi le CLIPScore (torch + transformers requis)")
    ap.add_argument("--seed", type=int, default=42, help="graine aleatoire (resultats reproductibles)")
    ap.add_argument("--donnees", default=str(BACKEND / "eval_data"), help="dossier des donnees de test")
    ap.add_argument("--sortie", default=str(BACKEND / "eval_resultats"), help="dossier des resultats")
    ap.add_argument("--sans-couleur", action="store_true", help="desactive les couleurs dans la console")
    return ap


def afficher_entete(choix, donnees, sortie, args):
    print(col("=" * 80, GRAS))
    print(col(" EVALUATION DES MODELES D'IA", GRAS))
    print(col("=" * 80, GRAS))
    print(f"  Sections       : {choix}")
    print(f"  Donnees test   : {donnees}")
    print(f"  Resultats      : {sortie}")
    print(f"  Pause Gemini   : {args.pause}s entre deux appels")
    if args.whisper:
        print(f"  Modele whisper : {args.whisper}")
    print(col("  Legende des niveaux : EXCELLENT > BON > MOYEN > FAIBLE (seuils indiques sous chaque metrique)", GRIS))
    print(col("  [IC95 a-b%] = intervalle de confiance a 95 % (Wilson) : avec peu d'exemples, le vrai score peut etre "
              "n'importe ou dans cet intervalle.", GRIS))


def main():
    global UTILISER_COULEURS
    ap = construire_parser()
    args = ap.parse_args()
    args.nb_images = max(0, min(args.nb_images, len(PROMPTS_IMAGES)))
    UTILISER_COULEURS = not args.sans_couleur
    if args.whisper:
        os.environ["WHISPER_MODEL"] = args.whisper

    try:
        choix = sorted({int(x) for x in args.sections.split(",") if x.strip()})
    except ValueError:
        ap.error("--sections attend une liste de nombres, ex: 1,2,3")

    sortie, donnees = Path(args.sortie), Path(args.donnees)
    sortie.mkdir(parents=True, exist_ok=True)
    donnees.mkdir(parents=True, exist_ok=True)
    GEM.pause = args.pause

    afficher_entete(choix, donnees, sortie, args)
    GEM.installer()

    try:
        for num in choix:
            fonction = SECTIONS.get(num)
            if fonction is None:
                print(col(f"Section inconnue : {num}", JAUNE))
                continue
            try:
                fonction(args, random.Random(args.seed + num), sortie, donnees)
            except KeyboardInterrupt:
                raise
            except Exception as e:
                R.alerte(f"Erreur inattendue dans la section {num} : {e}")
                traceback.print_exc()
    except KeyboardInterrupt:
        print(col("\nInterrompu par l'utilisateur -- sauvegarde des resultats partiels.", JAUNE))

    R.resume_final()
    R.sauvegarder(sortie, {"appels_gemini": GEM.nb_appels, "erreurs_gemini": GEM.nb_erreurs,
                           "parametres": dict(vars(args))})
    print()
    print(f"  Appels Gemini effectues : {GEM.nb_appels} (erreurs : {GEM.nb_erreurs})")
    if GEM.credits_epuises:
        print(col(f"  !  {MESSAGE_CREDITS}", JAUNE))
    print(f"  Rapport sauvegarde : {sortie / 'rapport_evaluation.md'}  et  {sortie / 'rapport_evaluation.json'}")


if __name__ == "__main__":
    main()