import json
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass
import re


@dataclass
class Document:
    id: str
    content: str
    metadata: Dict[str, Any]


class DocumentLoader:
    def __init__(self, lessons_dir: str = "database_tunisienne"):
        self.lessons_dir = Path(lessons_dir)
        self.documents: List[Document] = []

    def load_all_documents(self) -> List[Document]:
        if not self.lessons_dir.exists():
            raise FileNotFoundError(f"Dossier {self.lessons_dir} introuvable")

        self.documents = []

        for filepath in self.lessons_dir.glob("*.json"):
            docs = self._load_tunisian_file(filepath)
            self.documents.extend(docs)

        print(f"✅ {len(self.documents)} chapitres chargés depuis la base de données tunisienne")
        return self.documents

    def _load_tunisian_file(self, filepath: Path) -> List[Document]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"❌ Erreur lecture {filepath}: {e}")
            return []

        documents = []

        raw_matiere = data.get('matiere', 'unknown')
        matiere = raw_matiere.lower().replace('ç', 'c')

        if "التاريخ والجغرافيا" in raw_matiere:
            matiere = "histoire_geo"
        elif "المواد الاجتماعية" in raw_matiere:
            matiere = "histoire_geo_madania"
        elif "اللغة العربية" in raw_matiere:
            matiere = "arabe"
        elif "الرياضيات" in raw_matiere:
            matiere = "mathematique"
        elif "الإيقاظ العلمي" in raw_matiere:
            matiere = "science"

        niveau = str(data.get('niveau', '1'))

        if "الخامسة" in niveau or "السنة الخامسة" in niveau:
            niveau = "5"
        elif "السادسة" in niveau or "السنة السادسة" in niveau:
            niveau = "6"
        elif "الرابعة" in niveau or "السنة الرابعة" in niveau:
            niveau = "4"
        elif "الثالثة" in niveau or "السنة الثالثة" in niveau:
            niveau = "3"
        elif "الثانية" in niveau or "السنة الثانية" in niveau:
            niveau = "2"
        elif "الأولى" in niveau or "السنة الأولى" in niveau:
            niveau = "1"
        else:
            match = re.search(r'\d+', niveau)
            if match:
                niveau = match.group()

        chapitres = data.get('chapitres', [])

        for i, chapitre in enumerate(chapitres):
            if not isinstance(chapitre, dict):
                continue

            titre = chapitre.get('titre', f'Chapitre {i+1}')
            notions = chapitre.get('notions', [])
            page = chapitre.get('page', f'p{i+1}')
            type_chapitre = chapitre.get('type', '')
            resume = chapitre.get('resume', '')

            if isinstance(notions, list):
                notions_text = '\n'.join([f"• {notion}" for notion in notions])
            else:
                notions_text = str(notions) if notions else ''

            content_parts = [f"MATIÈRE: {matiere.title()}"]
            content_parts.append(f"NIVEAU: {niveau}")
            if type_chapitre:
                content_parts.append(f"TYPE: {type_chapitre}")
            content_parts.append(f"TITRE: {titre}")
            content_parts.append(f"PAGE: {page}")
            if resume:
                content_parts.append(f"RESUME: {resume}")
            content_parts.append(f"NOTIONS:\n{notions_text}")

            content = '\n'.join(content_parts)

            clean_titre = re.sub(r'[^\w\s-]', '', titre).strip()[:30]
            doc_id = f"{matiere}_{niveau}_{i+1:03d}_{clean_titre}"

            doc = Document(
                id=doc_id,
                content=content,
                metadata={
                    'matiere': matiere,
                    'niveau': niveau,
                    'titre': titre,
                    'notions': notions,
                    'resume': resume,
                    'page': page,
                    'type': type_chapitre,
                    'file_path': str(filepath),
                    'chapitre_index': i + 1,
                    'total_notions': len(notions) if isinstance(notions, list) else 1
                }
            )
            documents.append(doc)

        print(f"📖 {len(documents)} chapitres chargés depuis {filepath.name}")
        return documents

    def get_by_matiere_niveau(self, matiere: str, niveau: str) -> List[Document]:
        return [
            doc for doc in self.documents
            if doc.metadata.get('matiere') == matiere and doc.metadata.get('niveau') == str(niveau)
        ]

    def get_by_matiere(self, matiere: str) -> List[Document]:
        return [doc for doc in self.documents if doc.metadata.get('matiere') == matiere]

    def get_by_type(self, type_chapitre: str) -> List[Document]:
        return [doc for doc in self.documents if doc.metadata.get('type') == type_chapitre]

    def get_statistics(self) -> Dict[str, Any]:
        stats = {
            'total_documents': len(self.documents),
            'par_matiere': {},
            'par_niveau': {},
            'par_type': {}
        }

        for doc in self.documents:
            matiere = doc.metadata.get('matiere', 'unknown')
            stats['par_matiere'][matiere] = stats['par_matiere'].get(matiere, 0) + 1

            niveau = doc.metadata.get('niveau', 'unknown')
            stats['par_niveau'][niveau] = stats['par_niveau'].get(niveau, 0) + 1

            type_doc = doc.metadata.get('type', 'aucun')
            if type_doc:
                stats['par_type'][type_doc] = stats['par_type'].get(type_doc, 0) + 1

        return stats
