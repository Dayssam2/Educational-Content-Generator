

import base64
import binascii
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Header, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import database as db
import auth
import email_service
import google_auth
import quiz_engine
import pdf_quiz_engine
import assistant_engine
import image_analysis_service
import validation as validation_engine
import pdf_export

app = FastAPI(title="ExamAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    db.init_db()


@app.on_event("shutdown")
def _shutdown():
    db.fermer_pool()


MATIERES_VALIDES = ["mathematique", "arabe", "science", "francais", "histoire_geo"]
NIVEAUX_VALIDES = ["1", "2", "3", "4", "5", "6"]



def _email_valide(email: str) -> bool:
    email = (email or "").strip()
    if "@" not in email or len(email) > 254:
        return False
    domaine = email.split("@")[-1]
    return "." in domaine and len(domaine) > 2


class SignupIn(BaseModel):
    email: str
    password: str
    nom: str
    genre: str = "femme"


class LoginIn(BaseModel):
    email: str
    password: str


class GoogleAuthIn(BaseModel):
    access_token: str
    genre: str = "femme"


class ForgotPasswordIn(BaseModel):
    email: str


class ResetPasswordIn(BaseModel):
    email: str
    code: str
    nouveau_password: str


CODE_RESET_DUREE_MINUTES = 15
CODE_RESET_TENTATIVES_MAX = 5
CODE_RESET_COOLDOWN_SECONDES = 60


class UserOut(BaseModel):
    id: int
    email: str
    nom: str
    genre: str


def _user_out(row: dict) -> UserOut:
    return UserOut(id=row["id"], email=row["email"], nom=row["nom"], genre=row["genre"])


def get_user_id(authorization: Optional[str] = Header(None)) -> int:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Non connecte")
    token = authorization.split(" ", 1)[1].strip()
    user_id = db.get_user_id_par_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expiree, reconnecte-toi")
    return user_id


@app.post("/api/auth/signup")
def signup(payload: SignupIn):
    if not _email_valide(payload.email):
        raise HTTPException(status_code=400, detail="Email invalide")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caracteres")
    if not payload.nom.strip():
        raise HTTPException(status_code=400, detail="Le nom est obligatoire")
    if db.get_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail="Un compte existe deja avec cet email")

    genre = payload.genre if payload.genre in db.GENRES_VALIDES else "femme"
    user_id = db.creer_user(payload.email, auth.hash_password(payload.password), payload.nom, genre)
    token = auth.generer_token()
    db.creer_token(token, user_id)
    return {"token": token, "user": _user_out(db.get_user_by_id(user_id))}


@app.post("/api/auth/login")
def login(payload: LoginIn):
    user = db.get_user_by_email(payload.email)
    if not user or not auth.verifier_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = auth.generer_token()
    db.creer_token(token, user["id"])
    return {"token": token, "user": _user_out(user)}


@app.post("/api/auth/google")
def auth_google(payload: GoogleAuthIn):
    """'S'inscrire avec Google' / 'Se connecter avec Google' -- une seule
    route pour les deux cas, comme Google lui-meme le recommande : on
    cree le compte au premier passage, on connecte simplement ensuite.

    Le frontend obtient un access_token via Google Identity Services
    (popup de connexion Google cote navigateur) et nous l'envoie. On ne
    fait JAMAIS confiance a un nom/email envoye directement par le
    frontend : verifier_et_recuperer_profil() redemande le profil a
    Google avec ce jeton pour s'assurer qu'il est authentique."""
    try:
        profil = google_auth.verifier_et_recuperer_profil(payload.access_token)
    except google_auth.GoogleAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    if not profil["email_verified"]:
        raise HTTPException(status_code=400, detail="L'email de ce compte Google n'est pas verifie")

    user = db.get_user_by_google_id(profil["google_id"])
    if not user:
        user = db.get_user_by_email(profil["email"])
        if user:
            # Un compte existe deja avec cet email (cree via inscription
            # classique) : on le rattache a Google plutot que de creer un
            # deuxieme compte en double avec la meme adresse.
            db.lier_google_id(user["id"], profil["google_id"])
            user = db.get_user_by_id(user["id"])
        else:
            genre = payload.genre if payload.genre in db.GENRES_VALIDES else "femme"
            # Personne ne connait ce mot de passe (jeton aleatoire hache) :
            # le compte n'est utilisable qu'via Google, a moins que
            # l'utilisateur ne passe un jour par "mot de passe oublie"
            # pour s'en definir un.
            mot_de_passe_desactive = auth.hash_password(auth.generer_token())
            user_id = db.creer_user(
                profil["email"], mot_de_passe_desactive, profil["nom"], genre,
                google_id=profil["google_id"],
            )
            user = db.get_user_by_id(user_id)

    token = auth.generer_token()
    db.creer_token(token, user["id"])
    return {"token": token, "user": _user_out(user)}


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordIn):
    """Etape 1 du flux "mot de passe oublie" : envoie un code a 6 chiffres
    par email si le compte existe. Renvoie TOUJOURS le meme message, que
    l'email corresponde a un compte ou non -- sinon cette route servirait
    a deviner quels emails sont inscrits (enumeration de comptes)."""
    reponse = {
        "ok": True,
        "message": "Si un compte existe avec cet email, un code de reinitialisation vient d'etre envoye.",
    }

    user = db.get_user_by_email(payload.email)
    if not user:
        return reponse

    if db.code_reset_recent(user["id"], CODE_RESET_COOLDOWN_SECONDES):
        # Anti-spam : un code recent existe deja, on n'en renvoie pas un
        # nouveau -- mais on repond quand meme normalement au client.
        return reponse

    code = auth.generer_code_reset()
    expire_at = (
        datetime.now(timezone.utc) + timedelta(minutes=CODE_RESET_DUREE_MINUTES)
    ).isoformat()
    db.creer_code_reset(user["id"], auth.hash_code(code), expire_at)

    try:
        email_service.envoyer_code_reset(user["email"], code, user["nom"])
    except Exception as e:
        # Meme raison que ci-dessus : ne jamais remonter le detail au
        # client. On log cote serveur pour pouvoir diagnostiquer un
        # probleme de configuration SMTP.
        print(f"[auth] Echec d'envoi de l'email de reinitialisation : {e}")

    return reponse


