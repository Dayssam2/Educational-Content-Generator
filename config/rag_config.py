#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration centralisée pour le système RAG
"""

# Configuration des modèles
GEMINI_MODEL = "gemini-1.5-flash"  # Modèle Gemini unifié
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"  # Modèle d'embeddings par défaut

# Configuration ChromaDB
CHROMADB_PERSIST_DIR = "./rag_database_tunisienne"  # Nouvelle base de données
DATA_SOURCE_PATH = "./database_tunisienne"  # NOUVELLE BASE DE DONNÉES
COLLECTION_NAME = "database_tunisienne_lessons"

# Configuration de recherche
DEFAULT_N_RESULTS = 10
MAX_SEARCH_VARIANTS = 5
MIN_CONFIDENCE_THRESHOLD = 0.15
MAX_QUERY_RESULTS = 20

# Configuration de chunking
DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 200

# Configuration de logging
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"

# Mots vides pour les recherches
STOP_WORDS = {
    "ar": {"من", "إلى", "في", "على", "عن", "مع", "بعد", "قبل", "هذا", "هذه", "ذلك", "تلك"},
    "fr": {"le", "la", "les", "de", "du", "des", "et", "ou", "dans", "sur", "avec", "pour", "par"},
    "en": {"the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with", "by"}
}

# Configuration des niveaux scolaires
NIVEAU_MAPPING = {
    '1': 'السنة الأولى من التعليم الابتدائي',
    '2': 'السنة الثانية من التعليم الابتدائي', 
    '3': 'السنة الثالثة من التعليم الابتدائي',
    '4': 'السنة الرابعة من التعليم الابتدائي',
    '5': 'السنة الخامسة من التعليم الابتدائي',
    '6': 'السنة السادسة من التعليم الابتدائي',
}

# Configuration des matières
MATIERE_MAPPING = {
    "arabe": "اللغة العربية",
    "mathematique": "الرياضيات", 
    "science": "الإيقاظ العلمي",
    "francais": "الفرنسية",
    "histoire": "التاريخ",
    "geo": "الجغرافيا",
    "madaniya": "التربية المدنية",
    "physique": "الفيزياء",
}

# Chemins par défaut
DEFAULT_LESSONS_DIR = "extracted_lessons_complete"
OPENAI_LESSONS_DIR = "extracted_lessons_openai_complete"