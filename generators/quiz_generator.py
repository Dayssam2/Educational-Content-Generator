from dataclasses import dataclass
import sys
from pathlib import Path

# Ajouter root au path
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

from models.models import Examen
from services.gemini_service import generate_content
from prompts.quiz_prompt import construire_prompt
from rag_system import SimpleRAG


MODEL_NAME = "gemini-1.5-flash"  # Modèle stable unifié

@dataclass
class ParametresExamen:
    """
    Représente ce qu'un enseignant choisirait dans l'interface .
    Cette classe est déjà complète, tu n'as rien à faire ici — mais regarde
    bien les champs, tu vas les utiliser dans construire_prompt().
    """
    matiere: str
    niveau: str
    chapitres: list[str]
    types_questions: list[str] 
    nb_questions: int
    difficulte: str 
    duree_minutes: int
    langue: str = "fr"  



def generer_html_quiz_interactif(examen: Examen, params: ParametresExamen, sources_rag: list = None) -> str:
    """
    Génère le HTML QUIZ INTERACTIF avec TEMPLATE_HTML de rapport.py
    
    Args:
        examen: L'examen généré
        params: Paramètres de l'examen
        sources_rag: Sources RAG utilisées
    
    Returns:
        HTML du quiz interactif
    """
    from frontend.rapport import TEMPLATE_HTML
    import json
    
    # Préparer les données au format attendu par TEMPLATE_HTML
    scenarios = []
    
    scenario_data = {
        'scenario': 1,
        'matiere': params.matiere,
        'niveau': params.niveau,
        'lecon': ", ".join(params.chapitres) if params.chapitres else "Quiz général",
        'tentatives': 1,
        'succes': True,
        'erreurs': [],
        'examen': {
            'matiere': params.matiere,
            'niveau': params.niveau,
            'chapitre': ", ".join(params.chapitres) if params.chapitres else "Quiz",
            'lecon': ", ".join(params.chapitres) if params.chapitres else "Quiz général",
            'langue': params.langue,
            'duree_estimee_minutes': params.duree_minutes,
            'questions': []
        }
    }
    
    # Convertir chaque question au format du template
    for q in examen.questions:
        question_data = {
            'points': 2,
            'difficulte': params.difficulte
        }
        
        # Détecter le type de question et formater en conséquence
        if q.type == 'qcm':
            question_data['type'] = 'qcm'
            question_data['question'] = q.question
            question_data['options'] = q.options
            question_data['reponse_correcte'] = q.reponse_correcte
            question_data['explication'] = getattr(q, 'explication', '')
            
        elif q.type == 'vrai_faux':
            question_data['type'] = 'vrai_faux'
            question_data['question'] = q.question
            question_data['reponse_correcte'] = (q.reponse_correcte == True or 
                                                 q.reponse_correcte == 'Vrai' or 
                                                 q.reponse_correcte == 'vrai')
            question_data['explication'] = getattr(q, 'explication', '')
            
        elif q.type == 'texte_a_trous':
            question_data['type'] = 'texte_a_trous'
            question_data['texte'] = q.texte
            # QuestionTrous utilise reponse_correcte (liste)
            reponse = q.reponse_correcte
            question_data['reponse_correcte'] = reponse if isinstance(reponse, list) else [reponse]
            question_data['explication'] = getattr(q, 'explication', '')
            
        else:
            # Question ouverte ou autre type
            question_data['type'] = 'qcm'  # Fallback
            question_data['question'] = getattr(q, 'question', str(q))
            question_data['options'] = getattr(q, 'options', [])
            question_data['reponse_correcte'] = getattr(q, 'reponse_correcte', '')
            question_data['explication'] = getattr(q, 'explication', '')
        
        scenario_data['examen']['questions'].append(question_data)
    
    scenarios.append(scenario_data)
    
    # Injecter les données dans le template
    html = TEMPLATE_HTML.replace('__DATA_JSON__', json.dumps(scenarios, ensure_ascii=False))
    
    return html