@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordIn):
    """Etape 2 : verifie le code recu par email et change le mot de
    passe. Reinitialise aussi toutes les sessions en cours (voir
    supprimer_tokens_user) au cas ou le compte aurait ete compromis."""
    if len(payload.nouveau_password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caracteres")

    user = db.get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=400, detail="Code invalide ou expire")

    ligne = db.get_code_reset_actif(user["id"])
    if not ligne:
        raise HTTPException(status_code=400, detail="Code invalide ou expire")

    if ligne["tentatives"] >= CODE_RESET_TENTATIVES_MAX:
        raise HTTPException(status_code=429, detail="Trop de tentatives, demande un nouveau code")

    if not auth.verifier_code(payload.code, ligne["code_hash"]):
        db.incrementer_tentative_code(ligne["id"])
        raise HTTPException(status_code=400, detail="Code invalide ou expire")

    db.marquer_code_utilise(ligne["id"])
    db.modifier_password(user["id"], auth.hash_password(payload.nouveau_password))
    db.supprimer_tokens_user(user["id"])
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        db.supprimer_token(authorization.split(" ", 1)[1].strip())
    return {"ok": True}


@app.get("/api/auth/me", response_model=UserOut)
def me(user_id: int = Depends(get_user_id)):
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return _user_out(user)


# =========================================================================
# Assistant conversationnel (page Assistant / lien "Aide" du frontend)
# =========================================================================

class AssistantChatIn(BaseModel):
    message: str
    # Liste de {"role": "user"|"assistant", "contenu": "..."} -- envoyee
    # par le frontend a CHAQUE appel (voir Assistant.jsx:envoyer(), qui
    # reconstruit `historique_` depuis son state React). AUCUN historique
    # n'est persiste cote backend (voir assistant_engine.py) : c'est
    # normal et voulu, pas un oubli.
    historique: Optional[List[Dict[str, Any]]] = None
    # NOUVEAU -- PDF joint par l'enseignant a CETTE question (optionnel,
    # independant de l'historique) : meme convention que
    # ExamenCreateIn.image_legende et ExamenDepuisPdfIn.pdf_base64 plus
    # bas dans ce fichier ("data:application/pdf;base64,...." ou base64
    # brut -- voir _decoder_pdf_base64, defini plus loin dans ce module
    # mais resolu au moment de l'appel, donc peu importe l'ordre).
    pdf_base64: Optional[str] = None
    nom_fichier_pdf: Optional[str] = None


@app.post("/api/assistant/chat")
def assistant_chat(payload: AssistantChatIn, user_id: int = Depends(get_user_id)):
    """Question ponctuelle a l'assistant pedagogique -- voir
    assistant_engine.py pour la logique (prompt, troncature de
    l'historique, appel Gemini). Cette route se contente de traduire les
    deux erreurs que repondre() peut lever en codes HTTP :
    - ValueError (message vide) -> 400, faute du client.
    - RuntimeError (Gemini indisponible / quota / reponse vide) -> 502,
      la requete etait valide mais le service IA en amont a echoue --
      distinct d'un 500 (qui signalerait un bug cote NOTRE code).

    NOUVEAU -- si un PDF est joint (payload.pdf_base64), on le decode et
    on en extrait le texte AVANT d'appeler assistant_engine.repondre() :
    reutilise _decoder_pdf_base64 (deja utilise pour
    /api/examens/depuis-pdf, leve deja les 400/413 appropries si le PDF
    est invalide ou trop volumineux) et pdf_quiz_engine.extraire_texte_pdf
    (meme fonction que pour la generation d'examen depuis un PDF -- pas
    de deuxieme implementation d'extraction). Un PDF scanne (sans calque
    de texte exploitable) renvoie une chaine vide : on le signale
    explicitement en 422 plutot que d'envoyer un contexte vide a Gemini,
    qui inventerait alors une reponse sans lien avec le document reel --
    meme logique que generer_quiz_depuis_pdf() dans pdf_quiz_engine.py."""
    texte_pdf = None
    if payload.pdf_base64:
        pdf_bytes = _decoder_pdf_base64(payload.pdf_base64)
        texte_pdf = pdf_quiz_engine.extraire_texte_pdf(pdf_bytes)
        if not texte_pdf.strip():
            raise HTTPException(
                status_code=422,
                detail=(
                    "Impossible d'extraire du texte de ce PDF. S'il s'agit d'un document "
                    "scanne (photo ou image plutot que texte selectionnable), l'extraction "
                    "automatique ne fonctionne pas encore pour ce type de fichier."
                ),
            )

    try:
        reponse = assistant_engine.repondre(
            payload.message, payload.historique,
            texte_pdf=texte_pdf, nom_fichier_pdf=payload.nom_fichier_pdf,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"reponse": reponse}


# =========================================================================
# Matieres / chapitres disponibles (alimentent les menus de l'etape 1)
# =========================================================================

