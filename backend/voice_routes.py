from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

import voice_engine

router = APIRouter(prefix="/api/assistant", tags=["assistant-vocal"])


class SluEntree(BaseModel):
    texte: str = Field(..., max_length=2_000)


class AsrEntree(BaseModel):
    audio_base64: str
    langue: Optional[str] = None


class TtsEntree(BaseModel):
    texte: str = Field(..., max_length=20_000)
    langue: Optional[str] = None


@router.post("/slu")
def slu(entree: SluEntree):
    try:
        res = voice_engine.comprendre(entree.texte)
    except ValueError as e:
        raise HTTPException(400, str(e))
    res["resume"] = voice_engine.resumer_parametres(res["parametres"], res["langue"])
    return res


@router.post("/asr")
def asr(entree: AsrEntree):
    try:
        return voice_engine.transcrire(entree.audio_base64, entree.langue)
    except voice_engine.ModuleVocalIndisponible as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erreur de transcription : {e}")


@router.post("/tts")
def tts(entree: TtsEntree):
    try:
        mp3 = voice_engine.synthetiser(entree.texte, entree.langue)
    except voice_engine.ModuleVocalIndisponible as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Erreur de synthese vocale : {e}")
    return Response(content=mp3, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
