from typing import List, Union, Literal, Optional, Annotated
from pydantic import BaseModel, Field, field_validator, model_validator


# =============================================================================
# Petit helper reutilise par plusieurs validators ci-dessous
# =============================================================================

def _sans_blancs(valeurs: List[str]) -> List[str]:
    """Verifie qu'aucune chaine de la liste n'est vide/blanche. Reutilise
    par plusieurs field_validator plus bas, pour eviter de repeter la
    meme boucle sur chaque champ concerne (options, colonnes, elements,
    categories...)."""
    for v in valeurs:
        if not str(v).strip():
            raise ValueError("La liste contient une entree vide.")
    return valeurs


# =============================================================================
# Briques communes (image, tableau de donnees)
# =============================================================================

class ImageRef(BaseModel):
    """Image associee a une question (ex: "observe l'image et compte les
    pommes", un schema de sciences a legender, une carte en histoire-geo).
    En pratique un seul des deux champs source est rempli :
    - `url` : image deja disponible (data URI base64 ou URL http(s)).
    - `description` : une description en langage naturel, si vous generez
      l'image separement (IA, banque d'images...) a partir de ce schema."""
    url: Optional[str] = Field(
        default=None,
        description="Image deja disponible : data URI base64 ou URL http(s).",
    )
    description: Optional[str] = Field(
        default=None,
        description="Description en langage naturel de l'image souhaitee, si `url` n'est pas encore connue.",
    )
    alt_text: Optional[str] = Field(
        default=None, description="Texte alternatif / legende de l'image."
    )

    @model_validator(mode="after")
    def _verifier_source(self) -> "ImageRef":
        # Sans ca, ImageRef() (les 3 champs a None) passait silencieusement
        # -- une "image" qui ne pointe vers rien et ne decrit rien n'a
        # aucun sens, autant le detecter a la creation plutot que de
        # decouvrir un champ image vide au moment de l'afficher.
        if not (self.url or self.description):
            raise ValueError("ImageRef doit avoir au moins `url` ou `description` rempli.")
        return self


class TableauDonnees(BaseModel):
    """Tableau de donnees pour un probleme (ex: un enonce de maths avec une
    quantite par personnage, un releve en sciences)."""
    headers: List[str] = Field(min_length=1)
    rows: List[List[str]] = Field(min_length=1)

    @field_validator("headers")
    @classmethod
    def _verifier_headers(cls, v: List[str]) -> List[str]:
        return _sans_blancs(v)

    @model_validator(mode="after")
    def _verifier_lignes(self) -> "TableauDonnees":
        # Sans ce controle, une ligne avec plus ou moins de cellules que
        # `headers` passait la validation et aurait decale l'affichage
        # (chaque colonne d'une ligne ne correspondant plus au bon header).
        n = len(self.headers)
        for i, row in enumerate(self.rows):
            if len(row) != n:
                raise ValueError(
                    f"La ligne {i} a {len(row)} colonne(s), attendu {n} (comme `headers`)."
                )
        return self


# =============================================================================
# Champs communs a toutes les questions
# =============================================================================

class QuestionBase(BaseModel):
    """Champs partages par TOUS les types de question ci-dessous, quelle
    que soit la matiere."""
    id: Optional[str] = None
    points: Optional[int] = Field(default=None, ge=1)
    titre_exercice: Optional[str] = Field(
        default=None, description="Titre court affiche au-dessus de la question, ex: 'Exercice 1'."
    )
    support: Optional[str] = Field(
        default=None,
        description="Texte ou document court sur lequel porte la question, quand ce n'est pas un vrai exercice de lecture a plusieurs sous-questions (voir ExerciceLecture plus bas pour ce cas).",
    )
    tableau: Optional[TableauDonnees] = None
    image: Optional[ImageRef] = Field(
        default=None,
        description="Illustration de la question -- particulierement utile pour les petites classes (niveau 1-3) qui ne lisent pas encore couramment : compter des objets, observer un animal/une plante, associer une image a un mot...",
    )
    explication: Optional[str] = None


# =============================================================================
# Types de question -- un par grande famille d'exercice du primaire tunisien,
# toutes matieres confondues (maths, arabe, francais, eveil scientifique,
# histoire-geo, dictee)
# =============================================================================