@app.get("/api/matieres")
def api_matieres(niveau: str):
    if niveau not in NIVEAUX_VALIDES:
        raise HTTPException(status_code=400, detail="Niveau invalide")
    resultat = []
    for m in MATIERES_VALIDES:
        try:
            chapitres = quiz_engine.lister_chapitres(m, niveau)
        except Exception:
            chapitres = []
        if chapitres:
            resultat.append({"id": m, "nb_chapitres": len(chapitres)})
    return {"niveau": niveau, "matieres": resultat}


@app.get("/api/chapitres")
def api_chapitres(matiere: str, niveau: str):
    if matiere not in MATIERES_VALIDES:
        raise HTTPException(status_code=400, detail="Matiere invalide")
    if niveau not in NIVEAUX_VALIDES:
        raise HTTPException(status_code=400, detail="Niveau invalide")
    try:
        chapitres = quiz_engine.lister_chapitres(matiere, niveau)
    except Exception:
        chapitres = []
    return {"matiere": matiere, "niveau": niveau, "chapitres": chapitres}


# =========================================================================
# Examens : generation (etape 1 -> 2), edition (etape 2), validation
# (etape 3), export (etape 4)
# =========================================================================

class ExamenCreateIn(BaseModel):
    matiere: str
    niveau: str
    chapitres: List[str] = Field(..., min_length=1)
    nb_questions: int = 10
    difficulte: str = "normale"
    types_questions: Optional[List[str]] = None
    duree: str = "60 min"
    # NOUVEAU -- consignes libres de l'enseignant (ex: "insiste sur les
    # fractions", "evite les questions de calcul mental"), simplement
    # transmises a Gemini en plus du reste -- voir quiz_engine.py.
    notes: Optional[str] = None
    # NOUVEAU -- image fournie par l'enseignant DES l'etape Selection (data
    # URI base64) pour construire UNE question "legende" a partir d'une
    # image REELLE plutot que de laisser Gemini imaginer sa propre
    # description puis (eventuellement) generer une image separee avec le
    # modele PAYANT (voir image_service.py). Voir _ajouter_question_legende_uploadee
    # plus bas pour le detail complet -- optionnel, ne change rien si absent.
    image_legende: Optional[str] = None
    # NOUVEAU -- repartition optionnelle du nombre de questions par type,
    # ex: {"qcm": 4, "texte_trous": 4, "ouverte": 2} pour nb_questions=10.
    # Simple CONSIGNE supplementaire transmise a Gemini (voir
    # quiz_engine.ParametresExamen.repartition_types) -- pas une garantie
    # absolue, Gemini peut s'en ecarter legerement. Si absent/vide, l'IA
    # choisit librement parmi types_questions, comme avant. La somme doit
    # correspondre a nb_questions (verifie plus bas, dans creer_examen).
    repartition_types: Optional[Dict[str, int]] = None


def _ajouter_question_legende_uploadee(
    questions: List[Dict], image_data_uri: str, matiere_key: str, niveau: str,
) -> List[Dict]:
    """Ajoute, a la fin de `questions` (deja generees par l'IA -- voir
    creer_examen ci-dessous), UNE question de type "legende" construite a
    partir d'une image REELLE fournie par l'enseignant a l'etape Selection
    -- au lieu de laisser Gemini imaginer sa propre description puis
    generer une image separee avec le modele PAYANT (voir image_service.py).
    L'IA (modele TEXTE, quota gratuit -- voir image_analysis_service.py)
    LIT directement cette image pour en deduire reponseCorrecte et
    propositions.

    Recalcule le bareme sur le nombre TOTAL de questions (celles de l'IA
    + celle-ci), avec quiz_engine._repartir_bareme -- meme fonction que
    pour une generation normale, deja reutilisee ailleurs dans ce fichier
    (voir creer_examen_depuis_selection plus haut) -- pour que la somme
    reste 20.

    Si l'IA n'arrive pas a lire l'image (reperes pas clairs, pas
    confiante...), la question est AJOUTEE QUAND MEME, avec juste
    l'image et sans reponseCorrecte : elle apparait "Incomplete" a
    l'etape Edition, ou l'enseignant peut deja la corriger avec le
    bouton d'upload existant (voir Edition.jsx) -- plutot que de perdre
    TOUT le quiz deja genere par l'IA (potentiellement un appel Gemini
    couteux/rate-limite) a cause d'un seul echec de lecture d'image."""
    langue = "fr" if matiere_key == "francais" else "ar"
    resultat = image_analysis_service.analyser_image_legende(
        image_data_uri=image_data_uri,
        question_texte="Légende les éléments indiqués sur l'image.",
        matiere=matiere_key,
        niveau=niveau,
        langue=langue,
    )

    nouvelle_question: Dict[str, Any] = {
        "id": f"q{len(questions) + 1}",
        "type": "legende",
        "points": 0,  # recalcule juste apres, avec toutes les autres questions
        "question": "Légende les éléments indiqués sur l'image.",
        "image": {"url": image_data_uri, "alt_text": "Image à légender"},
    }
    if resultat:
        nouvelle_question["reponseCorrecte"] = resultat["reponse_correcte"]
        nouvelle_question["propositions"] = resultat["propositions"]
    else:
        print("[main] Image uploadee a l'etape Selection illisible par l'IA -- "
              "question 'legende' ajoutee incomplete, a corriger en etape Edition.")
        nouvelle_question["reponseCorrecte"] = []

    toutes_questions = questions + [nouvelle_question]
    points = quiz_engine._repartir_bareme(len(toutes_questions))
    for q, p in zip(toutes_questions, points):
        q["points"] = p
    return toutes_questions


