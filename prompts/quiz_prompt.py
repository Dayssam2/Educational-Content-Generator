def construire_prompt(params, contexte_programme: str = "") -> str:

    langue_label = "français" if params.langue == "fr" else "arabe"

    chapitres_str = ", ".join(params.chapitres)

    types_str = ", ".join(params.types_questions)

    # Ajouter section contexte programme si disponible
    section_programme = ""
    if contexte_programme.strip():
        section_programme = f"""
## PROGRAMME OFFICIEL TUNISIEN (contexte extrait par RAG):
{contexte_programme}

IMPORTANT :
Utilise ce contenu comme SOURCE D'INSPIRATION pour rester conforme au
programme officiel de ce niveau et cette matière — ce n'est pas un texte
à copier ou reformuler tel quel. Retiens l'IDÉE PÉDAGOGIQUE de chaque
chapitre ou leçon (la notion à enseigner, la compétence visée), pas les
mots, exemples ou phrases exacts qui y figurent.

Sois créatif dans la formulation des questions :
- N'utilise pas systématiquement les mêmes exemples donnés dans le
  contexte ; choisis d'autres exemples, mots ou situations adaptés au
  niveau et à la matière, tant qu'ils respectent la même notion.
- Ne reproduis pas la structure du contenu fourni (objectifs, notions,
  détails, exemples) dans les questions — transforme cette information
  en véritables questions et exercices d'examen.
- Ignore les informations qui ne sont pas utiles pour créer une question
  concrète (ex : conseils méthodologiques pour l'enseignant, remarques
  pédagogiques générales, indications de mise en œuvre en classe).
- Adapte la complexité du vocabulaire et des questions au niveau de
  difficulté demandé ({params.difficulte}), même si le contenu fourni
  ne distingue pas plusieurs niveaux de difficulté pour une même notion.
"""

    prompt = f"""Tu es un assistant pédagogique spécialisé dans le programme
scolaire officiel tunisien de l'enseignement primaire. Tu conçois des examens
pour des enseignants tunisiens.
{section_programme}
Génère un examen avec les caractéristiques suivantes :
- Matière : {params.matiere}
- Niveau : {params.niveau}
- Chapitres à couvrir : {chapitres_str}
- Types de questions à utiliser : {types_str}
- Nombre total de questions : {params.nb_questions}
- Difficulté : {params.difficulte}
- Durée prévue de l'examen : {params.duree_minutes} minutes
- Langue de rédaction : {langue_label}

Contraintes pédagogiques à respecter strictement :
- Utilise un vocabulaire adapté à des élèves de 6 à 12 ans, clair et simple.
- Reste strictement dans les limites du programme officiel tunisien pour ce
  niveau et cette matière : n'introduis aucune notion hors-programme.
- Pour chaque question de type QCM : propose exactement 4 options, avec une
  seule bonne réponse. Les 3 mauvaises réponses doivent être plausibles et
  liées au sujet (pas absurdes ni évidentes à écarter).
- Pour chaque question de type texte à trous : utilise "___" pour marquer
  chaque blanc, et fournis les réponses attendues dans le même ordre que les
  blancs apparaissent dans le texte.
- Varie les chapitres couverts et évite de répéter deux fois la même question
  ou la même formulation.
- Adapte le niveau de difficulté des questions à la difficulté demandée
  ({params.difficulte}).

Génère maintenant l'examen complet en respectant ces règles."""

    return prompt