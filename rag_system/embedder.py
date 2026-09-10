from typing import List
from sentence_transformers import SentenceTransformer

QUERY_INSTRUCTION = (
    "Given a search query about a Tunisian primary-school lesson "
    "(Arabic or French), retrieve the most relevant curriculum chapter."
)

MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"


class TextEmbedder:
    def __init__(self):
        print(f" Chargement modèle embedding ({MODEL_NAME})...")
        self.model = SentenceTransformer(MODEL_NAME)
        print(" Modèle embedding prêt")

    def embed_chunks(self, chunks: List) -> List[dict]:
        texts = [chunk.content for chunk in chunks]
        print(f" Génération embeddings pour {len(texts)} chunks...")

        embeddings = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=True)

        results = []
        for chunk, embedding in zip(chunks, embeddings):
            results.append({
                'chunk': chunk,
                'embedding': embedding.tolist()
            })

        print(f" {len(results)} embeddings générés")
        return results

    def embed_query(self, query: str) -> List[float]:
        embedding = self.model.encode(
            [query],
            prompt_name="query",
            prompt=QUERY_INSTRUCTION,
        )[0]
        return embedding.tolist()