# ===== AJOUT : decodage/validation du PDF fourni par l'enseignant, pour
# POST /api/examens/depuis-pdf (voir plus bas) ET POST /api/assistant/chat
# (voir plus haut). Isole ici, pres de _ajouter_question_legende_uploadee,
# parce que c'est le meme genre de garde-fou (upload cote enseignant,
# jamais fait confiance sans verification) juste applique a un PDF plutot
# qu'a une image.
MAX_TAILLE_PDF_OCTETS = 15 * 1024 * 1024  # 15 Mo -- large marge pour une fiche de cours de plusieurs pages


def _decoder_pdf_base64(pdf_base64: str) -> bytes:
    """Accepte soit une data URI complete ('data:application/pdf;base64,...'),
    soit du base64 brut -- pour ne pas forcer le frontend a construire le
    prefixe exact si son composant d'upload le separe deja. Meme
    convention que ExamenCreateIn.image_legende ci-dessus."""
    brut = pdf_base64.split(",", 1)[-1] if pdf_base64.startswith("data:") else pdf_base64
    try:
        donnees = base64.b64decode(brut, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="PDF invalide (base64 mal forme).")
    if not donnees.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Le fichier fourni ne semble pas etre un PDF valide.")
    if len(donnees) > MAX_TAILLE_PDF_OCTETS:
        raise HTTPException(status_code=413, detail="PDF trop volumineux (15 Mo max).")
    return donnees
# ===== FIN AJOUT =====


def _examen_du_user_ou_404(examen_id: int, user_id: int) -> Dict:
    examen = db.get_examen(examen_id)
    if not examen or examen["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Examen introuvable")
    return examen


@app.post("/api/examens")
def creer_examen(payload: ExamenCreateIn, user_id: int = Depends(get_user_id)):
    if payload.matiere not in MATIERES_VALIDES:
        raise HTTPException(status_code=400, detail="Matiere invalide")
    if payload.niveau not in NIVEAUX_VALIDES:
        raise HTTPException(status_code=400, detail="Niveau invalide")

    # NOUVEAU -- si une repartition par type est fournie, sa somme DOIT
    # correspondre a nb_questions -- sinon la validation vaut mieux la
    # signaler ICI, avant d'appeler Gemini (qui couterait une requete
    # pour rien), plutot que de laisser l'IA se debrouiller avec des
    # chiffres incoherents.
    if payload.repartition_types:
        total_repartition = sum(payload.repartition_types.values())
        if total_repartition != payload.nb_questions:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"La répartition par type ({total_repartition} questions) ne "
                    f"correspond pas au nombre total demandé ({payload.nb_questions})."
                ),
            )

    # NOUVEAU -- si une image est fournie, elle donne DEJA une question
    # "legende" (voir _ajouter_question_legende_uploadee plus bas) : on
    # demande donc 1 question de moins a l'IA (pour respecter le total
    # nb_questions demande par l'enseignant), et on retire "legende" des
    # types (et de la repartition) envoyes a Gemini pour qu'il n'en
    # fabrique pas une deuxieme de son cote (avec sa propre description
    # imaginee). `max(1, ...)` evite de demander 0 question a Gemini si
    # nb_questions vaut 1 -- dans ce cas rare, le total fera 2 au lieu de
    # 1, plutot que de casser la generation.
    nb_questions_ia = payload.nb_questions
    types_questions_ia = payload.types_questions
    repartition_ia = payload.repartition_types
    if payload.image_legende:
        nb_questions_ia = max(1, payload.nb_questions - 1)
        if types_questions_ia:
            types_questions_ia = [t for t in types_questions_ia if t != "legende"]
        if repartition_ia:
            repartition_ia = {t: n for t, n in repartition_ia.items() if t != "legende"} or None

    try:
        resultat = quiz_engine.generer_quiz_pour_wizard(
            matiere_key=payload.matiere,
            niveau=payload.niveau,
            chapitres=payload.chapitres,
            nb_questions=nb_questions_ia,
            difficulte=payload.difficulte,
            types_questions=types_questions_ia,
            duree=payload.duree,
            notes=payload.notes,
            repartition_types=repartition_ia,
        )
    except quiz_engine.QuizGenerationError as e:
        # Erreur "attendue" : rien trouve dans le programme, ou Gemini a echoue.
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        # Erreur inattendue (import casse, cle API absente, etc.)
        raise HTTPException(status_code=500, detail=f"Erreur interne : {e}")

    if payload.image_legende:
        resultat["questions"] = _ajouter_question_legende_uploadee(
            resultat["questions"], payload.image_legende, payload.matiere, payload.niveau,
        )

    examen_id = db.creer_examen(
        user_id=user_id,
        matiere=resultat["matiere"],
        niveau=resultat["niveau"],
        chapitre=resultat["chapitre"],
        titre=resultat["titre"],
        questions=resultat["questions"],
        duree=resultat["duree"],
        # NOUVEAU -- gardes pour permettre une regeneration plus tard (voir
        # POST /api/examens/{id}/regenerer) sans redemander ces choix.
        chapitres=payload.chapitres,
        nb_questions=payload.nb_questions,
        difficulte=payload.difficulte,
        types_questions=payload.types_questions,
        notes=payload.notes,
    )
    return db.get_examen(examen_id)


# ===== AJOUT : examen "personnalise" assemble a la main depuis la Banque
# de Questions (voir BanqueQuestions.jsx) -- l'enseignant a deja choisi
# des questions REELLES et deja generees, il ne veut PAS que l'IA en
# regenere de nouvelles. Aucun appel a Gemini ici : on recopie les
# questions telles quelles (juste les id et les points recalcules, voir
# plus bas), et on les persiste directement -- meme principe que
# modifier_questions_examen, en creation plutot qu'en mise a jour.
class ExamenDepuisSelectionIn(BaseModel):
    matiere: str
    niveau: str
    chapitre: str = Field(..., min_length=1)
    titre: Optional[str] = None
    duree: str = "60 min"
    questions: List[Dict[str, Any]] = Field(..., min_length=1)


