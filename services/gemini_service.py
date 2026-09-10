#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service Gemini avec API Google AI Studio (corrigé)
"""

import os
import sys
from pathlib import Path
import warnings
warnings.filterwarnings("ignore", message="All support for the `google.generativeai` package has ended")
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configuration Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# Modèles disponibles qui fonctionnent
AVAILABLE_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash", 
    "gemini-pro-latest",
    "gemini-flash-latest"
]

def generate_content(
    prompt: str,
    model_name: str = "gemini-3.6-flash",
    temperature: float = 0.7
) -> str:
    """
    Génère du contenu avec Gemini (Google AI Studio API)
    
    Args:
        prompt: Le prompt à envoyer
        model_name: Nom du modèle à utiliser
        temperature: Niveau de créativité (0.0-1.0)
        
    Returns:
        str: La réponse générée
    """
    try:
        model = genai.GenerativeModel(model_name)
        
        generation_config = genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=8192,
        )
        
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        return response.text
        
    except Exception as e:
        print(f"❌ Erreur Gemini: {e}")
        raise


class GeminiService:
    """Service Gemini avec API Google AI Studio"""
    
    def __init__(self, model_name: str = "gemini-3.6-flash"):
        self.model_name = model_name
        self.model = genai.GenerativeModel(model_name)
    
    def generate_content(
        self,
        prompt: str,
        temperature: float = 0.7
    ) -> str:
        """Génère du contenu avec Gemini"""
        
        generation_config = genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=8192,
        )
        
        response = self.model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        return response.text


def test_service():
    """Test du service"""
    print("🧪 TEST GEMINI SERVICE")
    print("=" * 25)
    
    service = GeminiService()
    
    prompt = "Génère un petit quiz en arabe avec 1 question QCM sur les mathématiques niveau 5. Format JSON simple."
    
    try:
        response = service.generate_content(prompt)
        print(f"✅ Réponse: {response[:200]}...")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")


if __name__ == "__main__":
    test_service()