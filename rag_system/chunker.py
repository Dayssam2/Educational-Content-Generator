from typing import List
from dataclasses import dataclass


@dataclass
class Chunk:
    id: str
    content: str
    matiere: str
    niveau: str
    titre: str
    source_file: str
    notions: str = ""


class DocumentChunker:
    def __init__(self, chunk_size: int = 1500, overlap: int = 200):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_documents(self, documents: List) -> List[Chunk]:
        print(f"🔄 Découpage de {len(documents)} documents...")

        chunks = []
        for i, doc in enumerate(documents):
            print(f"   📄 Document {i+1}/{len(documents)}: {doc.id}")

            try:
                doc_chunks = self._chunk_document(doc)
                chunks.extend(doc_chunks)
                del doc_chunks

            except MemoryError:
                print(f"   ❌ MemoryError sur {doc.id} - IGNORER")
                continue
            except Exception as e:
                print(f"   ❌ Erreur sur {doc.id}: {e}")
                continue

        print(f"✅ {len(documents)} documents → {len(chunks)} chunks")
        return chunks

    def _chunk_document(self, document) -> List[Chunk]:
        content = document.content

        if len(content) <= self.chunk_size:
            return [self._create_chunk(document, content, 0)]

        chunks = []
        start = 0
        index = 0
        content_len = len(content)

        while start < content_len:
            end = min(start + self.chunk_size, content_len)

            if end < content_len:
                boundary_search_start = start + int(self.chunk_size * 0.75)
                last_space = content.rfind(' ', boundary_search_start, end)
                last_newline = content.rfind('\n', boundary_search_start, end)
                boundary = max(last_space, last_newline)
                if boundary > start:
                    end = boundary

            chunk_content = content[start:end].strip()
            if chunk_content:
                chunks.append(self._create_chunk(document, chunk_content, index))
                index += 1

            if end >= content_len:
                break

            next_start = max(end - self.overlap, start + 1)
            start = next_start

        print(f"      ℹ️ {document.id}: {content_len} chars → {len(chunks)} chunks "
              f"(chunk_size={self.chunk_size}, overlap={self.overlap})")

        return chunks

    def _create_chunk(self, document, content: str, index: int) -> Chunk:
        metadata = document.metadata
        titre = metadata.get('titre', 'Sans titre')
        matiere = metadata.get('matiere', 'unknown')
        niveau = metadata.get('niveau', '1')
        source = metadata.get('source', 'unknown')

        notions_raw = metadata.get('notions', [])
        if isinstance(notions_raw, list):
            notions = "\n".join(f"• {n}" for n in notions_raw)
        else:
            notions = str(notions_raw) if notions_raw else ""

        enhanced_content = f"{titre}\n\n{content}"

        return Chunk(
            id=f"{document.id}_chunk_{index}",
            content=enhanced_content,
            matiere=matiere,
            niveau=niveau,
            titre=titre,
            source_file=source,
            notions=notions
        )