@app.post("/api/examens/depuis-selection")
def creer_examen_depuis_selection(payload: ExamenDepuisSelectionIn, user_id: int = Depends(get_user_id)):
    if payload.matiere not in MATIERES_VALIDES:
        raise HTTPException(status_code=400, detail="Matiere invalide")
    if payload.niveau not in NIVEAUX_VALIDES:
        raise HTTPException(status_code=400, detail="Niveau invalide")

    # Les questions viennent potentiellement de PLUSIEURS examens
    # d'origine differents : leurs `id` internes ("q1", "q2"...) peuvent
    # donc se chevaucher. On les renumerote proprement, et on RECALCULE
    # le bareme (meme repartition egale que pour une generation IA, voir
    # quiz_engine._repartir_bareme) plutot que de garder les points
    # d'origine, qui ne sommeraient presque jamais a 20 une fois
    # melanges -- l'enseignant peut toujours les ajuster ensuite dans
    # l'edition, exactement comme pour un examen genere par l'IA.
    points_repartis = quiz_engine._repartir_bareme(len(payload.questions))
    questions_finales = []
    for i, (q, points) in enumerate(zip(payload.questions, points_repartis)):
        q_copie = dict(q)
        q_copie["id"] = f"q{i + 1}"
        q_copie["points"] = points
        questions_finales.append(q_copie)

    matiere_display = quiz_engine.MATIERE_DISPLAY.get(payload.matiere, payload.matiere)
    titre = payload.titre or f"{matiere_display} — {payload.chapitre}"

    examen_id = db.creer_examen(
        user_id=user_id,
        matiere=payload.matiere,
        niveau=payload.niveau,
        chapitre=payload.chapitre,
        titre=titre,
        questions=questions_finales,
        duree=payload.duree,
        # Pas de chapitres/nb_questions/difficulte/types_questions ici :
        # cet examen n'a pas ete genere par l'IA, il n'y a pas de
        # "parametres d'origine" a garder pour une eventuelle
        # regeneration (voir POST /api/examens/{id}/regenerer, qui reste
        # utilisable si l'enseignant le souhaite malgre tout par la
        # suite -- juste sans le contexte d'une premiere generation).
        notes=None,
    )
    return db.get_examen(examen_id)
# ===== FIN AJOUT =====


# ===== AJOUT : examen genere depuis un PDF fourni par l'enseignant (et
# non depuis database_tunisienne/) -- voir pdf_quiz_engine.py pour le
# detail complet (extraction de texte, troncature, limites connues).
# Usage PONCTUEL : contrairement a creer_examen() ci-dessus, aucun champ
# `chapitres=` n'est passe a db.creer_examen -- c'est volontaire (voir
# regenerer_examen plus bas, qui s'appuie justement sur l'absence de ce
# champ pour refuser une regeneration qui ne pourrait pas fonctionner
# sans le PDF d'origine, jamais conserve).
class ExamenDepuisPdfIn(BaseModel):
    # NOUVEAU -- optionnels (contrairement a ExamenCreateIn.matiere/niveau,
    # toujours obligatoires) : si absents ou invalides, detectes
    # automatiquement a partir du contenu du PDF (voir
    # pdf_quiz_engine.detecter_matiere_niveau, appele plus bas). Le wizard
    # continue de les envoyer explicitement comme avant -- rien ne change
    # pour lui. C'est le bouton "Creer un examen depuis ce PDF" du chat
    # assistant qui les omet desormais, pour eviter tout formulaire.
    matiere: Optional[str] = None
    niveau: Optional[str] = None
    nb_questions: int = 10
    difficulte: str = "normale"
    types_questions: Optional[List[str]] = None
    duree: str = "60 min"
    notes: Optional[str] = None
    repartition_types: Optional[Dict[str, int]] = None
    # "data:application/pdf;base64,...." -- meme convention que
    # ExamenCreateIn.image_legende.
    pdf_base64: str
    nom_fichier: Optional[str] = None
    # Meme champ/usage que dans ExamenCreateIn (voir
    # _ajouter_question_legende_uploadee) -- optionnel et independant du
    # PDF lui-meme : une image a legender n'est pas forcement une page
    # du document source des autres questions.
    image_legende: Optional[str] = None