class QuestionQCM(QuestionBase):
    """Question a Choix Multiples : un enonce et exactement 4 options possibles."""
    type: Literal["qcm"]
    question: str = Field(min_length=1, description="L'enonce de la question a choix multiples.")
    options: List[str] = Field(
        min_length=4,
        max_length=4,
        description="Exactement 4 options de reponse possibles.",
    )
    reponse_correcte: str = Field(
        min_length=1,
        description="La bonne reponse, doit correspondre exactement a l'une des 4 options.",
    )

    @field_validator("options")
    @classmethod
    def _verifier_options(cls, v: List[str]) -> List[str]:
        _sans_blancs(v)
        if len(set(v)) != len(v):
            raise ValueError("Les 4 options doivent etre differentes les unes des autres.")
        return v

    @model_validator(mode="after")
    def _verifier_reponse_dans_options(self) -> "QuestionQCM":
        # La description du champ dit "doit correspondre exactement a
        # l'une des options" depuis le tout debut de ce fichier -- mais
        # rien ne le verifiait vraiment : une reponse_correcte qui ne
        # matchait aucune option passait sans erreur.
        if self.reponse_correcte not in self.options:
            raise ValueError("reponse_correcte doit correspondre exactement a l'une des options.")
        return self


class QuestionVraiFaux(QuestionBase):
    """Question Vrai / Faux : une affirmation que l'eleve doit juger vraie ou fausse."""
    type: Literal["vrai_faux"]
    question: str = Field(min_length=1, description="Une affirmation a evaluer comme vraie ou fausse.")
    reponse_correcte: bool


class QuestionOuverte(QuestionBase):
    """Question ouverte, a reponse courte et determinee (contrairement a
    QuestionRedaction plus bas, qui n'a pas de reponse unique)."""
    type: Literal["ouverte"]
    question: str = Field(min_length=1, description="L'enonce de la question ouverte.")
    reponse_correcte: str = Field(min_length=1, description="Reponse attendue ou elements de correction.")


class QuestionTrous(QuestionBase):
    """Exercice a trous (texte a completer)."""
    type: Literal["texte_trous"]
    # Corrige : la premiere version de ce fichier avait mis
    # `default=""` ici par erreur -- une question texte_trous pouvait
    # donc etre creee SANS AUCUN texte et passer la validation. Meme
    # regle que partout ailleurs desormais : `question` est obligatoire.
    question: str = Field(min_length=1, description='Texte contenant des blancs "___".')
    reponse_correcte: Union[str, List[str]] = Field(
        description="Une chaine s'il n'y a qu'un seul blanc, ou une liste dans l'ordre des blancs s'il y en a plusieurs."
    )

    @field_validator("reponse_correcte")
    @classmethod
    def _verifier_reponse(cls, v: Union[str, List[str]]) -> Union[str, List[str]]:
        if isinstance(v, list):
            if not v:
                raise ValueError("reponse_correcte ne peut pas etre une liste vide.")
            _sans_blancs(v)
        elif not v.strip():
            raise ValueError("reponse_correcte ne peut pas etre vide.")
        return v


class QuestionAssociation(QuestionBase):
    """Exercice d'appariement (relier) : deux colonnes, l'eleve relie
    chaque element de la colonne de gauche a son correspondant a droite.
    Tres frequent niveau 1-3 (relier un chiffre a sa quantite, un mot a
    son image, un debut de phrase a sa fin, un animal a son petit)."""
    type: Literal["association"]
    question: str = Field(min_length=1, description="La consigne, ex: 'Relie chaque chiffre a la bonne quantite.'")
    colonne_gauche: List[str] = Field(min_length=2)
    colonne_droite: List[str] = Field(min_length=2)
    reponse_correcte: List[int] = Field(
        description="Pour chaque element de colonne_gauche (meme index), l'index correspondant dans colonne_droite."
    )

    @field_validator("colonne_gauche", "colonne_droite")
    @classmethod
    def _verifier_colonnes(cls, v: List[str]) -> List[str]:
        return _sans_blancs(v)

    @model_validator(mode="after")
    def _verifier_correspondance(self) -> "QuestionAssociation":
        if len(self.reponse_correcte) != len(self.colonne_gauche):
            raise ValueError("reponse_correcte doit avoir autant d'elements que colonne_gauche.")
        if any(not (0 <= i < len(self.colonne_droite)) for i in self.reponse_correcte):
            raise ValueError("reponse_correcte contient un index hors limites de colonne_droite.")
        return self


class QuestionOrdre(QuestionBase):
    """Remise en ordre : remettre une liste d'elements dans le bon ordre
    (les etapes d'une histoire ou d'une journee, des nombres a ranger du
    plus petit au plus grand, des evenements historiques a situer dans le
    temps)."""
    type: Literal["remise_en_ordre"]
    question: str = Field(min_length=1, description="La consigne, ex: 'Remets ces evenements dans l'ordre.'")
    elements: List[str] = Field(min_length=2)
    reponse_correcte: List[int] = Field(
        description="Permutation des index de `elements` donnant l'ordre correct."
    )

    @field_validator("elements")
    @classmethod
    def _verifier_elements(cls, v: List[str]) -> List[str]:
        return _sans_blancs(v)

    @model_validator(mode="after")
    def _verifier_permutation(self) -> "QuestionOrdre":
        n = len(self.elements)
        if sorted(self.reponse_correcte) != list(range(n)):
            raise ValueError("reponse_correcte doit etre une permutation des index de `elements`.")
        return self


