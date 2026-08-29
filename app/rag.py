"""
RAG con ChromaDB: una colección 'chat_history' con metadata conversation_id.
Embeddings con Ollama (mxbai-embed-large:latest por defecto). Si CHROMA_HOST
no está configurado, las funciones no hacen nada (RAG desactivado).
Solo se indexan mensajes del usuario (no las respuestas del asistente).
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.config import settings

# Constantes
COLLECTION_NAME = "chat_history"
RAG_TOP_N = 10
DEFAULT_CHROMA_HOST = "http://localhost:8001"

_chroma_available: bool | None = None


def _chroma_host() -> str:
    """URL de Chroma: la configurada o la por defecto."""
    return (settings.chroma_host or "").strip() or DEFAULT_CHROMA_HOST


def _ollama_embeddings_url() -> str:
    """URL del endpoint de embeddings de Ollama."""
    base = (settings.ollama_host or "http://localhost:11434").rstrip("/")
    return f"{base}/api/embeddings"


def _rag_available() -> bool:
    """RAG disponible si Chroma está configurado y se puede importar chromadb."""
    global _chroma_available
    if not (settings.chroma_host or "").strip():
        _chroma_available = False
        if settings.verbose:
            print("--- ChromaDB/RAG: CHROMA_HOST no configurado (revisa .env) ---", file=sys.stderr)
        return False
    if _chroma_available is not None:
        return _chroma_available
    try:
        import chromadb  # noqa: F401
        from chromadb.utils import embedding_functions  # noqa: F401
        _chroma_available = True
        return True
    except Exception:
        _chroma_available = False
        return False


def _get_chroma_client():
    if not _rag_available():
        return None
    try:
        import chromadb
        parsed = urlparse(_chroma_host())
        host = parsed.hostname or "localhost"
        port = parsed.port or 8001
        return chromadb.HttpClient(host=host, port=port)
    except Exception:
        return None


def _get_embedding_function():
    """Embedding function: Ollama (mxbai-embed-large:latest). Para usar OpenAI, define EMBEDDINGS_PROVIDER=openai y OPENAI_API_KEY."""
    try:
        from chromadb.utils import embedding_functions
        if (settings.embeddings_provider or "").strip().lower() == "openai" and (settings.openai_api_key or "").strip():
            return embedding_functions.OpenAIEmbeddingFunction(
                api_key=settings.openai_api_key,
                model_name="text-embedding-3-small",
            )
        # Por defecto: Ollama
        model = (settings.ollama_embedding_model or "mxbai-embed-large:latest").strip()
        return embedding_functions.OllamaEmbeddingFunction(
            url=_ollama_embeddings_url(),
            model_name=model,
        )
    except Exception:
        return None


def _get_collection():
    """Obtiene la colección chat_history con embedding function (Ollama u OpenAI)."""
    if not _rag_available():
        return None
    try:
        client = _get_chroma_client()
        if client is None:
            return None
        ef = _get_embedding_function()
        if ef is None:
            return None
        return client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=ef,
            metadata={"description": "Historial de mensajes por conversación para RAG"},
        )
    except Exception:
        return None


def add_message(
    conversation_id: str,
    message_id: str,
    role: str,
    content: str,
    created_at: datetime | None = None,
) -> None:
    """
    Añade un mensaje al historial en Chroma. Id único por mensaje, metadata con
    conversation_id, role y created_at (ISO). Si RAG no está disponible, no hace nada.
    """
    if not _rag_available() or not content.strip():
        return
    msg_id_str = str(message_id)
    try:
        coll = _get_collection()
        if coll is None:
            if settings.verbose:
                print("--- ChromaDB add: no se pudo obtener la colección ---", file=sys.stderr)
            return
        created = (created_at or datetime.now(timezone.utc)).isoformat()
        # Documento a embeber: role + content para mejor recuperación
        document = f"{role}: {content.strip()}"
        meta = {
            "conversation_id": conversation_id,
            "message_id": msg_id_str,
            "role": role,
            "created_at": created,
        }
        if settings.verbose:
            preview = (content.strip()[:80] + "…") if len(content.strip()) > 80 else content.strip()
            print("--- ChromaDB add: generando embedding del mensaje (Ollama) ---", file=sys.stderr)
            print(f"  id={msg_id_str!r} conversation_id={conversation_id!r} role={role!r}", file=sys.stderr)
            print(f"  content(preview)={preview!r}", file=sys.stderr)
        coll.add(
            ids=[msg_id_str],
            documents=[document],
            metadatas=[meta],
        )
        if settings.verbose:
            print("  → embedding generado e insertado en Chroma", file=sys.stderr)
            print("--- fin ChromaDB add ---", file=sys.stderr)
    except Exception as e:
        # Log para ver por qué falla el insert (p. ej. en hilo de run_in_executor)
        print(f"--- ChromaDB add ERROR: {e!r} ---", file=sys.stderr)
        if settings.verbose:
            import traceback
            traceback.print_exc(file=sys.stderr)


def _chroma_conversation_where(conversation_id: str, conversation_ids: set[str] | None) -> dict:
    ids = [str(x) for x in conversation_ids if x] if conversation_ids else []
    if not ids:
        ids = [str(conversation_id)]
    uniq = list(dict.fromkeys(ids))
    if len(uniq) == 1:
        return {"conversation_id": uniq[0]}
    return {"$or": [{"conversation_id": i} for i in uniq]}


def get_relevant_context(
    conversation_id: str,
    query: str,
    n_results: int = RAG_TOP_N,
    allowed_message_ids: set[str] | None = None,
    conversation_ids: set[str] | None = None,
) -> str:
    """
    Consulta Chroma por similitud con query, filtrado por conversation_id.
    Devuelve un único string con el contenido de los documentos recuperados
    (sin el mensaje actual), para inyectar como "Contexto relevante del historial".
    Si RAG no está disponible o no hay resultados, devuelve "".
    allowed_message_ids: si se indica, solo se usan documentos de esos mensajes
    (camino del intento activo). Vacío = sin contexto.
    """
    if settings.verbose:
        q_preview = (query.strip()[:50] + "…") if len(query.strip()) > 50 else (query.strip() or "(vacía)")
        print("--- ChromaDB get_relevant_context ---", file=sys.stderr)
        print(f"  conversation_id={conversation_id!r} query={q_preview!r} n_results={n_results}", file=sys.stderr)
    if not _rag_available():
        if settings.verbose:
            print("  → RAG no disponible (Chroma/Ollama o import fallido). Contexto vacío.", file=sys.stderr)
            print("--- fin ChromaDB ---", file=sys.stderr)
        return ""
    if not query.strip():
        if settings.verbose:
            print("  → query vacía, no se consulta", file=sys.stderr)
            print("--- fin ChromaDB ---", file=sys.stderr)
        return ""
    if allowed_message_ids is not None and not allowed_message_ids:
        if settings.verbose:
            print("  → camino de intento vacío, no se consulta RAG", file=sys.stderr)
            print("--- fin ChromaDB ---", file=sys.stderr)
        return ""
    try:
        coll = _get_collection()
        if coll is None:
            if settings.verbose:
                print("  → no se pudo obtener la colección (¿embedding distinto? haz make chroma-clean)", file=sys.stderr)
                print("--- fin ChromaDB ---", file=sys.stderr)
            return ""
        if settings.verbose:
            print("  → generando embedding de la query (Ollama) y buscando...", file=sys.stderr)
        fetch_n = n_results
        if allowed_message_ids is not None:
            fetch_n = max(n_results * 4, 20)
        results = coll.query(
            query_texts=[query.strip()],
            n_results=fetch_n,
            where=_chroma_conversation_where(conversation_id, conversation_ids),
        )
        if not results or not results.get("documents") or not results["documents"][0]:
            if settings.verbose:
                print("  → 0 documentos recuperados (contexto no inyectado)", file=sys.stderr)
                print("--- fin ChromaDB ---", file=sys.stderr)
            return ""
        docs = results["documents"][0]
        result_ids = (results.get("ids") or [[]])[0]
        if allowed_message_ids is not None:
            allowed = {str(x) for x in allowed_message_ids}
            docs = [d for i, d in zip(result_ids, docs) if i in allowed]
            docs = docs[:n_results]
        if not docs:
            if settings.verbose:
                print("  → 0 documentos del camino activo (contexto no inyectado)", file=sys.stderr)
                print("--- fin ChromaDB ---", file=sys.stderr)
            return ""
        context = "\n\n".join(docs).strip()
        if settings.verbose:
            n = len(docs)
            ctx_preview = (context[:150] + "…") if len(context) > 150 else context
            print(f"  → {n} documento(s). Contexto inyectado en el prompt (preview): {ctx_preview!r}", file=sys.stderr)
            print("--- fin ChromaDB ---", file=sys.stderr)
        return context
    except Exception as e:
        if settings.verbose:
            print(f"  → ERROR: {e!r}", file=sys.stderr)
            print("--- fin ChromaDB ---", file=sys.stderr)
        return ""


def delete_message_document(conversation_id: str, message_id: str) -> None:
    """Elimina el documento de un mensaje en Chroma (al borrar ese mensaje del historial)."""
    if not _rag_available():
        return
    try:
        coll = _get_collection()
        if coll is None:
            return
        coll.delete(ids=[str(message_id)])
    except Exception:
        pass


def delete_conversation_documents(conversation_id: str) -> None:
    """
    Elimina todos los documentos de la conversación en Chroma (al borrar la conversación).
    """
    if not _rag_available():
        return
    try:
        coll = _get_collection()
        if coll is None:
            return
        coll.delete(where={"conversation_id": conversation_id})
    except Exception:
        pass


def delete_ingested_documents(conversation_id: str) -> None:
    """
    Elimina solo los documentos con role='ingested' de la conversación.
    Útil antes de una nueva ingesta para que el contenido ingerido sea el del último archivo.
    """
    if not _rag_available():
        return
    try:
        coll = _get_collection()
        if coll is None:
            return
        coll.delete(
            where={
                "$and": [
                    {"conversation_id": {"$eq": conversation_id}},
                    {"role": {"$eq": "ingested"}},
                ]
            }
        )
    except Exception:
        pass


def delete_chat_history_documents(conversation_id: str) -> None:
    """
    Elimina solo los documentos de historial de chat (role 'user' o 'assistant') de la conversación.
    No borra los documentos con role='ingested' (contenido ingerido de archivos).
    """
    if not _rag_available():
        return
    try:
        coll = _get_collection()
        if coll is None:
            return
        coll.delete(
            where={
                "$and": [
                    {"conversation_id": {"$eq": conversation_id}},
                    {"role": {"$in": ["user", "assistant"]}},
                ]
            }
        )
    except Exception:
        pass


# Tamaño máximo por chunk para embeddings
INGEST_CHUNK_MAX_CHARS = 6000
INGEST_CHUNK_OVERLAP = 200


def _chunk_text(text: str, max_chars: int = INGEST_CHUNK_MAX_CHARS, overlap: int = INGEST_CHUNK_OVERLAP) -> list[str]:
    """Divide el texto en fragmentos para no superar el límite de la API de embeddings."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunk = text[start:end]
        if end < len(text):
            # Intentar cortar en espacio para no partir palabras
            last_space = chunk.rfind(" ")
            if last_space > max_chars // 2:
                chunk = chunk[: last_space + 1]
                end = start + last_space + 1
        chunks.append(chunk.strip())
        start = end - overlap if end < len(text) else len(text)
    return [c for c in chunks if c]


