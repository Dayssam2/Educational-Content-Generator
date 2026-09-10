"""
Validateur d'examens
"""

from typing import Dict, List

class ExamValidator:
    """Valide la structure et le contenu des examens"""
    
    @staticmethod
    def validate_exam(exam_data: Dict) -> tuple[bool, List[str]]:
        """
        Valide un examen
        
        Args:
            exam_data: Données de l'examen
        
        Returns:
            (is_valid, list_of_errors)
        """
        errors = []
        
        # Vérifier les champs obligatoires
        required_fields = ['titre', 'matiere', 'niveau', 'lecon', 'langue', 'questions']
        for field in required_fields:
            if field not in exam_data:
                errors.append(f"Champ obligatoire manquant: {field}")
        
        # Vérifier les questions
        if 'questions' in exam_data:
            questions = exam_data['questions']
            
            if not isinstance(questions, list):
                errors.append("'questions' doit être une liste")
            elif len(questions) == 0:
                errors.append("L'examen doit contenir au moins une question")
            else:
                # Valider chaque question
                for i, q in enumerate(questions):
                    q_errors = ExamValidator._validate_question(q, i+1)
                    errors.extend(q_errors)
        
        is_valid = len(errors) == 0
        return is_valid, errors
    
    @staticmethod
    def _validate_question(question: Dict, num: int) -> List[str]:
        """Valide une question individuelle"""
        errors = []
        
        # Type de question
        if 'type' not in question:
            errors.append(f"Question {num}: type manquant")
            return errors
        
        qtype = question['type']
        
        # Champs communs
        if 'question' not in question and qtype != 'texte_a_trous':
            errors.append(f"Question {num}: texte manquant")
        
        if 'reponse_correcte' not in question:
            errors.append(f"Question {num}: réponse correcte manquante")
        
        # Validation spécifique par type
        if qtype == 'qcm':
            if 'options' not in question:
                errors.append(f"Question {num} (QCM): options manquantes")
            elif not isinstance(question['options'], list):
                errors.append(f"Question {num} (QCM): options doit être une liste")
            elif len(question['options']) < 2:
                errors.append(f"Question {num} (QCM): au moins 2 options requises")
        
        elif qtype == 'vrai_faux':
            if 'reponse_correcte' in question:
                if not isinstance(question['reponse_correcte'], bool):
                    errors.append(f"Question {num} (Vrai/Faux): réponse doit être true ou false")
        
        elif qtype == 'texte_a_trous':
            if 'texte' not in question:
                errors.append(f"Question {num} (Trous): texte manquant")
            if 'reponse_correcte' in question:
                if not isinstance(question['reponse_correcte'], list):
                    errors.append(f"Question {num} (Trous): réponses doivent être une liste")
        
        return errors
    
    @staticmethod
    def validate_scenario_result(result: Dict) -> tuple[bool, List[str]]:
        """
        Valide le résultat complet d'un scénario
        
        Args:
            result: Résultat du générateur
        
        Returns:
            (is_valid, list_of_errors)
        """
        errors = []
        
        if not result.get('succes'):
            # Si déjà marqué comme échec, récupérer les erreurs
            errors = result.get('erreurs', ['Génération échouée'])
            return False, errors
        
        # Valider l'examen si présent
        if 'examen' in result and result['examen']:
            is_valid, exam_errors = ExamValidator.validate_exam(result['examen'])
            errors.extend(exam_errors)
            return is_valid, errors
        else:
            errors.append("Aucun examen généré")
            return False, errors