class QuestionTri(QuestionBase):
    """Tri / classement par categories (ex: classe ces mots en noms et
    verbes, trie ces aliments en fruits et legumes, classe ces animaux en
    domestiques/sauvages). A la difference de QuestionOrdre : ici on
    regroupe des elements dans des categories, on ne les met pas dans un
    ordre sequentiel."""
    type: Literal["tri"]
    question: str = Field(min_length=1, description="La consigne, ex: 'Classe ces mots dans le bon tableau.'")
    categories: List[str] = Field(min_length=2, description="Les categories, ex: ['Noms', 'Verbes'].")
    elements: List[str] = Field(min_length=2)
    reponse_correcte: List[int] = Field(
        description="Pour chaque element (meme index), l'index de sa categorie correcte dans `categories`."
    )

    @field_validator("categories", "elements")
    @classmethod
    def _verifier_listes(cls, v: List[str]) -> List[str]:
        return _sans_blancs(v)

    @model_validator(mode="after")
    def _verifier_categories(self) -> "QuestionTri":
        if len(self.reponse_correcte) != len(self.elements):
            raise ValueError("reponse_correcte doit avoir autant d'elements que `elements`.")
        if any(not (0 <= i < len(self.categories)) for i in self.reponse_correcte):
            raise ValueError("reponse_correcte contient un index hors limites de `categories`.")
        return self


class QuestionCalcul(QuestionBase):
    """Probleme ou calcul a reponse numerique (maths, mesures en
    sciences...) -- plus fiable a corriger automatiquement qu'une
    QuestionOuverte quand la reponse est un nombre."""
    type: Literal["calcul"]
    question: str = Field(min_length=1, description="L'enonce du calcul ou du probleme.")
    reponse_correcte: float
    unite: Optional[str] = Field(default=None, description="Unite de la reponse, ex: 'DT', 'cm', 'kg', 'min'.")
    tolerance: float = Field(
        default=0, ge=0, description="Marge d'erreur acceptee (utile pour une mesure approximative)."
    )


class QuestionLegende(QuestionBase):
    """Legender un schema ou une image (ex: les parties d'une plante, d'un
    corps humain, d'une carte) : l'image porte des numeros ou des
    fleches, l'eleve ecrit le nom de chaque partie -- tres frequent en
    eveil scientifique. Contrairement aux autres types, l'image est ICI
    obligatoire (sans elle, l'exercice n'a pas de sens)."""
    type: Literal["legende"]
    question: str = Field(min_length=1, description="Ex: 'Legende les parties de la plante.'")
    image: ImageRef = Field(description="Le schema numerote a legender.")
    reponse_correcte: List[str] = Field(
        min_length=1,
        description="Le nom de chaque partie, dans l'ordre des numeros/fleches sur l'image (1, 2, 3...).",
    )

    @field_validator("reponse_correcte")
    @classmethod
    def _verifier_reponses(cls, v: List[str]) -> List[str]:
        return _sans_blancs(v)


