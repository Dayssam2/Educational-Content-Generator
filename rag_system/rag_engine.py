from typing import List, Dict
from .document_loader import DocumentLoader
from .chunker import DocumentChunker
from .embedder import TextEmbedder
from .vector_store import VectorStore
import re

_ARABIC_DIACRITICS = re.compile(
    r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]'
)


def _strip_diacritics(text: str) -> str:
    text = _ARABIC_DIACRITICS.sub('', text)
    text = text.replace('ـ', '')
    text = re.sub(r'[إأآا]', 'ا', text)
    text = text.replace('ى', 'ي')
    text = text.replace('ة', 'ه')
    text = text.replace('ؤ', 'و')
    text = text.replace('ئ', 'ي')
    return text


def _normalize_punct_for_matching(text: str) -> str:
    text = re.sub(r'[\-\u2013\u2014:/,]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


STOPWORDS_FR = {
    "dans", "avec", "pour", "être", "sont", "cette", "comme", "plus", "très",
    "leur", "elle", "nous", "vous", "cela", "tout", "peut", "fait", "cet",
    "aux", "des", "les", "une", "son", "ses", "ces", "que", "qui", "quoi",
    "sur", "sous", "être", "avoir",
}
STOPWORDS_AR = {
    "هذا", "هذه", "التي", "الذي", "على", "الى", "إلى", "حيث", "بين", "كان",
    "كانت", "حول", "ذلك", "تلك", "كما", "بعض", "كل",
}
STOPWORDS = STOPWORDS_FR | STOPWORDS_AR

EXACT_MIN_WORD_LEN = 3
EXACT_TITLE_SHORT_BASE = 80
EXACT_TITLE_SHORT_BONUS_PER_HIT = 5
EXACT_TITLE_SHORT_BONUS_MAX = 15
EXACT_TITLE_MEDIUM_BASE = 70
EXACT_TITLE_MEDIUM_BONUS_PER_HIT = 3
EXACT_TITLE_MEDIUM_BONUS_MAX = 10
EXACT_TITLE_LONG_BASE = 60
EXACT_TITLE_LONG_BONUS_PER_HIT = 2
EXACT_TITLE_LONG_BONUS_MAX = 8
EXACT_TITLE_PARTIAL = 65
EXACT_TITLE_WORD_MATCH = 60
EXACT_NOTIONS_MATCH = 55
EXACT_NOTIONS_PARTIAL = 50
EXACT_NOTIONS_WORD_MATCH = 45
EXACT_TITLE_MAX_RESULTS = 5

SEMANTIC_TITLE_FLOOR_SHORT = 92
SEMANTIC_TITLE_FLOOR_MEDIUM = 80
SEMANTIC_TITLE_FLOOR_LONG = 68
SEMANTIC_CONTENT_MATCH_PENALTY = 0.8
SEMANTIC_PURE_CAP = 75
SEMANTIC_SIMILARITY_CUTOFF = 35
SEMANTIC_POOL_MULTIPLIER = 3
SEMANTIC_POOL_MIN = 50
SEMANTIC_POOL_MAX = 200
SEMANTIC_FALLBACK_MAX_RESULTS = 2


class SimpleRAG:
    def __init__(self, lessons_dir: str = "database_tunisienne"):
        print("Initialisation du RAG (base tunisienne)...")

        self.loader = DocumentLoader(lessons_dir)
        self.chunker = DocumentChunker()
        self.embedder = TextEmbedder()
        self.vector_store = VectorStore()

        print("RAG pret pour la base tunisienne")

    def index_all(self, force_reindex: bool = False):
        print("\nIndexation des chapitres tunisiens...")

        if force_reindex or self.vector_store.collection.count() == 0:
            if force_reindex:
                self.vector_store.reset()

            documents = self.loader.load_all_documents()
            chunks = self.chunker.chunk_documents(documents)
            chunks_with_embeddings = self.embedder.embed_chunks(chunks)
            self.vector_store.add_chunks(chunks_with_embeddings)

        print(f"{self.vector_store.collection.count()} chunks tunisiens indexes")

    def _ensure_documents_loaded(self) -> List:
        if not hasattr(self, '_cached_documents'):
            self._cached_documents = self.loader.load_all_documents()
        return self._cached_documents

    def search(self, query: str, matiere: str = None, niveau: str = None,
               n_results: int = 5) -> Dict:
        print(f"Recherche tunisienne: '{query}' | {matiere or 'toutes matieres'} | niveau {niveau or 'tous'}")

        exact_results = self._search_exact_titles(query, matiere, niveau)
        semantic_results = self._search_semantic(query, matiere, niveau, n_results)
        semantic_list = semantic_results.get('results', []) if semantic_results else []

        if exact_results:
            for r in exact_results:
                r.setdefault('is_exact', True)
                r.setdefault('low_confidence', False)

            exact_by_id = {r['id']: r for r in exact_results}
            semantic_by_base = {}
            for r in semantic_list:
                base_id = r['id'].rsplit('_chunk_', 1)[0]
                if base_id not in semantic_by_base or r['similarity'] > semantic_by_base[base_id]['similarity']:
                    semantic_by_base[base_id] = r

            merged = []
            for doc_id in set(exact_by_id) | set(semantic_by_base):
                exact_r = exact_by_id.get(doc_id)
                sem_r = semantic_by_base.get(doc_id)
                if exact_r and sem_r:
                    merged.append(exact_r if exact_r['similarity'] >= sem_r['similarity'] else sem_r)
                else:
                    merged.append(exact_r or sem_r)

            merged.sort(key=lambda r: r['similarity'], reverse=True)
            merged = merged[:n_results]
            search_type = "exact_and_semantic" if semantic_list else "exact"
            print(f"   RAG trouve: {len(merged)} resultats ({search_type}, dont {len(exact_results)} exact)")
            return {"query": query, "results": merged, "search_type": search_type}

        if semantic_list:
            search_type = semantic_results.get('search_type', 'semantic')
            print(f"   RAG trouve: {len(semantic_list)} resultats ({search_type})")
            return semantic_results

        print("   RAG trouve: 0 resultats")
        return {"query": query, "results": [], "search_type": "none"}

    def _search_exact_titles(self, query: str, matiere: str = None, niveau: str = None) -> List[Dict]:
        documents = self._ensure_documents_loaded()
        exact_matches = []
        query_lower = _strip_diacritics(query.lower().strip())

        print(f"   Recherche exacte dans {len(documents)} documents")
        print(f"   Filtres: matiere='{matiere}', niveau='{niveau}'")

        documents_filtered = 0
        for doc in documents:
            if matiere and doc.metadata.get('matiere') != matiere:
                continue
            if niveau and doc.metadata.get('niveau') != str(niveau):
                continue

            documents_filtered += 1

            titre = _strip_diacritics(doc.metadata.get('titre', '').lower())
            notions = _strip_diacritics(str(doc.metadata.get('notions', '')).lower())

            query_match = _normalize_punct_for_matching(query_lower)
            titre_match = _normalize_punct_for_matching(titre)
            notions_match = _normalize_punct_for_matching(notions)

            score = 0

            query_pattern = r'(?<!\w)' + re.escape(query_match) + r'(?!\w)'
            title_exact_count = len(re.findall(query_pattern, titre_match))
            notions_exact_count = len(re.findall(query_pattern, notions_match))

            if title_exact_count > 0:
                titre_word_count = len(titre.split())

                if titre_word_count <= 4:
                    base_score = EXACT_TITLE_SHORT_BASE + min(
                        EXACT_TITLE_SHORT_BONUS_MAX, title_exact_count * EXACT_TITLE_SHORT_BONUS_PER_HIT)
                elif titre_word_count <= 7:
                    base_score = EXACT_TITLE_MEDIUM_BASE + min(
                        EXACT_TITLE_MEDIUM_BONUS_MAX, title_exact_count * EXACT_TITLE_MEDIUM_BONUS_PER_HIT)
                else:
                    base_score = EXACT_TITLE_LONG_BASE + min(
                        EXACT_TITLE_LONG_BONUS_MAX, title_exact_count * EXACT_TITLE_LONG_BONUS_PER_HIT)

                score = base_score
            elif query_match in titre_match:
                score = EXACT_TITLE_PARTIAL
            elif any(
                re.search(r'\b' + re.escape(word) + r'\b', titre_match)
                for word in query_match.split()
                if len(word) > EXACT_MIN_WORD_LEN and word not in STOPWORDS
            ):
                score = EXACT_TITLE_WORD_MATCH
            elif notions_exact_count > 0:
                score = EXACT_NOTIONS_MATCH
            elif query_match in notions_match:
                score = EXACT_NOTIONS_PARTIAL
            elif any(
                re.search(r'\b' + re.escape(word) + r'\b', notions_match)
                for word in query_match.split()
                if len(word) > EXACT_MIN_WORD_LEN and word not in STOPWORDS
            ):
                score = EXACT_NOTIONS_WORD_MATCH

            if score > 0:
                metadata_normalized = dict(doc.metadata)
                notions_raw = metadata_normalized.get('notions', [])
                if isinstance(notions_raw, list):
                    metadata_normalized['notions'] = "\n".join(f"• {n}" for n in notions_raw)
                else:
                    metadata_normalized['notions'] = str(notions_raw) if notions_raw else ""

                exact_matches.append({
                    "id": doc.id,
                    "content": doc.content,
                    "metadata": metadata_normalized,
                    "similarity": score,
                    "distance": (100 - score) / 100
                })

        print(f"   📊 Documents après filtrage: {documents_filtered}/{len(documents)}")
        print(f"   ✅ Correspondances exactes trouvées: {len(exact_matches)}")

        if matiere and niveau and exact_matches:
            for match in exact_matches:
                result_matiere = match['metadata'].get('matiere')
                result_niveau = match['metadata'].get('niveau')
                if result_matiere != matiere or result_niveau != str(niveau):
                    print(f"⚠️  ALERTE EXACTE: Résultat mal filtré! {result_matiere}/{result_niveau} vs {matiere}/{niveau}")

        exact_matches.sort(key=lambda x: x['similarity'], reverse=True)
        return exact_matches[:EXACT_TITLE_MAX_RESULTS]

    def _search_semantic(self, query: str, matiere: str = None, niveau: str = None,
                          n_results: int = 5) -> Dict:
        print(f"🔍 Recherche sémantique: '{query}' | Matière: {matiere} | Niveau: {niveau}")

        query_embedding = self.embedder.embed_query(query)

        pool_size = min(max(n_results * SEMANTIC_POOL_MULTIPLIER, SEMANTIC_POOL_MIN), SEMANTIC_POOL_MAX)
        try:
            raw_results = self.vector_store.search(
                query_embedding=query_embedding,
                n_results=pool_size,
                matiere=matiere,
                niveau=niveau
            )
        except Exception as e:
            print(f"❌ Erreur recherche vectorielle: {e}")
            return {"query": query, "results": [], "search_type": "semantic"}

        if not raw_results:
            print("✅ 0 résultats trouvés")
            return {"query": query, "results": [], "search_type": "semantic"}

        formatted_results = []
        below_threshold_pool = []
        for item in raw_results:
            metadata = item['metadata']
            doc = item['content']

            if matiere and metadata.get('matiere') != matiere:
                continue
            if niveau and metadata.get('niveau') != str(niveau):
                continue

            similarity = item['similarity_percent']

            is_exact_match = False
            query_lower = _strip_diacritics(query.lower().strip())
            titre_lower = _strip_diacritics(metadata.get('titre', '').lower().strip())
            content_lower = _strip_diacritics(doc.lower().strip())

            query_match = _normalize_punct_for_matching(query_lower)
            titre_match = _normalize_punct_for_matching(titre_lower)
            content_match = _normalize_punct_for_matching(content_lower)

            titre_word_count = len(titre_lower.split())
            if query_match in titre_match:
                is_exact_match = True
                if titre_word_count <= 4:
                    floor = SEMANTIC_TITLE_FLOOR_SHORT
                elif titre_word_count <= 7:
                    floor = SEMANTIC_TITLE_FLOOR_MEDIUM
                else:
                    floor = SEMANTIC_TITLE_FLOOR_LONG
                similarity = max(similarity, floor)
            elif query_match in content_match:
                similarity = similarity * SEMANTIC_CONTENT_MATCH_PENALTY
                is_exact_match = False
            else:
                similarity = min(similarity, SEMANTIC_PURE_CAP)
                is_exact_match = False

            candidate = {
                "id": item['id'],
                "content": doc,
                "metadata": metadata,
                "similarity": similarity,
                "distance": (100 - similarity) / 100,
                "is_exact": is_exact_match,
                "low_confidence": False
            }

            if similarity < SEMANTIC_SIMILARITY_CUTOFF:
                below_threshold_pool.append(candidate)
                continue

            formatted_results.append(candidate)

        if not formatted_results and below_threshold_pool:
            below_threshold_pool.sort(key=lambda x: x['similarity'], reverse=True)
            fallback = below_threshold_pool[:min(SEMANTIC_FALLBACK_MAX_RESULTS, len(below_threshold_pool))]
            for r in fallback:
                r['low_confidence'] = True
            formatted_results = fallback
            print(f"⚠️ Aucun résultat au-dessus du seuil ({SEMANTIC_SIMILARITY_CUTOFF}%) — "
                  f"repli sur {len(fallback)} candidat(s) le(s) plus proche(s) "
                  f"(low_confidence=True)")

        formatted_results.sort(key=lambda x: x['similarity'], reverse=True)

        print(f"✅ {len(formatted_results)} résultats trouvés (après filtrage strict)")

        if matiere and niveau and formatted_results:
            for result in formatted_results:
                result_matiere = result['metadata'].get('matiere')
                result_niveau = result['metadata'].get('niveau')
                if result_matiere != matiere or result_niveau != str(niveau):
                    print(f"⚠️  ALERTE: Résultat non filtré détecté! {result_matiere}/{result_niveau} vs {matiere}/{niveau}")

        return {
            "query": query,
            "results": formatted_results[:n_results],
            "search_type": "semantic_filtered"
        }

    def _build_context(self, results: List[Dict]) -> str:
        if not results:
            return ""

        context_parts = ["=== CONTEXTE DU PROGRAMME ===\n"]

        for i, result in enumerate(results, 1):
            content = result['content']
            metadata = result['metadata']

            label = f"\n[Extrait {i}]"
            if result.get('low_confidence'):
                label += " (⚠️ correspondance incertaine — à utiliser avec prudence)"
            context_parts.append(label)
            context_parts.append(f"Matière: {metadata.get('matiere', 'N/A')}")
            context_parts.append(f"Niveau: {metadata.get('niveau', 'N/A')}")
            context_parts.append(f"Contenu:\n{content}")
            context_parts.append("")

        return "\n".join(context_parts)

    def get_stats(self) -> Dict:
        documents = self._ensure_documents_loaded()

        stats = self.loader.get_statistics()
        stats.update({
            'total_chunks': self.vector_store.collection.count(),
            'total_documents': len(documents)
        })

        return stats

    def get_all_chapters(self, matiere: str, niveau: str) -> List[Dict]:
        documents = self._ensure_documents_loaded()

        chapters = []
        for doc in documents:
            if (doc.metadata.get('matiere') == matiere and
                    doc.metadata.get('niveau') == str(niveau)):
                chapters.append({
                    "id": doc.id,
                    "content": doc.content,
                    "metadata": doc.metadata,
                    "similarity": 100.0,
                    "distance": 0.0
                })

        return chapters
