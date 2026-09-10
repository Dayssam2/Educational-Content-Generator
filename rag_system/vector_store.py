import chromadb
import os
from pathlib import Path
from typing import List, Dict, Optional

_DEFAULT_DB_PATH = str(Path(__file__).resolve().parent / "chroma_db")


class VectorStore:
    COLLECTION_NAME = "lessons"

    def __init__(self, db_path: str = _DEFAULT_DB_PATH, force_reset: bool = False):
        self.db_path = db_path

        os.makedirs(db_path, exist_ok=True)

        self.client = chromadb.PersistentClient(path=db_path)

        if force_reset:
            self.collection = self._recreate_collection()
            print(" Collection recréée (force_reset=True)")
        else:
            self.collection = self._get_or_migrate_collection()

    def _recreate_collection(self):
        try:
            self.client.delete_collection(self.COLLECTION_NAME)
        except Exception:
            pass
        return self.client.create_collection(
            self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )

    def _get_or_migrate_collection(self):
        try:
            existing = self.client.get_collection(self.COLLECTION_NAME)
        except Exception:
            print("ℹ Aucune collection existante, création en espace cosine")
            return self.client.create_collection(
                self.COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"}
            )

        space = (existing.metadata or {}).get("hnsw:space")
        if space == "cosine":
            print(f"✅ Vector Store: collection existante réutilisée "
                  f"({existing.count()} chunks, espace cosine)")
            return existing

        print(f"⚠️ Collection existante en espace '{space}' (probablement L2). "
              f"Migration ponctuelle vers cosine — une ré-indexation sera nécessaire.")
        return self._recreate_collection()

    def add_chunks(self, chunks_with_embeddings: List[Dict]):
        if not chunks_with_embeddings:
            return

        ids = []
        embeddings = []
        documents = []
        metadatas = []

        for item in chunks_with_embeddings:
            chunk = item['chunk']
            embedding = item['embedding']

            ids.append(chunk.id)
            embeddings.append(embedding)
            documents.append(chunk.content)
            metadatas.append({
                'matiere': chunk.matiere,
                'niveau': chunk.niveau,
                'titre': chunk.titre,
                'source': chunk.source_file,
                'notions': getattr(chunk, 'notions', '') or ''
            })

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

        print(f" {len(chunks_with_embeddings)} chunks ajoutés/mis à jour")

    def search(self, query_embedding: List[float], n_results: int = 5,
               matiere: Optional[str] = None, niveau: Optional[str] = None) -> List[Dict]:
        where_filter = None
        if matiere and niveau:
            where_filter = {
                "$and": [
                    {"matiere": {"$eq": matiere}},
                    {"niveau": {"$eq": str(niveau)}}
                ]
            }
        elif matiere:
            where_filter = {"matiere": {"$eq": matiere}}
        elif niveau:
            where_filter = {"niveau": {"$eq": str(niveau)}}

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where_filter,
        )

        formatted_results = []
        if results and results['documents'] and results['documents'][0]:
            for i in range(len(results['documents'][0])):
                distance = results['distances'][0][i]

                normalized_similarity = max(0.0, min(1.0, 1 - distance))
                similarity_percent = normalized_similarity * 100

                formatted_results.append({
                    'id': results['ids'][0][i],
                    'content': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'distance': distance,
                    'similarity_percent': similarity_percent,
                    'confidence': normalized_similarity
                })

        return formatted_results

    def reset(self):
        self.collection = self._recreate_collection()
        print("✅ Collection réinitialisée (espace: cosine)")
