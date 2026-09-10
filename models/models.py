from typing import List, Union, Literal, Optional
from pydantic import BaseModel, Field



class QuestionVraiFaux(BaseModel):
    """Question Vrai / Faux : une affirmation que l'élève doit juger vraie ou fausse."""
    type: Literal["vrai_faux"]
    question: str = Field(description="Une affirmation à évaluer comme vraie ou fausse.")
    reponse_correcte: bool
    explication: Optional[str] = None


class QuestionQCM(BaseModel):
    """Question à Choix Multiples : un énoncé et exactement 4 options possibles."""
    type: Literal["qcm"]
    question: str = Field(description="L'énoncé de la question à choix multiples.")
    options: List[str] = Field(
        min_length=4,
        max_length=4,
        description="Exactement 4 options de réponse possibles.",
    )
    reponse_correcte: str = Field(
        description="La bonne réponse, doit correspondre exactement à l'une des 4 options."
    )
    explication: Optional[str] = None


class QuestionOuverte(BaseModel):
    """Question ouverte : l'élève rédige sa réponse."""
    type: Literal["ouverte"]
    question: str = Field(
        description="L'énoncé de la question ouverte."
    )
    reponse_correcte: str = Field(
        description="Réponse attendue ou éléments de correction."
    )
    explication: Optional[str] = None


class QuestionTrous(BaseModel):
    """Exercice à trous."""
    type: Literal["texte_a_trous"]
    texte: str = Field(
        description='Texte contenant des blancs "___".'
    )
    reponse_correcte: List[str] = Field(
        description="Liste des réponses dans l'ordre des trous."
    )
    explication: Optional[str] = None


Question = Union[QuestionQCM, QuestionVraiFaux, QuestionOuverte, QuestionTrous]


class Examen(BaseModel):
    """Un examen complet, généré selon les paramètres fournis par l'enseignant."""
    matiere: str = Field(description="La matière de l'examen, ex: 'Mathématiques'.")
    niveau: str = Field(description="Le niveau scolaire, ex: '3e année primaire'.")
    chapitre: str = Field(description="Le ou les chapitres couverts par l'examen.")
    langue: Literal["fr", "ar"]
    duree_estimee_minutes: int = Field(
        ge=1,
        description="Durée estimée de l'examen en minutes, doit être positive.",
    
    )
    questions: List[Question] = Field(
        min_length=1, description="La liste des questions de l'examen."
    )


if __name__ == "__main__":
    import json
    print(json.dumps(Examen.model_json_schema(), indent=2, ensure_ascii=False))