def sauvegarder_examen(examen: Examen, params: ParametresExamen, sources_rag: list = None, 
                       nom_fichier: str = "quiz_genere") -> tuple[str, str]:
    """
    Sauvegarde l'examen en JSON et HTML quiz interactif
    
    Returns:
        (chemin_json, chemin_html)
    """
    # Sauvegarder JSON
    json_path = Path(_ROOT) / f"{nom_fichier}.json"
    json_path.write_text(examen.model_dump_json(indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"\n💾 JSON sauvegardé: {json_path}")
    
    # Générer et sauvegarder HTML quiz interactif
    html_content = generer_html_quiz_interactif(examen, params, sources_rag)
    html_path = Path(_ROOT) / f"{nom_fichier}_quiz.html"
    html_path.write_text(html_content, encoding='utf-8')
    print(f"🎨 HTML Quiz interactif sauvegardé: {html_path}")
    
    return str(json_path), str(html_path)


def generer_examen(
        params: ParametresExamen,
        temperature: float = 0.7,
        use_rag: bool = True
) -> Examen:
    """
    Génère un examen avec RAG (Retrieval Augmented Generation)
    
    Args:
        params: Paramètres de l'examen
        temperature: Créativité du modèle
        use_rag: Si True, utilise le RAG pour récupérer le contexte du programme officiel
    
    Returns:
        Examen généré conforme au programme tunisien
    """
    
    # Récupérer contexte du programme officiel avec RAG
    contexte_programme = ""
    sources_rag = []
    
    if use_rag:
        try:
            print("\n🔍 Récupération du contexte RAG...")
            
            # Initialiser SimpleRAG
            lessons_dir = Path(_ROOT) / "extracted_lessons_complete"
            rag_system = SimpleRAG(lessons_dir=str(lessons_dir))
            
            # Rechercher les leçons correspondantes
            chapitres_str = " ".join(params.chapitres) if params.chapitres else params.matiere
            
            print(f"   🔍 Recherche: '{chapitres_str}'")
            print(f"   📖 Matière: {params.matiere}")
            print(f"   🎓 Niveau: {params.niveau}")
            
            # Extraire le numéro de niveau
            niveau_num = ""
            for i in ['1', '2', '3', '4', '5', '6']:
                if i in params.niveau:
                    niveau_num = i
                    break
            
            if not niveau_num:
                niveau_num = "3"  # Défaut
            
            print(f"   🔢 Niveau extrait: {niveau_num}")
            
            # Indexer si nécessaire
            rag_system.index_all()
            
            # Rechercher avec SimpleRAG
            result = rag_system.search(
                query=chapitres_str,
                matiere=params.matiere.lower(),  
                niveau=niveau_num,
                n_results=5
            )
            
            if result['results']:
                # Construire le contexte à partir des résultats
                contexte_parts = []
                sources_rag = []
                
                for i, res in enumerate(result['results'][:3], 1):
                    content = res['content']
                    metadata = res['metadata']
                    
                    sources_rag.append(metadata.get('titre', f'Source {i}'))
                    
                    # Construire le contexte
                    ctx = f"\n## {metadata.get('titre', f'Extrait {i}')}\n"
                    ctx += f"**Matière:** {metadata.get('matiere', 'N/A')}\n"
                    ctx += f"**Niveau:** {metadata.get('niveau', 'N/A')}\n\n"
                    ctx += f"**Contenu:**\n{content[:800]}\n\n"
                    
                    contexte_parts.append(ctx)
                
                contexte_programme = "\n".join(contexte_parts)
                print(f"✅ RAG: {len(result['results'])} chunks trouvés")
                print(f"📚 Sources: {', '.join(sources_rag[:2])}")
            else:
                print("⚠️  RAG: Aucun contenu trouvé, génération sans contexte")
                
        except Exception as e:
            print(f"⚠️  Erreur RAG: {e}")
            import traceback
            traceback.print_exc()
            print("   Génération sans contexte RAG")

    # Construire prompt avec contexte RAG
    prompt = construire_prompt(params, contexte_programme)

    print("\n🤖 Génération avec Gemini...")
    response = generate_content(prompt)

    examen = Examen.model_validate_json(response)
    
    # Ajouter métadonnées RAG
    if sources_rag:
        examen._rag_sources = sources_rag  # Attribut custom
    
    print(f"✅ Examen généré: {len(examen.questions)} questions")

    return examen, sources_rag  # 🆕 Retourner aussi les sources



def interface_cli_interactive():
    """Interface CLI interactive pour générer un quiz"""
    
    print("\n" + "="*60)
    print("🎓 GÉNÉRATEUR DE QUIZ INTERACTIF - PROGRAMME TUNISIEN")
    print("="*60)
    
    print("\n📝 Veuillez saisir les informations suivantes:\n")
    
    # 1. Chapitre/Leçon
    print("📚 Chapitre ou leçon (ex: الجمع والطرح, Les fractions):")
    lecon = input("➤ ").strip()
    if not lecon:
        lecon = "Révision générale"
    
    # 2. Matière
    print("\n📖 Matière - Exemples:")
    print("   • الرياضيات (Mathématiques)")
    print("   • اللغة العربية (Langue arabe)")
    print("   • الفرنسية (Français)")
    print("   • الإيقاظ العلمي (Sciences)")
    print("   • التربية الإسلامية (Éducation islamique)")
    print("   • التاريخ (Histoire)")
    print("   • الجغرافيا (Géographie)")
    matiere = input("📖 Matière: ").strip()
    if not matiere:
        matiere = "Mathématiques"
    
    # 3. Niveau
    print("\n🎓 Niveau - Exemples:")
    print("   • السنة الأولى من التعليم الابتدائي")
    print("   • السنة الثانية من التعليم الابتدائي")
    print("   • السنة الثالثة من التعليم الابتدائي")
    print("   • السنة الرابعة من التعليم الابتدائي")
    print("   • السنة الخامسة من التعليم الابتدائي")
    print("   • السنة السادسة من التعليم الابتدائي")
    print("   • Ou simplement: 1, 2, 3, 4, 5, 6")
    niveau = input("🎓 Niveau: ").strip()
    if not niveau:
        niveau = "3"
    
    # Normaliser le niveau si c'est juste un chiffre
    if niveau in ['1', '2', '3', '4', '5', '6']:
        niveau_map = {
            '1': 'السنة الأولى من التعليم الابتدائي',
            '2': 'السنة الثانية من التعليم الابتدائي',
            '3': 'السنة الثالثة من التعليم الابتدائي',
            '4': 'السنة الرابعة من التعليم الابتدائي',
            '5': 'السنة الخامسة من التعليم الابتدائي',
            '6': 'السنة السادسة من التعليم الابتدائي'
        }
        niveau = niveau_map[niveau]
    
    # 4. Types de questions
    print("\n❓ Types de questions (séparés par des virgules):")
    print("   • qcm (Questions à choix multiples)")
    print("   • vrai_faux (Questions Vrai/Faux)")
    print("   • texte_a_trous (Compléter les blancs)")
    types_input = input("❓ Types (défaut=qcm,vrai_faux): ").strip()
    if not types_input:
        types_questions = ['qcm', 'vrai_faux']
    else:
        types_questions = [t.strip() for t in types_input.split(',')]
    
    # 5. Nombre de questions
    nb_questions_input = input("\n🔢 Nombre de questions (défaut=8): ").strip()
    nb_questions = int(nb_questions_input) if nb_questions_input.isdigit() else 8
    
    # 6. Difficulté
    print("\n⭐ Difficulté:")
    print("   1. Facile")
    print("   2. Moyen")
    print("   3. Difficile")
    difficulte_input = input("⭐ Choix (1-3, défaut=2): ").strip()
    difficulte_map = {'1': 'facile', '2': 'moyen', '3': 'difficile'}
    difficulte = difficulte_map.get(difficulte_input, 'moyen')
    
    # 7. Durée
    duree_input = input("\n⏱️  Durée en minutes (défaut=30): ").strip()
    duree = int(duree_input) if duree_input.isdigit() else 30
    
    # 8. Langue
    print("\n🌐 Langue:")
    print("   1. Arabe (ar)")
    print("   2. Français (fr)")
    langue_input = input("🌐 Choix (1-2, défaut=1): ").strip()
    langue = 'ar' if langue_input != '2' else 'fr'
    
    # Résumé
    print("\n" + "="*60)
    print("📋 RÉSUMÉ DE VOTRE QUIZ:")
    print("-"*60)
    print(f"📚 Chapitre: {lecon}")
    print(f"📖 Matière: {matiere}")
    print(f"🎓 Niveau: {niveau}")
    print(f"❓ Types: {', '.join(types_questions)}")
    print(f"🔢 Questions: {nb_questions}")
    print(f"⭐ Difficulté: {difficulte}")
    print(f"⏱️  Durée: {duree} minutes")
    print(f"🌐 Langue: {langue}")
    print("-"*60)
    
    confirmer = input("\n✅ Générer ce quiz? (o/N): ").strip().lower()
    if confirmer not in ['o', 'oui', 'y', 'yes']:
        print("\n❌ Génération annulée.")
        return
    
    # Générer le quiz
    print("\n" + "="*60)
    print("🚀 GÉNÉRATION DU QUIZ EN COURS...")
    print("="*60)
    
    params = ParametresExamen(
        matiere=matiere,
        niveau=niveau,
        chapitres=[lecon],
        types_questions=types_questions,
        nb_questions=nb_questions,
        difficulte=difficulte,
        duree_minutes=duree,
        langue=langue
    )
    
    try:
        examen, sources = generer_examen(params, use_rag=True)
        
        print(f"\n✅ Quiz généré avec succès!")
        print(f"📝 {len(examen.questions)} questions créées")
        print(f"⏱️  Durée estimée: {examen.duree_estimee_minutes} min")
        
        if sources:
            print(f"📚 Sources RAG: {', '.join(sources[:3])}")
        
        # Sauvegarder
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        nom_fichier = f"quiz_{timestamp}"
        
        json_path, html_path = sauvegarder_examen(examen, params, sources, nom_fichier)
        
        print("\n" + "="*60)
        print("✅ QUIZ GÉNÉRÉ AVEC SUCCÈS!")
        print("="*60)
        print(f"📄 JSON: {json_path}")
        print(f"🎨 HTML Quiz interactif: {html_path}")
        print("\n💡 Ouvrez le fichier HTML dans votre navigateur pour voir le quiz interactif!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ ERREUR lors de la génération: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    
    # Mode CLI interactif par défaut
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        # Mode test (ancien comportement)
        print("\n🧪 MODE TEST ACTIVÉ\n")
        
        # TEST 1: Math niveau 1 avec RAG
        print("\n" + "="*60)
        print("TEST 1: Mathématiques 1ère année avec RAG")
        print("="*60)
        
        params = ParametresExamen(
            matiere="Mathématiques",
            niveau="1ère année primaire",
            chapitres=["الأعداد من 0 إلى 9", "الجمع"],
            types_questions=["qcm", "texte_a_trous"],
            nb_questions=5,
            difficulte="facile",
            duree_minutes=30,
            langue="ar",
        )

        examen, sources = generer_examen(params, use_rag=True)

        print(f"\n✅ Examen généré : {examen.matiere} — {examen.niveau}")
        print(f"📝 Nombre de questions : {len(examen.questions)}")
        print(f"⏱️  Durée : {examen.duree_estimee_minutes} min")
        
        if sources:
            print(f"📚 Sources RAG : {sources}")
        
        print("\n--- Aperçu des questions ---")
        for i, q in enumerate(examen.questions[:3], 1):
            print(f"\n{i}. Type: {q.type}")
            if hasattr(q, 'question'):
                print(f"   Question: {q.question[:100]}...")
            elif hasattr(q, 'texte'):
                print(f"   Texte: {q.texte[:100]}...")
        
        # 🆕 Sauvegarder JSON + HTML quiz interactif
        json_path, html_path = sauvegarder_examen(examen, params, sources, "test_exam_math1_rag")
        print(f"\n✅ Fichiers générés:")
        print(f"   📄 JSON: {json_path}")
        print(f"   🎨 HTML Quiz: {html_path}")
        
        # TEST 2: Sans RAG pour comparaison
        print("\n" + "="*60)
        print("TEST 2: Mathématiques 3ème année SANS RAG (comparaison)")
        print("="*60)
        
        params2 = ParametresExamen(
            matiere="Mathématiques",
            niveau="3e année primaire",
            chapitres=["Les fractions simples", "L'addition à retenue"],
            types_questions=["qcm", "vrai_faux"],
            nb_questions=4,
            difficulte="moyen",
            duree_minutes=20,
            langue="fr",
        )

        examen2, sources2 = generer_examen(params2, use_rag=False)
        
        print(f"\n✅ Examen généré : {examen2.matiere} — {examen2.niveau}")
        print(f"📝 Nombre de questions : {len(examen2.questions)}")
        
        # 🆕 Sauvegarder JSON + HTML quiz interactif
        json_path2, html_path2 = sauvegarder_examen(examen2, params2, sources2, "test_exam_math3_no_rag")
        print(f"\n✅ Fichiers générés:")
        print(f"   📄 JSON: {json_path2}")
        print(f"   🎨 HTML Quiz: {html_path2}")
        
    else:
        # Mode CLI interactif (par défaut)
        interface_cli_interactive()