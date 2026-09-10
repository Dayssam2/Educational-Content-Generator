"""
Modèles de données pour les examens
"""

from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class QuestionType(Enum):
    """Types de questions supportés"""
    QCM = "qcm"
    VRAI_FAUX = "vrai_faux"
    TEXTE_A_TROUS = "texte_a_trous"
    OUVERTE = "ouverte"

class Difficulte(Enum):
    """Niveaux de difficulté"""
    FACILE = "facile"
    MOYEN = "moyen"
    DIFFICILE = "difficile"

@dataclass
class Question:
    """Modèle d'une question"""
    type: QuestionType
    question: str
    reponse_correcte: any
    options: Optional[List[str]] = None
    texte: Optional[str] = None
    explication: Optional[str] = None
    points: int = 1
    difficulte: Difficulte = Difficulte.MOYEN

@dataclass
class Examen:
    """Modèle d'un examen complet"""
    titre: str
    matiere: str
    niveau: str
    chapitre: str
    lecon: str
    langue: str
    duree_estimee_minutes: int
    questions: List[Question]
    consignes: Optional[str] = None
    
    def to_dict(self) -> dict:
        """Convertit en dictionnaire"""
        return {
            "titre": self.titre,
            "matiere": self.matiere,
            "niveau": self.niveau,
            "chapitre": self.chapitre,
            "lecon": self.lecon,
            "langue": self.langue,
            "duree_estimee_minutes": self.duree_estimee_minutes,
            "consignes": self.consignes,
            "questions": [
                {
                    "type": q.type.value,
                    "question": q.question,
                    "reponse_correcte": q.reponse_correcte,
                    "options": q.options,
                    "texte": q.texte,
                    "explication": q.explication,
                    "points": q.points,
                    "difficulte": q.difficulte.value
                }
                for q in self.questions
            ]
        }

@dataclass
class ConfigExamen:
    """Configuration pour générer un examen"""
    matiere: str
    niveau: str
    lecon: str
    nb_questions: int = 5
    types_questions: List[QuestionType] = None
    duree_minutes: int = 30
    difficultes: List[Difficulte] = None
    
    def __post_init__(self):
        if self.types_questions is None:
            self.types_questions = [QuestionType.QCM, QuestionType.VRAI_FAUX]
        if self.difficultes is None:
            self.difficultes = [Difficulte.FACILE, Difficulte.MOYEN, Difficulte.DIFFICILE]