@app.post("/api/examens/depuis-pdf")
def creer_examen_depuis_pdf(payload: ExamenDepuisPdfIn, user_id: int = Depends(get_user_id)):
    """Genere un examen a partir d'un PDF fourni par l'enseignant, a la
    place du programme (database_tunisienne/) -- voir pdf_quiz_engine.py.
    USAGE PONCTUEL : le contenu du PDF n'est indexe nulle part, il sert
    une fois pour cette generation ; seules les questions generees sont
    conservees (comme tout examen, via db.creer_examen).

    NOUVEAU -- matiere/niveau sont optionnels : si absents ou invalides,
    on les detecte a partir du CONTENU du PDF lui-meme (voir
    pdf_quiz_engine.detecter_matiere_niveau), pour le bouton "Creer un
    examen depuis ce PDF" du chat assistant qui n'affiche plus de
    formulaire. Le wizard ("Nouvel examen depuis un PDF"), lui, continue
    d'envoyer ces deux champs explicitement -- la detection ne se
    declenche jamais dans son cas, rien ne change pour lui."""
    # Le decodage vient AVANT la detection : il faut les octets du PDF
    # pour en extraire le texte a analyser.
    pdf_bytes = _decoder_pdf_base64(payload.pdf_base64)

    matiere = payload.matiere
    niveau = payload.niveau
    if matiere not in MATIERES_VALIDES or niveau not in NIVEAUX_VALIDES:
        texte_pour_detection = pdf_quiz_engine.extraire_texte_pdf(pdf_bytes)
        detection = pdf_quiz_engine.detecter_matiere_niveau(
            texte_pour_detection, MATIERES_VALIDES, NIVEAUX_VALIDES,
        )
        if matiere not in MATIERES_VALIDES:
            matiere = detection["matiere"]
        if niveau not in NIVEAUX_VALIDES:
            niveau = detection["niveau"]

    if matiere not in MATIERES_VALIDES:
        raise HTTPException(status_code=400, detail="Matiere invalide")
    if niveau not in NIVEAUX_VALIDES:
        raise HTTPException(status_code=400, detail="Niveau invalide")

    # Meme validation que creer_examen() : la somme de la repartition
    # doit correspondre a nb_questions, verifiee AVANT d'appeler Gemini
    # (qui couterait une requete pour rien sinon).
    if payload.repartition_types:
        total_repartition = sum(payload.repartition_types.values())
        if total_repartition != payload.nb_questions:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"La répartition par type ({total_repartition} questions) ne "
                    f"correspond pas au nombre total demandé ({payload.nb_questions})."
                ),
            )

    # Meme logique que creer_examen() pour image_legende : si une image
    # a legender est fournie, elle compte pour une question de moins a
    # demander a l'IA (voir _ajouter_question_legende_uploadee).
    nb_questions_ia = payload.nb_questions
    types_questions_ia = payload.types_questions
    repartition_ia = payload.repartition_types
    if payload.image_legende:
        nb_questions_ia = max(1, payload.nb_questions - 1)
        if types_questions_ia:
            types_questions_ia = [t for t in types_questions_ia if t != "legende"]
        if repartition_ia:
            repartition_ia = {t: n for t, n in repartition_ia.items() if t != "legende"} or None

    try:
        resultat = pdf_quiz_engine.generer_quiz_depuis_pdf(
            pdf_bytes=pdf_bytes,
            matiere_key=matiere,
            niveau=niveau,
            nb_questions=nb_questions_ia,
            difficulte=payload.difficulte,
            types_questions=types_questions_ia,
            duree=payload.duree,
            notes=payload.notes,
            repartition_types=repartition_ia,
            nom_fichier=payload.nom_fichier,
        )
    except quiz_engine.QuizGenerationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur interne : {e}")

    if payload.image_legende:
        resultat["questions"] = _ajouter_question_legende_uploadee(
            resultat["questions"], payload.image_legende, matiere, niveau,
        )

    examen_id = db.creer_examen(
        user_id=user_id,
        matiere=resultat["matiere"],
        niveau=resultat["niveau"],
        chapitre=resultat["chapitre"],
        titre=resultat["titre"],
        questions=resultat["questions"],
        duree=resultat["duree"],
        # PAS de `chapitres=` ici (contrairement a creer_examen) : cet
        # examen ne vient pas du programme -- c'est CE champ vide que
        # regenerer_examen() detecte plus bas pour refuser proprement une
        # regeneration qui ne pourrait pas fonctionner sans le PDF
        # d'origine (jamais conserve, voir pdf_quiz_engine.py).
        nb_questions=payload.nb_questions,
        difficulte=payload.difficulte,
        types_questions=payload.types_questions,
        notes=payload.notes,
    )
    return db.get_examen(examen_id)
# ===== FIN AJOUT =====


@app.get("/api/examens")
def lister_mes_examens(user_id: int = Depends(get_user_id)):
    return db.lister_examens(user_id)


@app.get("/api/examens/{examen_id}")
def get_examen(examen_id: int, user_id: int = Depends(get_user_id)):
    return _examen_du_user_ou_404(examen_id, user_id)


class ExamenUpdateIn(BaseModel):
    questions: List[Dict[str, Any]]


@app.put("/api/examens/{examen_id}")
def modifier_examen(examen_id: int, payload: ExamenUpdateIn, user_id: int = Depends(get_user_id)):
    _examen_du_user_ou_404(examen_id, user_id)
    db.modifier_questions_examen(examen_id, payload.questions)
    return db.get_examen(examen_id)


# ===== AJOUT : upload manuel d'une image par l'enseignant pour UNE
# question de type "legende" (celle qui EXIGE une image, voir
# models.QuestionLegende) -- remplace, pour cette question precise, le
# chemin "generation automatique" (image_service.generer_image, modele
# d'IMAGE PAYANT -- voir image_service.py) par un chemin "l'enseignant
# fournit sa propre image, l'IA se contente de la LIRE" (modele TEXTE,
# quota gratuit -- voir image_analysis_service.py pour le detail complet
# et pourquoi les deux fichiers sont separes).
#
# Ne passe PAS par quiz_engine.py ni models.py : ici, les questions d'un
# examen deja cree sont de simples dicts plats (meme convention que
# modifier_examen/PUT ci-dessus et modifier_questions_examen dans
# database.py) -- pas besoin de reconstruire un objet Pydantic
# QuestionLegende pour ce cas.
class UploadImageLegendeIn(BaseModel):
    image_data_uri: str  # "data:image/png;base64,...." -- meme convention que ImageRef.url


