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
import voice_engine
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
            db.lier_google_id(user["id"], profil["google_id"])
            user = db.get_user_by_id(user["id"])
        else:
            genre = payload.genre if payload.genre in db.GENRES_VALIDES else "femme"
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
    reponse = {
        "ok": True,
        "message": "Si un compte existe avec cet email, un code de reinitialisation vient d'etre envoye.",
    }

    user = db.get_user_by_email(payload.email)
    if not user:
        return reponse

    if db.code_reset_recent(user["id"], CODE_RESET_COOLDOWN_SECONDES):
        return reponse

    code = auth.generer_code_reset()
    expire_at = (
        datetime.now(timezone.utc) + timedelta(minutes=CODE_RESET_DUREE_MINUTES)
    ).isoformat()
    db.creer_code_reset(user["id"], auth.hash_code(code), expire_at)

    try:
        email_service.envoyer_code_reset(user["email"], code, user["nom"])
    except Exception as e:
        print(f"[auth] Echec d'envoi de l'email de reinitialisation : {e}")

    return reponse


@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordIn):
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


class AssistantChatIn(BaseModel):
    message: str
    historique: Optional[List[Dict[str, Any]]] = None
    pdf_base64: Optional[str] = None
    nom_fichier_pdf: Optional[str] = None
    mode_vocal: bool = False


@app.post("/api/assistant/chat")
def assistant_chat(payload: AssistantChatIn, user_id: int = Depends(get_user_id)):
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
            mode_vocal=payload.mode_vocal,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"reponse": reponse}


class AssistantSluIn(BaseModel):
    texte: str = Field(..., max_length=2_000)


class AssistantAsrIn(BaseModel):
    audio_base64: str
    langue: Optional[str] = None


class AssistantTtsIn(BaseModel):
    texte: str = Field(..., max_length=20_000)
    langue: Optional[str] = None


@app.post("/api/assistant/slu")
def assistant_slu(payload: AssistantSluIn, user_id: int = Depends(get_user_id)):
    try:
        res = voice_engine.comprendre(payload.texte)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    res["resume"] = voice_engine.resumer_parametres(res["parametres"], res["langue"])
    return res


@app.post("/api/assistant/asr")
def assistant_asr(payload: AssistantAsrIn, user_id: int = Depends(get_user_id)):
    try:
        return voice_engine.transcrire(payload.audio_base64, payload.langue)
    except voice_engine.ModuleVocalIndisponible as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de transcription : {e}")


@app.post("/api/assistant/tts")
def assistant_tts(payload: AssistantTtsIn, user_id: int = Depends(get_user_id)):
    try:
        mp3 = voice_engine.synthetiser(payload.texte, payload.langue)
    except voice_engine.ModuleVocalIndisponible as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur de synthese vocale : {e}")
    return Response(content=mp3, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})


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


class ExamenCreateIn(BaseModel):
    matiere: str
    niveau: str
    chapitres: List[str] = Field(..., min_length=1)
    nb_questions: int = 10
    difficulte: str = "normale"
    types_questions: Optional[List[str]] = None
    duree: str = "60 min"
    notes: Optional[str] = None
    image_legende: Optional[str] = None
    repartition_types: Optional[Dict[str, int]] = None


def _ajouter_question_legende_uploadee(
    questions: List[Dict], image_data_uri: str, matiere_key: str, niveau: str,
) -> List[Dict]:
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
        "points": 0,
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


MAX_TAILLE_PDF_OCTETS = 15 * 1024 * 1024


def _decoder_pdf_base64(pdf_base64: str) -> bytes:
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
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
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
        chapitres=payload.chapitres,
        nb_questions=payload.nb_questions,
        difficulte=payload.difficulte,
        types_questions=payload.types_questions,
        notes=payload.notes,
    )
    return db.get_examen(examen_id)


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
        notes=None,
    )
    return db.get_examen(examen_id)


class ExamenDepuisPdfIn(BaseModel):
    matiere: Optional[str] = None
    niveau: Optional[str] = None
    nb_questions: int = 10
    difficulte: str = "normale"
    types_questions: Optional[List[str]] = None
    duree: str = "60 min"
    notes: Optional[str] = None
    repartition_types: Optional[Dict[str, int]] = None
    pdf_base64: str
    nom_fichier: Optional[str] = None
    image_legende: Optional[str] = None


@app.post("/api/examens/depuis-pdf")
def creer_examen_depuis_pdf(payload: ExamenDepuisPdfIn, user_id: int = Depends(get_user_id)):
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
        nb_questions=payload.nb_questions,
        difficulte=payload.difficulte,
        types_questions=payload.types_questions,
        notes=payload.notes,
    )
    return db.get_examen(examen_id)


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


class UploadImageLegendeIn(BaseModel):
    image_data_uri: str


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
        raise HTTPException(
            status_code=400,
            detail="L'upload d'image n'est disponible que pour les questions de type 'legende' pour l'instant.",
        )

    langue = "fr" if examen.get("matiere") == "francais" else "ar"

    resultat = image_analysis_service.analyser_image_legende(
        image_data_uri=payload.image_data_uri,
        question_texte=question.get("question", ""),
        matiere=examen.get("matiere", ""),
        niveau=examen.get("niveau", ""),
        langue=langue,
    )
    if resultat is None:
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

    db.modifier_questions_examen(examen_id, questions)
    return db.get_examen(examen_id)


@app.delete("/api/examens/{examen_id}")
def supprimer_examen(examen_id: int, user_id: int = Depends(get_user_id)):
    _examen_du_user_ou_404(examen_id, user_id)
    db.supprimer_examen(examen_id)
    return {"ok": True}


@app.post("/api/examens/{examen_id}/valider")
def valider_examen(examen_id: int, user_id: int = Depends(get_user_id)):
    examen = _examen_du_user_ou_404(examen_id, user_id)
    resultat = validation_engine.valider_examen(examen, niveau_attendu=examen["niveau"])
    statut = "valide" if resultat["peut_valider"] else "brouillon"
    db.enregistrer_validation(examen_id, resultat, statut)
    return resultat


class RegenererIn(BaseModel):
    notes: Optional[str] = None


def _construire_notes_regeneration(
    notes_origine: Optional[str], notes_nouvelles: Optional[str], recommandations: List[str]
) -> Optional[str]:
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
    examen = _examen_du_user_ou_404(examen_id, user_id)

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

    db.modifier_questions_examen(examen_id, resultat["questions"])
    db.mettre_a_jour_notes(examen_id, notes)
    return db.get_examen(examen_id)


class ExportIn(BaseModel):
    langue: str = "fr"
    format: str = "pdf"
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