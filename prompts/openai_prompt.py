#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
OPENAI PROMPT GENERATOR
Générateur de prompts spécialisés pour l'extraction de leçons avec OpenAI ChatGPT 4o
"""

def openai_prompt(content, matiere, niveau, langue):
    """
    Crée un prompt optimisé pour OpenAI selon la matière
    
    Args:
        content (str): Contenu du fichier à analyser
        matiere (str): Matière (arabe, mathematique, science, francais, etc.)
        niveau (str): Niveau (1, 2, 3, 4, 5, 6)
        langue (str): Langue (ar, fr)
    
    Returns:
        str: Prompt complet pour OpenAI
    """
    
    # 1️⃣ PROMPT DE BASE (contexte tunisien universel)
    base_prompt = f"""Tu es un expert pédagogue tunisien spécialisé en {matiere} niveau {niveau}.

MISSION: Analyse ce contenu du programme officiel tunisien et extrait TOUTES les leçons avec un maximum de détails pédagogiques.

CONTEXTE:
- Matière: {matiere}
- Niveau: {niveau} 
- Langue: {langue}
- Programme: Tunisien officiel

INSTRUCTIONS DÉTAILLÉES:
1. Identifie CHAQUE leçon distincte dans le texte
2. Pour chaque leçon, extrait le MAXIMUM d'informations
3. Sois EXHAUSTIF - n'oublie aucune leçon, même petite
4. Extrait les détails fins et nuances pédagogiques
5. Préserve le contenu original (arabe/français)

"""

    # 2️⃣ PROMPTS SPÉCIALISÉS PAR MATIÈRE
    if matiere == "francais":
        specialized_prompt = """
FOCUS SPÉCIAL FRANÇAIS:
- Différences phonétiques précises (S/Z, P/B, etc.)
- Règles d'orthographe détaillées
- Conjugaisons complètes
- Vocabulaire par thèmes
- Grammaire avec exemples
- Progressions syllabiques
- Cas particuliers et exceptions

DÉTAILS À EXTRAIRE:
• Sons et phonèmes précis
• Règles d'orthographe spécifiques
• Listes de mots par catégorie
• Difficultés fréquentes
• Méthodes d'apprentissage
• Exemples concrets
"""
    
    elif matiere in ["mathematique", "mathematiques"]:
        specialized_prompt = """
FOCUS SPÉCIAL MATHÉMATIQUES:
- Concepts numériques détaillés
- Opérations étape par étape
- Géométrie avec propriétés
- Résolutions de problèmes
- Manipulations concrètes
- Représentations multiples

DÉTAILS À EXTRAIRE:
• Algorithmes de calcul
• Propriétés mathématiques
• Méthodes de résolution
• Matériel pédagogique
• Erreurs fréquentes
• Applications pratiques
"""
    
    elif matiere == "arabe":
        specialized_prompt = """
FOCUS SPÉCIAL ARABE:
- Phonétique arabe précise
- Règles de lecture
- Calligraphie détaillée
- Morphologie des mots
- Grammaire (إعراب)
- Littérature et patrimoine

DÉTAILS À EXTRAIRE:
• Prononciation exacte des lettres
• Règles de تجويد
• Formes de lettres
• Familles de mots
• Constructions grammaticales
• Expressions culturelles
"""
    
    elif matiere in ["science", "sciences"]:
        specialized_prompt = """
FOCUS SPÉCIAL SCIENCES:
- Phénomènes naturels détaillés
- Expériences pratiques
- Schémas et cycles
- Vocabulaire scientifique
- Observations à faire
- Environnement tunisien

DÉTAILS À EXTRAIRE:
• Protocoles d'expériences
• Schémas annotés
• Vocabulaire technique
• Matériel nécessaire
• Applications quotidiennes
• Phénomènes locaux
"""
    
    else:
        specialized_prompt = """
FOCUS GÉNÉRAL:
- Concepts clés détaillés
- Savoir-faire spécifiques
- Applications pratiques
- Vocabulaire technique
- Méthodes d'évaluation

DÉTAILS À EXTRAIRE:
• Définitions précises
• Procédures détaillées
• Exemples concrets
• Exercices types
• Liens interdisciplinaires
"""

    # 3️⃣ FORMAT JSON (structure exacte)
    format_prompt = """
FORMAT JSON EXACT REQUIS:
{
  "lecons": [
    {
      "titre": "Titre exact de la leçon",
      "objectifs": ["objectif 1", "objectif 2", "objectif 3"],
      "notions": ["notion 1", "notion 2", "terme: définition"],
      "details": ["détail pédagogique 1", "règle importante", "conseil pratique"],
      "exemples": ["exemple concret 1", "activité proposée", "exercice type"],
      "langue_contenu": "arabe ou francais selon la matière",
      "matiere_francais": "Nom français de la matière (Arabe, Mathématiques, Sciences, etc.)"
    }
  ]
}

INSTRUCTIONS:
- Utilise EXACTEMENT cette structure à 7 champs
- Extrais TOUTES les leçons du texte
- Sois précis et exhaustif
- Conserve le vocabulaire original (arabe/français)
- Remplis langue_contenu: "arabe" pour matières arabes, "francais" pour français
- Remplis matiere_francais avec le nom français complet

TEXTE À ANALYSER:
"""

    # 🔄 ASSEMBLAGE FINAL
    return base_prompt + specialized_prompt + format_prompt + content[:4000]