def add_ingested_document(
    conversation_id: str,
    content: str,
    doc_id_prefix: str | None = None,
    verbose: bool = False,
) -> int:
    """
    Trocea el contenido, genera embeddings e inserta cada trozo en Chroma para la conversación.
    Antes borra los documentos ingested existentes de esta conversación (cada ingesta reemplaza).
    Metadata: conversation_id, role="ingested", created_at.
    Devuelve el número de chunks insertados.
    """
    if not _rag_available() or not content.strip():
        return 0
    chunks = _chunk_text(content)
    if not chunks:
        return 0
    try:
        coll = _get_collection()
        if coll is None:
            return 0
        delete_ingested_documents(conversation_id)
    except Exception:
        pass
    prefix = (doc_id_prefix or f"ingest_{conversation_id}").strip()
    now = datetime.now(timezone.utc).isoformat()
    meta_base = {
        "conversation_id": conversation_id,
        "role": "ingested",
        "created_at": now,
    }
    try:
        coll = _get_collection()
        if coll is None:
            return 0
        ids = [f"{prefix}_{i}" for i in range(len(chunks))]
        documents = [f"ingested: {c}" for c in chunks]
        metadatas = [dict(meta_base) for _ in chunks]
        coll.add(ids=ids, documents=documents, metadatas=metadatas)
        if verbose or settings.verbose:
            print(f"  → {len(chunks)} chunk(s) con embeddings insertados en Chroma para conversación {conversation_id!r}", file=sys.stderr)
        return len(chunks)
    except Exception as e:
        err_msg = str(e).lower()
        if "429" in err_msg or "quota" in err_msg or "rate" in err_msg:
            print("--- ChromaDB add_ingested_document: API de embeddings 429 / cuota (si usas OpenAI, revisa platform.openai.com) ---", file=sys.stderr)
        else:
            print(f"--- ChromaDB add_ingested_document ERROR: {e!r} ---", file=sys.stderr)
        if settings.verbose:
            import traceback
            traceback.print_exc(file=sys.stderr)
        return 0