class QuestionDictee(QuestionBase):
    """Dictee : un texte que l'enseignant lit a voix haute, l'eleve
    l'ecrit. Pas de `reponse_correcte` unique comme les autres types --
    la reference EST le texte lui-meme (la correction compare, mot a
    mot, ce que l'eleve a ecrit a `texte_dictee`)."""
    type: Literal["dictee"]
    question: str = Field(
        default="Ecris le texte dicte par ton enseignant.", min_length=1, description="Consigne donnee a l'eleve."
    )
    texte_dictee: str = Field(min_length=1, description="Le texte a dicter, tel que l'eleve doit l'ecrire.")
    mots_difficiles: Optional[List[str]] = Field(
        default=None, description="Mots a ecrire au tableau avant la dictee, si l'enseignant le souhaite."
    )

    @field_validator("mots_difficiles")
    @classmethod
    def _verifier_mots(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return _sans_blancs(v) if v else v


class QuestionRedaction(QuestionBase):
    """Expression ecrite / redaction : un sujet a developper en quelques
    phrases ou paragraphes, sans reponse unique -- evaluee sur des
    criteres plutot que corrigee mot a mot (contrairement a
    QuestionOuverte, plus courte et a reponse determinee)."""
    type: Literal["redaction"]
    question: str = Field(min_length=1, description="Le sujet de redaction / expression ecrite.")
    criteres_evaluation: Optional[List[str]] = Field(
        default=None,
        description="Points evalues, ex: ['Respecte le nombre de lignes demande', 'Utilise le present de l'indicatif'].",
    )
    longueur_min_mots: Optional[int] = Field(default=None, ge=1)

    @field_validator("criteres_evaluation")
    @classmethod
    def _verifier_criteres(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return _sans_blancs(v) if v else v


# Union des types de question "feuille" (sans regroupement) -- reutilisable
# tel quel, y compris comme sous_questions d'un ExerciceLecture ci-dessous.
Question = Annotated[
    Union[
        QuestionQCM,
        QuestionVraiFaux,
        QuestionOuverte,
        QuestionRedaction,
        QuestionTrous,
        QuestionAssociation,
        QuestionOrdre,
        QuestionTri,
        QuestionCalcul,
        QuestionLegende,
        QuestionDictee,
    ],
    Field(discriminator="type"),
]


# =============================================================================
# Lecture / comprehension -- regroupe un texte et/ou une image de support
# avec plusieurs sous-questions qui s'y rapportent. Frequent dans TOUTES les
# matieres, pas seulement en langues : un texte en arabe/francais, une carte
# ou un document en histoire-geo, un schema en sciences, un enonce de
# probleme detaille en maths.
# =============================================================================

class ExerciceLecture(BaseModel):
    """Un texte (et/ou une image, un document) suivi de plusieurs
    sous-questions qui s'y rapportent -- l'exercice de "comprehension"
    qu'on trouve dans les vrais examens tunisiens de toutes les matieres.
    A utiliser plutot que le champ `support` d'une question isolee des
    qu'il y a PLUSIEURS questions sur le meme texte/document (sinon il
    faudrait repeter le texte sur chaque question)."""
    type: Literal["lecture"]
    id: Optional[str] = None
    titre_exercice: Optional[str] = Field(
        default=None, description="Ex: 'Lecture', 'Etude de document', 'Comprehension'."
    )
    texte: Optional[str] = Field(default=None, description="Le texte de lecture / le document a etudier.")
    image: Optional[ImageRef] = Field(
        default=None, description="Une image/carte/document a etudier, en plus ou a la place d'un texte."
    )
    sous_questions: List[Question] = Field(
        min_length=1, description="Les questions qui se rapportent a ce texte/document."
    )

    @model_validator(mode="after")
    def _verifier_support(self) -> "ExerciceLecture":
        if not self.texte and not self.image:
            raise ValueError("Un exercice de lecture doit avoir au moins un texte ou une image de support.")
        return self


# Un element de l'examen est soit une question isolee, soit un exercice de
# lecture regroupant plusieurs sous-questions.
ExamenItem = Annotated[
    Union[
        QuestionQCM,
        QuestionVraiFaux,
        QuestionOuverte,
        QuestionRedaction,
        QuestionTrous,
        QuestionAssociation,
        QuestionOrdre,
        QuestionTri,
        QuestionCalcul,
        QuestionLegende,
        QuestionDictee,
        ExerciceLecture,
    ],
    Field(discriminator="type"),
]


class Examen(BaseModel):
    """Un examen complet, genere selon les parametres fournis par l'enseignant."""
    matiere: str = Field(min_length=1, description="La matiere de l'examen, ex: 'Mathematiques'.")
    niveau: str = Field(min_length=1, description="Le niveau scolaire, ex: '3e annee primaire'.")
    chapitre: str = Field(min_length=1, description="Le ou les chapitres couverts par l'examen.")
    langue: Literal["fr", "ar"]
    duree_estimee_minutes: int = Field(
        ge=1, description="Duree estimee de l'examen en minutes, doit etre positive."
    )
    questions: List[ExamenItem] = Field(
        min_length=1,
        description="Les questions de l'examen -- individuelles, ou groupees dans un exercice de lecture/comprehension (voir ExerciceLecture).",
    )

    @model_validator(mode="after")
    def _verifier_ids_uniques(self) -> "Examen":
        # Un `id` en double (au premier niveau ou dans les sous-questions
        # d'un exercice de lecture) casserait toute logique qui veut
        # cibler UNE question precise par son id (modifier une question,
        # associer une correction...). Les ids absents (None) ne sont pas
        # concernes -- seuls les doublons entre ids REELLEMENT fournis
        # comptent.
        ids: List[str] = []
        for item in self.questions:
            if item.id:
                ids.append(item.id)
            if item.type == "lecture":
                for sous_q in item.sous_questions:
                    if sous_q.id:
                        ids.append(sous_q.id)
        if len(ids) != len(set(ids)):
            doublons = sorted({i for i in ids if ids.count(i) > 1})
            raise ValueError(f"Des `id` sont dupliques dans l'examen : {doublons}")
        return self


if __name__ == "__main__":
    import json
    print(json.dumps(Examen.model_json_schema(), indent=2, ensure_ascii=False))