@app.post("/api/examens/{examen_id}/questions/{question_id}/image")
def uploader_image_legende(
    examen_id: int,
    question_id: str,
    payload: UploadImageLegendeIn,
    user_id: int = Depends(get_user_id),
):
    examen = _examen_du_user_ou_404(examen_id, user_id)

    questions = examen["questions"]
    question = next((q for q in questions if q.get("id") == question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question introuvable dans cet examen")
    if question.get("type") != "legende":
        # Pour l'instant, seul "legende" EXIGE une image -- les autres
        # types avec une image_description (ex: "compte les pommes")
        # restent sur la generation automatique d'image_service.py.
        # A generaliser plus tard si besoin (voir la discussion).
        raise HTTPException(
            status_code=400,
            detail="L'upload d'image n'est disponible que pour les questions de type 'legende' pour l'instant.",
        )

    # examen["matiere"] est la cle interne ("francais", "arabe"...), pas
    # le libelle affiche -- meme deduction que ParametresExamen.langue
    # dans quiz_engine.py, puisque generer_quiz_pour_wizard() ne renvoie
    # pas de champ "langue" separe a stocker sur l'examen.
    langue = "fr" if examen.get("matiere") == "francais" else "ar"

    resultat = image_analysis_service.analyser_image_legende(
        image_data_uri=payload.image_data_uri,
        question_texte=question.get("question", ""),
        matiere=examen.get("matiere", ""),
        niveau=examen.get("niveau", ""),
        langue=langue,
    )
    if resultat is None:
        # Meme convention que image_service.py : jamais d'exception qui
        # remonte depuis image_analysis_service -- un None veut dire
        # "reessaie avec une autre image", PAS "cle API absente" ou
        # "erreur serveur" (voir les logs backend pour la vraie raison).
        raise HTTPException(
            status_code=422,
            detail=(
                "L'IA n'a pas reussi a lire cette image (reperes pas clairs, ou pas "
                "confiante dans ce qu'elle voit). Essaie une image plus nette, avec des "
                "numeros ou des fleches bien visibles."
            ),
        )

    question["image"] = {"url": payload.image_data_uri, "alt_text": question.get("question", "")}
    question["reponseCorrecte"] = resultat["reponse_correcte"]
    question["propositions"] = resultat["propositions"]

    # modifier_questions_examen remet deja statut='brouillon' et efface
    # validation_json (voir database.py) -- normal : la question a
    # change, elle doit etre revalidee comme n'importe quelle edition
    # manuelle (meme logique que modifier_examen ci-dessus).
    db.modifier_questions_examen(examen_id, questions)
    return db.get_examen(examen_id)
# ===== FIN AJOUT =====


@app.delete("/api/examens/{examen_id}")
def supprimer_examen(examen_id: int, user_id: int = Depends(get_user_id)):
    _examen_du_user_ou_404(examen_id, user_id)
    db.supprimer_examen(examen_id)
    return {"ok": True}


@app.post("/api/examens/{examen_id}/valider")
def valider_examen(examen_id: int, user_id: int = Depends(get_user_id)):
    examen = _examen_du_user_ou_404(examen_id, user_id)
    # On revalide toujours l'etat ACTUEL de l'examen (potentiellement edite a
    # l'etape 2), jamais la version brute d'origine -- meme principe deja
    # applique dans le guide Streamlit (TODO 3) : une edition manuelle n'est
    # pas plus fiable a priori qu'une generation automatique.
    resultat = validation_engine.valider_examen(examen, niveau_attendu=examen["niveau"])
    statut = "valide" if resultat["peut_valider"] else "brouillon"
    db.enregistrer_validation(examen_id, resultat, statut)
    return resultat


class RegenererIn(BaseModel):
    # Consignes supplementaires saisies a l'etape Validation (en plus des
    # notes d'origine de l'etape Selection, et des recommandations de la
    # derniere analyse -- voir _construire_notes_regeneration plus bas).
    notes: Optional[str] = None


def _construire_notes_regeneration(
    notes_origine: Optional[str], notes_nouvelles: Optional[str], recommandations: List[str]
) -> Optional[str]:
    """Fusionne, dans cet ordre, les 3 sources possibles de consignes pour
    une regeneration : ce que l'enseignant avait demande a l'origine
    (etape Selection), ce qu'il demande maintenant en plus (etape
    Validation), et ce que l'IA a elle-meme recommande lors de la
    derniere analyse. Renvoie None si les 3 sont vides -- inutile
    d'ajouter un bloc de consignes vide au prompt."""
    morceaux = []
    if notes_origine and notes_origine.strip():
        morceaux.append(f"Consignes d'origine : {notes_origine.strip()}")
    if notes_nouvelles and notes_nouvelles.strip():
        morceaux.append(f"Nouvelles consignes de l'enseignant : {notes_nouvelles.strip()}")
    if recommandations:
        morceaux.append(
            "Corrige en priorite les points suivants, releves lors de la derniere analyse : "
            + " ; ".join(recommandations)
        )
    return "\n".join(morceaux) if morceaux else None


@app.post("/api/examens/{examen_id}/regenerer")
def regenerer_examen(examen_id: int, payload: RegenererIn, user_id: int = Depends(get_user_id)):
    """Regenere entierement les questions d'un examen existant, avec les
    MEMES parametres qu'a l'origine (matiere/niveau/chapitres/nb_questions/
    difficulte/types_questions -- voir les colonnes ajoutees dans
    database.py) + les recommandations de la derniere analyse et/ou de
    nouvelles consignes -- plutot que de forcer l'enseignant a tout
    resaisir depuis l'etape Selection. Meme fonction de generation que la
    creation initiale (quiz_engine.generer_quiz_pour_wizard) : une
    regeneration n'est qu'une generation avec plus de contexte."""
    examen = _examen_du_user_ou_404(examen_id, user_id)

    # NOUVEAU -- un examen cree depuis un PDF (POST /api/examens/depuis-pdf)
    # n'a pas de champ `chapitres` (voir creer_examen_depuis_pdf plus haut,
    # c'est volontaire) : il n'y a pas de vrais chapitres du programme a
    # rechercher, donc rappeler le chemin RAG ci-dessous echouerait avec
    # un message ("Aucun contenu trouve dans le programme") qui n'aurait
    # aucun sens pour l'enseignant, sans lui dire quoi faire a la place.
    # Le PDF d'origine n'etant jamais conserve (usage ponctuel, voir
    # pdf_quiz_engine.py), la seule option correcte est de lui demander
    # de reimporter son fichier plutot que de "regenerer" a l'identique.
    if not examen.get("chapitres"):
        raise HTTPException(
            status_code=422,
            detail=(
                "Cet examen a ete cree depuis un PDF (ou assemble manuellement) : "
                "il n'y a pas de chapitres du programme a partir desquels le "
                "regenerer. Reimportez le PDF via 'Nouvel examen depuis un PDF' "
                "pour en generer un nouveau."
            ),
        )

    chapitres = examen.get("chapitres") or [examen["chapitre"]]
    nb_questions = examen.get("nb_questions") or len(examen["questions"]) or 5
    difficulte = examen.get("difficulte") or "normale"
    types_questions = examen.get("types_questions")
    recommandations = (examen.get("validation") or {}).get("recommandations", [])
    notes = _construire_notes_regeneration(examen.get("notes"), payload.notes, recommandations)

    try:
        resultat = quiz_engine.generer_quiz_pour_wizard(
            matiere_key=examen["matiere"],
            niveau=examen["niveau"],
            chapitres=chapitres,
            nb_questions=nb_questions,
            difficulte=difficulte,
            types_questions=types_questions,
            duree=examen.get("duree", "60 min"),
            notes=notes,
        )
    except quiz_engine.QuizGenerationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur interne : {e}")

    # modifier_questions_examen remet deja statut='brouillon' et efface
    # validation_json (voir database.py) : une regeneration doit etre
    # revalidee, exactement comme une edition manuelle.
    db.modifier_questions_examen(examen_id, resultat["questions"])
    db.mettre_a_jour_notes(examen_id, notes)
    return db.get_examen(examen_id)


class ExportIn(BaseModel):
    langue: str = "fr"  # seul "fr" est supporte dans cette version simplifiee (voir pdf_export.py)
    format: str = "pdf"  # "pdf" | "impression" -- meme fichier PDF dans les deux cas,
    # la distinction (telecharger vs. ouvrir la boite de dialogue d'impression)
    # se fait cote frontend, pas dans le fichier genere.
    en_tete: bool = True
    pagination: bool = True
    nom_etablissement: str = ""


@app.post("/api/examens/{examen_id}/export")
def exporter_examen(examen_id: int, payload: ExportIn, user_id: int = Depends(get_user_id)):
    examen = _examen_du_user_ou_404(examen_id, user_id)
    if payload.langue != "fr":
        raise HTTPException(
            status_code=400,
            detail="Export en arabe/bilingue pas encore disponible dans cette version (francais uniquement pour l'instant).",
        )

    try:
        pdf_bytes = pdf_export.generer_pdf_examen(
            examen,
            langue=payload.langue,
            en_tete=payload.en_tete,
            pagination=payload.pagination,
            nom_etablissement=payload.nom_etablissement,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la generation du PDF : {e}")

    db.marquer_exporte(examen_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="examen_{examen_id}.pdf"'},
    )


def _exiger_examen_valide(examen: Dict) -> None:
    """Garde-fou pour l'export du corrige (voir POST .../export/corrige
    ci-dessous) : le corrige ne doit etre exportable qu'apres une
    validation reussie (peut_valider=True), pas juste sur un brouillon --
    c'est ce qui fait que « la correction passe elle aussi par la
    validation », en plus des checks ajoutes dans validation.py
    (_check_corrections_completes).

    On lit examen["validation"] (le dernier resultat de
    /api/examens/{id}/valider, voir database.py:_row_to_examen) plutot que
    la colonne statut : marquer_exporte() fait passer statut a 'exporte'
    des le premier export (sujet OU corrige), donc verifier statut=='valide'
    bloquerait a tort l'export du corrige juste apres celui du sujet. Le
    JSON de validation, lui, reste en place tant que les questions ne sont
    pas re-editees (modifier_questions_examen le remet a None)."""
    validation = examen.get("validation")
    if not validation or not validation.get("peut_valider"):
        raise HTTPException(
            status_code=409,
            detail=(
                "Cet examen doit d'abord etre valide (etape Validation) avant que son "
                "corrige puisse etre exporte."
            ),
        )


@app.post("/api/examens/{examen_id}/export/corrige")
def exporter_correction_examen(examen_id: int, payload: ExportIn, user_id: int = Depends(get_user_id)):
    """Corrige (bareme + reponses attendues + explications) du meme examen
    que POST .../export ci-dessus -- meme corps de requete (ExportIn),
    reserve a l'enseignant (voir pdf_export.generer_pdf_correction)."""
    examen = _examen_du_user_ou_404(examen_id, user_id)
    _exiger_examen_valide(examen)
    if payload.langue != "fr":
        raise HTTPException(
            status_code=400,
            detail="Export en arabe/bilingue pas encore disponible dans cette version (francais uniquement pour l'instant).",
        )

    try:
        pdf_bytes = pdf_export.generer_pdf_correction(
            examen,
            langue=payload.langue,
            en_tete=payload.en_tete,
            pagination=payload.pagination,
            nom_etablissement=payload.nom_etablissement,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la generation du PDF : {e}")

    db.marquer_exporte(examen_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="corrige_examen_{examen_id}.pdf"'},
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}